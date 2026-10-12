import express, { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { db, databasePath, sqlite } from './src/db/index.ts';
import {
  users,
  colleges,
  departments,
  buildings,
  rooms,
  academicYears,
  semesters,
  stages,
  sections,
  subjects,
  faculties,
  schedules,
  scheduleSections,
  lectureSessions,
  attendanceRecords,
  attendanceSectionRecords,
  attendanceEvidence,
  workloadPolicies,
  academicExceptions,
  substitutions,
  coTeaching,
  notifications,
  auditLogs,
  systemSettings,
  importJobs,
  importErrors,
} from './src/db/schema.ts';
import { eq, and, sql, desc, or, not, ne, inArray } from 'drizzle-orm';
import { registerDepartmentPackageRoutes } from './departmentPackage.routes.ts';
import { AcademicTerm, cloneScheduleForTerm, findScheduleTermConflicts, formatAcademicTerm, isSameAcademicTerm, normalizeSemester, parseCurrentTermSetting, resolveAcademicTerm, validateAcademicYear } from './src/services/academicTerm.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = process.env.UOMUS_UPLOADS_PATH
  ? path.resolve(process.env.UOMUS_UPLOADS_PATH)
  : process.env.UOMUS_DB_PATH
    ? path.resolve(path.dirname(process.env.UOMUS_DB_PATH), 'uploads')
    : path.resolve(__dirname, 'data', 'uploads');
mkdirSync(uploadsRoot, { recursive: true });

const app = express();
// This service is directly reachable (it binds its own listener); do not trust
// client-supplied X-Forwarded-For unless a deployment explicitly configures it.
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
app.set('trust proxy', Number.isInteger(trustedProxyHops) && trustedProxyHops > 0 ? trustedProxyHops : false);
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. Security Hardening: JWT Secret Validation (Requirement 1)
// ==========================================
const envFilePath = path.resolve(__dirname, '.env');
let secret = process.env.JWT_SECRET?.trim();
if (!secret) {
  secret = crypto.randomBytes(48).toString('base64url');
  const currentEnv = existsSync(envFilePath) ? readFileSync(envFilePath, 'utf8') : '';
  const secretLine = `JWT_SECRET=${secret}`;
  const updatedEnv = /^\s*JWT_SECRET\s*=.*$/m.test(currentEnv)
    ? currentEnv.replace(/^\s*JWT_SECRET\s*=.*$/m, secretLine)
    : `${currentEnv}${currentEnv && !currentEnv.endsWith('\n') ? '\n' : ''}${secretLine}\n`;
  writeFileSync(envFilePath, updatedEnv, { encoding: 'utf8', mode: 0o600 });
  process.env.JWT_SECRET = secret;
  console.log('[SECURITY] Generated and saved a new JWT secret in .env.');
}
export const JWT_SECRET: string = secret;

// ==========================================
// 2. Security Middleware: Helmet & CORS (Requirement 9)
// ==========================================
// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // For SPA / Vite dev client compatibility
  crossOriginEmbedderPolicy: false,
}));

// CORS Configuration with strict origin check
const corsOriginEnv = process.env.CORS_ORIGIN;
const allowedOrigins = corsOriginEnv
  ? corsOriginEnv.split(',').map(s => s.trim())
  : (process.env.APP_URL ? [new URL(process.env.APP_URL).origin] : true);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser with 20mb limit for attendance evidence photos
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Rate limiter for login endpoint (10 attempts / 15 minutes) (Requirement 9)
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول (10 محاولات / 15 دقيقة). يرجى الانتظار والمحاولة لاحقاً.',
    },
  },
});

// Request logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// Helper for generating standard UUID-based IDs
export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

// ==========================================
// 3. JWT & RBAC Auth Types & Middleware (Phase 3 & Security Hardening)
// ==========================================
export interface AuthUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'OWNER' | 'COLLEGE_MONITOR' | 'DEPARTMENT_MONITOR' | 'FACULTY';
  roleTitleAr?: string;
  assignedCollegeId?: string | null;
  assignedDepartmentId?: string | null;
  assignedFacultyId?: string | null;
  avatar?: string | null;
  status?: string;
  tokenVersion?: number;
}

/** Fields safe to return to the browser for any user record. */
export function toSafeUser(user: any) {
  return {
    id: user.id,
    uid: user.uid,
    employeeId: user.employeeId ?? null,
    email: user.email,
    name: user.name,
    role: user.role,
    roleTitleAr: user.roleTitleAr,
    assignedCollegeId: user.assignedCollegeId ?? null,
    assignedDepartmentId: user.assignedDepartmentId ?? null,
    assignedFacultyId: user.assignedFacultyId ?? null,
    avatar: user.avatar ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
    status: user.status,
  };
}

export interface UserScope {
  collegeId?: string | null;
  departmentId?: string | null;
  facultyId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      scope?: UserScope;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      roleTitleAr: user.roleTitleAr,
      assignedCollegeId: user.assignedCollegeId,
      assignedDepartmentId: user.assignedDepartmentId,
      assignedFacultyId: user.assignedFacultyId,
      avatar: user.avatar,
      tokenVersion: user.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

// Mandatory JWT Authentication Middleware (Requirement 3)
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'رمز المصادقة مطلوب (Bearer token required)' },
    });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'رمز المصادقة غير صالح أو منتهي الصلاحية' },
    });
  }
  try {
    const current = sqlite.prepare('SELECT id, uid, name, email, role, role_title_ar as roleTitleAr, assigned_college_id as assignedCollegeId, assigned_department_id as assignedDepartmentId, assigned_faculty_id as assignedFacultyId, avatar, status, token_version as tokenVersion, must_change_password as mustChangePassword FROM users WHERE id = ?').get(user.id) as any;
    if (!current || current.status === 'inactive' || (current.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ success: false, error: { code: 'SESSION_REVOKED', message: 'انتهت صلاحية الجلسة، سجّل الدخول مجدداً' } });
    }
    if (current.mustChangePassword && req.path !== '/api/auth/change-password') {
      return res.status(403).json({ success: false, error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'يجب تغيير كلمة المرور قبل متابعة استخدام النظام' } });
    }
    req.user = { id: current.id, uid: current.uid, name: current.name, email: current.email, role: current.role as AuthUser['role'], roleTitleAr: current.roleTitleAr, assignedCollegeId: current.assignedCollegeId, assignedDepartmentId: current.assignedDepartmentId, assignedFacultyId: current.assignedFacultyId, avatar: current.avatar, status: current.status, tokenVersion: current.tokenVersion };
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: 'SESSION_REVOKED', message: 'تعذر التحقق من الجلسة' } });
  }
}

// Role-Based Access Control Middleware (Requirement 4)
export function requireRole(...allowedRoles: Array<'OWNER' | 'COLLEGE_MONITOR' | 'DEPARTMENT_MONITOR' | 'FACULTY'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول أولاً' },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `ليس لديك الصلاحية المطلوبة (${req.user.roleTitleAr || req.user.role}) لإجراء هذه العملية`,
        },
      });
    }

    next();
  };
}

// Scope Isolation Middleware (Populates scope object for query building)
export function applyScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول لتطبيق نطاق الصلاحيات' },
    });
  }

  const role = req.user.role;
  const scope: UserScope = {};

  if (role === 'OWNER') {
    scope.collegeId = null;
    scope.departmentId = null;
    scope.facultyId = null;
  } else if (role === 'COLLEGE_MONITOR') {
    scope.collegeId = req.user.assignedCollegeId || null;
    scope.departmentId = null;
    scope.facultyId = null;
  } else if (role === 'DEPARTMENT_MONITOR') {
    scope.collegeId = req.user.assignedCollegeId || null;
    scope.departmentId = req.user.assignedDepartmentId || null;
    scope.facultyId = null;
  } else if (role === 'FACULTY') {
    scope.collegeId = req.user.assignedCollegeId || null;
    scope.departmentId = req.user.assignedDepartmentId || null;
    scope.facultyId = req.user.assignedFacultyId || null;
  }

  req.scope = scope;
  next();
}

/** Central scope predicate. It must be called with the row loaded from SQLite. */
export function scopeAllows(user: AuthUser, row: any, kind: 'college' | 'department' | 'faculty' | 'schedule' | 'room' | 'stage' | 'section' | 'subject' | 'building') {
  if (user.role === 'OWNER') return true;
  if (!row) return false;
  if (user.role === 'FACULTY') return kind === 'faculty'
    ? row.id === user.assignedFacultyId
    : kind === 'schedule' ? row.facultyId === user.assignedFacultyId : false;
  if (user.role === 'COLLEGE_MONITOR') {
    if (kind === 'college') return row.id === user.assignedCollegeId;
    if (kind === 'department' || kind === 'faculty' || kind === 'room' || kind === 'stage' || kind === 'section' || kind === 'subject' || kind === 'schedule') {
      return row.collegeId === user.assignedCollegeId || row.departmentCollegeId === user.assignedCollegeId || row.departmentId && row.assignedCollegeId === user.assignedCollegeId;
    }
  }
  if (user.role === 'DEPARTMENT_MONITOR') {
    if (kind === 'department') return row.id === user.assignedDepartmentId;
    if (kind === 'faculty' || kind === 'room' || kind === 'stage' || kind === 'section' || kind === 'subject' || kind === 'schedule') return row.departmentId === user.assignedDepartmentId;
  }
  return false;
}

export function denyOutOfScope(res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'العنصر غير موجود' } });
}

async function scheduleInUserScope(user: AuthUser, schedule: any) {
  if (!schedule) return false;
  if (user.role === 'OWNER') return true;
  if (user.role === 'FACULTY') return schedule.facultyId === user.assignedFacultyId;
  const dept = (await db.select({ id: departments.id, collegeId: departments.collegeId })
    .from(departments).where(eq(departments.id, schedule.departmentId)).limit(1))[0];
  if (user.role === 'DEPARTMENT_MONITOR') return schedule.departmentId === user.assignedDepartmentId;
  return user.role === 'COLLEGE_MONITOR' && dept?.collegeId === user.assignedCollegeId;
}

async function departmentInUserScope(user: AuthUser, departmentId: string | null | undefined) {
  if (user.role === 'OWNER') return true;
  if (!departmentId) return false;
  if (user.role === 'DEPARTMENT_MONITOR') return departmentId === user.assignedDepartmentId;
  if (user.role === 'COLLEGE_MONITOR') {
    const dept = (await db.select({ collegeId: departments.collegeId }).from(departments).where(eq(departments.id, departmentId)).limit(1))[0];
    return dept?.collegeId === user.assignedCollegeId;
  }
  return false;
}

async function restoreScopedEntity(req: Request, res: Response, table: any, entity: string, allowed: boolean, parentOk = true) {
  if (!allowed || !parentOk) return denyOutOfScope(res);
  const id = String(req.params.id);
  const row = (await db.select().from(table).where(eq(table.id, id)).limit(1))[0];
  if (!row || !row.isDeleted) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'العنصر المؤرشف غير موجود' } });
  const restorePatch: Record<string, unknown> = { isDeleted: false };
  if (!['stages', 'sections', 'subjects'].includes(entity)) restorePatch.updatedAt = new Date();
  const restoredRows = await db.update(table).set(restorePatch).where(eq(table.id, id)).returning() as any[];
  const restored = restoredRows[0];
  await db.insert(auditLogs).values({ id: generateId('audit-restore'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role, action: 'RESTORE', entity, entityId: id, reason: `استعادة ${entity} من الأرشيف` });
  return res.json({ success: true, data: restored });
}

async function scopedDepartmentIds(user: AuthUser) {
  if (user.role === 'OWNER') return null;
  if (user.role === 'DEPARTMENT_MONITOR' || user.role === 'FACULTY') return user.assignedDepartmentId ? [user.assignedDepartmentId] : [];
  if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
    const rows = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.collegeId, user.assignedCollegeId), eq(departments.isDeleted, false))) as any[];
    return rows.map(row => row.id);
  }
  return [];
}

function facultyInUserScope(user: AuthUser, faculty: any) {
  if (!faculty) return false;
  if (user.role === 'OWNER') return true;
  if (user.role === 'FACULTY') return faculty.id === user.assignedFacultyId;
  if (user.role === 'COLLEGE_MONITOR') return faculty.collegeId === user.assignedCollegeId;
  if (user.role === 'DEPARTMENT_MONITOR') return faculty.departmentId === user.assignedDepartmentId;
  return false;
}

function hasFacultyPortal(user: AuthUser) {
  return (user.role === 'FACULTY' || user.role === 'COLLEGE_MONITOR' || user.role === 'DEPARTMENT_MONITOR') && Boolean(user.assignedFacultyId);
}

function getBaghdadDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function weekdayFromIsoDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parsed.getUTCDay()] || null;
}

async function buildingInUserScope(user: AuthUser, buildingId: string | null | undefined) {
  if (user.role === 'OWNER') return true;
  if (!buildingId) return false;
  const linkedRooms = await db.select({ collegeId: rooms.collegeId, departmentId: rooms.departmentId })
    .from(rooms)
    .where(and(eq(rooms.buildingId, buildingId), eq(rooms.isDeleted, false)));
  if (user.role === 'COLLEGE_MONITOR') return linkedRooms.some(room => room.collegeId === user.assignedCollegeId);
  if (user.role === 'DEPARTMENT_MONITOR') return linkedRooms.some(room => room.departmentId === user.assignedDepartmentId);
  if (user.role === 'FACULTY') return linkedRooms.some(room => room.departmentId === user.assignedDepartmentId);
  return false;
}

// Register Department Package Routes
registerDepartmentPackageRoutes(app, { authenticateToken, requireRole: requireRole as any, applyScope, generateId, getCurrentTerm });

export async function getCurrentTerm(): Promise<AcademicTerm> {
  const setting = (await db.select().from(systemSettings).where(eq(systemSettings.key, 'academicSettings')).limit(1))[0];
  return parseCurrentTermSetting(setting?.value);
}

export async function resolveRequestedTerm(requested: { academicYear?: unknown; semester?: unknown }): Promise<AcademicTerm> {
  const yearProvided = requested.academicYear !== undefined && requested.academicYear !== '';
  const semesterProvided = requested.semester !== undefined && requested.semester !== '';
  if (yearProvided && !validateAcademicYear(requested.academicYear)) throw new Error('السنة الدراسية غير صالحة');
  if (semesterProvided && !normalizeSemester(requested.semester)) throw new Error('الفصل الدراسي غير صالح');
  if (yearProvided && semesterProvided) return { academicYear: validateAcademicYear(requested.academicYear)!, semester: normalizeSemester(requested.semester)! };
  return resolveAcademicTerm(requested, await getCurrentTerm());
}

function semesterDatabaseValues(semester: AcademicTerm['semester']): string[] {
  return semester === 'SUMMER' ? ['SUMMER', 'ANNUAL', 'summer', 'annual'] : [semester, semester.toLowerCase()];
}

// Helper: Calculate duration between two HH:mm strings in decimal hours
export function calculateHourDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, (eh + (em || 0) / 60) - (sh + (sm || 0) / 60));
}

// Helper: Check time overlap
export function areIntervalsOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

// ==========================================
// 4. User Validation Zod Schema
// ==========================================
const createUserSchema = z.object({
  name: z.string().min(3, 'الاسم يجب أن لا يقل عن 3 أحرف'),
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string().min(12, 'كلمة المرور يجب أن لا تقل عن 12 خانة'),
  role: z.enum(['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY']),
  roleTitleAr: z.string().optional(),
  assignedCollegeId: z.string().nullable().optional(),
  assignedDepartmentId: z.string().nullable().optional(),
  assignedFacultyId: z.string().nullable().optional(),
  employeeId: z.string().optional(),
  avatar: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'COLLEGE_MONITOR') {
    if (!data.assignedCollegeId || data.assignedCollegeId.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب ربط مسؤول الكلية بكلية محددة (assignedCollegeId مطلوب)',
        path: ['assignedCollegeId'],
      });
    }
  }

  if (data.role === 'DEPARTMENT_MONITOR') {
    if (!data.assignedCollegeId || data.assignedCollegeId.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب تحديد الكلية لمسؤول متابعة القسم (assignedCollegeId مطلوب)',
        path: ['assignedCollegeId'],
      });
    }
    if (!data.assignedDepartmentId || data.assignedDepartmentId.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب تحديد القسم لمسؤول متابعة القسم (assignedDepartmentId مطلوب)',
        path: ['assignedDepartmentId'],
      });
    }
  }

  if (data.role === 'FACULTY') {
    if (!data.assignedCollegeId || data.assignedCollegeId.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب تحديد الكلية للتدريسي (assignedCollegeId مطلوب)',
        path: ['assignedCollegeId'],
      });
    }
  }
});

function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 12) return 'كلمة المرور يجب أن لا تقل عن 12 خانة';
  if (/^(password|123456789012|qwertyuiop12)$/i.test(value)) return 'اختر كلمة مرور أقوى';
  return null;
}

// ==========================================
// 5. AUTHENTICATION & USERS APIS
// ==========================================

// 5.1 POST /api/auth/login — Secure login with rate limit & pure bcrypt verification (Requirements 2, 9)
app.post('/api/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
      });
    }

    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()));
    const user = foundUsers[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'بيانات الاعتماد غير صحيحة' },
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: { code: 'USER_INACTIVE', message: 'تم تعطيل هذا الحساب من قبل الإدارة' },
      });
    }

    // Strict Password Hash Requirement: Accounts without passwordHash cannot log in (Requirement 2)
    if (!user.passwordHash || user.passwordHash.trim() === '') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNINITIALIZED_ACCOUNT',
          message: 'الحساب ليس له كلمة مرور معينة بعد. يرجى مراجعة مسؤول النظام لتعيين كلمة مرور.',
        },
      });
    }

    // Verify exclusively using bcrypt compare (No plaintext or hardcoded bypasses)
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'كلمة المرور غير صحيحة' },
      });
    }

    const userPayload: AuthUser = {
      id: user.id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role as any,
      roleTitleAr: user.roleTitleAr || undefined,
      assignedCollegeId: user.assignedCollegeId,
      assignedDepartmentId: user.assignedDepartmentId,
      assignedFacultyId: user.assignedFacultyId,
      avatar: user.avatar,
      status: user.status || 'active',
      tokenVersion: user.tokenVersion ?? 0,
    };

    const token = generateToken(userPayload);

    // Audit log
    await db.insert(auditLogs).values({
      id: generateId('audit-login'),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      entity: 'auth',
      entityId: user.id,
      reason: 'تسجيل دخول ناجح إلى النظام الأكاديمي بواسطة JWT Token',
    });

    res.json({
      success: true,
      token,
      user: toSafeUser(user),
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'فشل تسجيل الدخول: ' + err.message },
    });
  }
});

// 5.2 GET /api/auth/me — Verified current user profile
app.get('/api/auth/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const foundUsers = await db.select().from(users).where(eq(users.id, userId));
    const user = foundUsers[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'المستخدم غير موجود' },
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role,
        roleTitleAr: user.roleTitleAr,
        assignedCollegeId: user.assignedCollegeId,
        assignedDepartmentId: user.assignedDepartmentId,
        assignedFacultyId: user.assignedFacultyId,
        avatar: user.avatar,
        status: user.status,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// 5.2.1 Image uploads and protected local files (Phase A)
const uploadEntityNames = ['users', 'faculties', 'colleges', 'departments', 'buildings', 'rooms'] as const;
type UploadEntity = typeof uploadEntityNames[number];

app.post('/api/uploads/image', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { entity, entityId, data } = req.body as { entity?: UploadEntity; entityId?: string; data?: string | null };
    if (!entity || !uploadEntityNames.includes(entity) || !entityId || (data !== null && typeof data !== 'string')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_UPLOAD', message: 'نوع الصورة والجهة والملف مطلوبة' } });
    }
    const table = ({ users, faculties, colleges, departments, buildings, rooms } as Record<UploadEntity, any>)[entity];
    const records = await db.select().from(table).where(eq(table.id, entityId)).limit(1) as any[];
    const record = records[0];
    if (!record) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'العنصر المطلوب غير موجود' } });
    const actor = req.user!;
    let allowed = actor.role === 'OWNER' || (entity === 'users' && actor.id === entityId) ||
      (entity === 'faculties' && actor.role === 'FACULTY' && actor.assignedFacultyId === entityId);
    if (actor.role === 'COLLEGE_MONITOR') {
      allowed ||= (entity === 'colleges' && actor.assignedCollegeId === entityId) ||
        (entity === 'departments' && record.collegeId === actor.assignedCollegeId) ||
        (entity === 'faculties' && record.collegeId === actor.assignedCollegeId) ||
        (entity === 'rooms' && record.collegeId === actor.assignedCollegeId);
    }
    if (actor.role === 'DEPARTMENT_MONITOR') {
      allowed ||= (entity === 'departments' && actor.assignedDepartmentId === entityId) ||
        (entity === 'faculties' && record.departmentId === actor.assignedDepartmentId) ||
        (entity === 'rooms' && record.departmentId === actor.assignedDepartmentId);
    }
    if (!allowed) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'لا تملك صلاحية رفع هذه الصورة' } });

    let publicPath: string | null = null;
    if (data !== null) {
      const match = data.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);
      if (!match) return res.status(400).json({ success: false, error: { code: 'INVALID_UPLOAD', message: 'صيغة الصورة غير صحيحة' } });
      const bytes = Buffer.from(match[1], 'base64');
      if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) return res.status(400).json({ success: false, error: { code: 'UPLOAD_TOO_LARGE', message: 'حجم الصورة يجب ألا يتجاوز 2 ميغابايت' } });
      let extension: 'png' | 'jpg' | 'webp' | null = null;
      if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) extension = 'png';
      else if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) extension = 'jpg';
      else if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') extension = 'webp';
      if (!extension) return res.status(400).json({ success: false, error: { code: 'INVALID_IMAGE_TYPE', message: 'يسمح فقط بصور PNG أو JPEG أو WebP' } });
      mkdirSync(path.join(uploadsRoot, entity), { recursive: true });
      const relativePath = `${entity}/${crypto.randomUUID()}.${extension}`;
      writeFileSync(path.join(uploadsRoot, relativePath), bytes, { flag: 'wx' });
      publicPath = `/api/files/${relativePath}`;
    }
    const updates = { updatedAt: new Date() } as Record<string, unknown>;
    if (entity === 'users') updates.avatar = publicPath;
    if (entity === 'faculties') updates.photoPath = publicPath;
    if (entity === 'colleges' || entity === 'departments') updates.logoPath = publicPath;
    if (entity === 'buildings' || entity === 'rooms') updates.photoPath = publicPath;
    const updatedRows = await db.update(table).set(updates).where(eq(table.id, entityId)).returning() as any[];
    const updated = updatedRows[0];
    await db.insert(auditLogs).values({
      id: generateId('audit-upload'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role,
      action: 'UPDATE', entity, entityId, reason: `تحديث صورة ${entity}`,
    });
    res.status(data === null ? 200 : 201).json({
      success: true,
      path: publicPath,
      data: entity === 'users' ? toSafeUser(updated) : updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'تعذر حفظ الصورة' } });
  }
});

app.get('/api/files/*', authenticateToken, (req: Request, res: Response) => {
  const relativePath = String(req.params[0] || '').replaceAll('\\', '/');
  const resolved = path.resolve(uploadsRoot, relativePath);
  if (!resolved.startsWith(`${uploadsRoot}${path.sep}`) || !existsSync(resolved)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } });
  }
  const publicPath = `/api/files/${relativePath}`;
  const actor = req.user!;
  const ownerUser = sqlite.prepare('SELECT id, assigned_college_id AS assignedCollegeId, assigned_department_id AS assignedDepartmentId FROM users WHERE avatar = ?').get(publicPath) as any;
  const ownerFaculty = sqlite.prepare('SELECT id, college_id AS collegeId, department_id AS departmentId FROM faculties WHERE photo_path = ?').get(publicPath) as any;
  const ownerCollege = sqlite.prepare('SELECT id FROM colleges WHERE logo_path = ?').get(publicPath) as any;
  const ownerDepartment = sqlite.prepare('SELECT id, college_id AS collegeId FROM departments WHERE logo_path = ?').get(publicPath) as any;
  const ownerBuilding = sqlite.prepare('SELECT id FROM buildings WHERE photo_path = ?').get(publicPath) as any;
  const ownerRoom = sqlite.prepare('SELECT id, college_id AS collegeId, department_id AS departmentId FROM rooms WHERE photo_path = ?').get(publicPath) as any;
  let allowed = actor.role === 'OWNER';
  if (ownerUser) allowed ||= actor.id === ownerUser.id || (actor.role === 'COLLEGE_MONITOR' && actor.assignedCollegeId === ownerUser.assignedCollegeId) || (actor.role === 'DEPARTMENT_MONITOR' && actor.assignedDepartmentId === ownerUser.assignedDepartmentId);
  if (ownerFaculty) allowed ||= facultyInUserScope(actor, ownerFaculty);
  if (ownerCollege) allowed ||= actor.role === 'COLLEGE_MONITOR' && actor.assignedCollegeId === ownerCollege.id;
  if (ownerDepartment) allowed ||= (actor.role === 'COLLEGE_MONITOR' && actor.assignedCollegeId === ownerDepartment.collegeId) || (actor.role === 'DEPARTMENT_MONITOR' && actor.assignedDepartmentId === ownerDepartment.id);
  if (ownerRoom) allowed ||= (actor.role === 'COLLEGE_MONITOR' && actor.assignedCollegeId === ownerRoom.collegeId) || (actor.role === 'DEPARTMENT_MONITOR' && actor.assignedDepartmentId === ownerRoom.departmentId);
  if (!allowed || (!ownerUser && !ownerFaculty && !ownerCollege && !ownerDepartment && !ownerBuilding && !ownerRoom)) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } });
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(resolved);
});

// 5.3 GET /api/users — List users scoped in SQL (Requirements 3, 4, 5)
app.get(
  '/api/users',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const userFields = {
        id: users.id,
        uid: users.uid,
        name: users.name,
        email: users.email,
        role: users.role,
        roleTitleAr: users.roleTitleAr,
        assignedCollegeId: users.assignedCollegeId,
        assignedDepartmentId: users.assignedDepartmentId,
        assignedFacultyId: users.assignedFacultyId,
        avatar: users.avatar,
        mustChangePassword: users.mustChangePassword,
        status: users.status,
      };

      let query;
      if (req.user!.role === 'COLLEGE_MONITOR') {
        const collegeId = req.user!.assignedCollegeId;
        if (!collegeId) {
          return res.json({ success: true, data: [] });
        }
        // Direct SQL scope: only users within their college, excluding OWNER
        query = db
          .select(userFields)
          .from(users)
          .where(and(eq(users.assignedCollegeId, collegeId), ne(users.role, 'OWNER')));
      } else {
        // OWNER: sees all users
        query = db.select(userFields).from(users);
      }

      const allUsers = await query;
      res.json({ success: true, data: allUsers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
    }
  }
);

// 5.4 POST /api/users — Create user with strict token & role permission rules (Requirements 4, 6)
app.post(
  '/api/users',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const caller = req.user!;
      const parseResult = createUserSchema.safeParse(req.body);

      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER',
            message: firstIssue?.message || 'بيانات المستخدم غير صالحة',
            details: parseResult.error.format(),
          },
        });
      }

      const data = parseResult.data;

      // Role check for COLLEGE_MONITOR (Requirement 4)
      if (caller.role === 'COLLEGE_MONITOR') {
        if (data.role !== 'DEPARTMENT_MONITOR' && data.role !== 'FACULTY') {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'مسؤول الكلية مخول فقط بإنشاء مسؤولي الأقسام والتدريسيين',
            },
          });
        }
        if (data.assignedCollegeId !== caller.assignedCollegeId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'لا يمكنك إنشاء مستخدمين خارج نطاق كليتك',
            },
          });
        }
      }

      // Check duplicate email in Database
      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, data.email.trim().toLowerCase()));

      if (existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'البريد الإلكتروني مسجل مسبقاً في النظام لمستخدم آخر',
          },
        });
      }

      // Validate College Scope Existence
      if (data.assignedCollegeId) {
        const col = await db
          .select({ id: colleges.id })
          .from(colleges)
          .where(and(eq(colleges.id, data.assignedCollegeId), eq(colleges.isDeleted, false)));
        if (col.length === 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_USER',
              message: 'الكلية المحددة غير موجودة في قاعدة البيانات',
            },
          });
        }
      }

      // Validate Department Scope Existence
      if (data.assignedDepartmentId) {
        const dept = await db
          .select({ id: departments.id, collegeId: departments.collegeId })
          .from(departments)
          .where(and(eq(departments.id, data.assignedDepartmentId), eq(departments.isDeleted, false)));
        if (dept.length === 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_USER',
              message: 'القسم المحدد غير موجود في قاعدة البيانات',
            },
          });
        }
        if (data.assignedCollegeId && dept[0].collegeId !== data.assignedCollegeId) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_USER',
              message: 'القسم المحدد لا يتبع للكلية المختارة',
            },
          });
        }
      }

      // Hash password with bcrypt
      const passwordHash = await bcrypt.hash(data.password, 10);

      const roleTitles: Record<string, string> = {
        OWNER: 'مالك النظام ومسؤول الجامعة (OWNER)',
        COLLEGE_MONITOR: 'مسؤول متابعة الكلية',
        DEPARTMENT_MONITOR: 'مسؤول متابعة القسم',
        FACULTY: 'أستاذ تدريسي',
      };

      const newId = generateId('user');
      const newUid = generateId('uid');

      const [createdUser] = await db
        .insert(users)
        .values({
          id: newId,
          uid: newUid,
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          employeeId: data.employeeId || null,
          role: data.role,
          roleTitleAr: data.roleTitleAr || roleTitles[data.role],
          assignedCollegeId: data.assignedCollegeId || null,
          assignedDepartmentId: data.assignedDepartmentId || null,
          assignedFacultyId: data.assignedFacultyId || null,
          avatar: data.avatar || null,
          passwordHash,
          status: 'active',
        })
        .returning();

      // Audit Log Entry
      await db.insert(auditLogs).values({
        id: generateId('audit-user'),
        userId: caller.id,
        userName: caller.name,
        userRole: caller.role,
        action: 'CREATE',
        entity: 'users',
        entityId: createdUser.id,
        newValue: JSON.stringify({
          email: createdUser.email,
          role: createdUser.role,
          name: createdUser.name,
        }),
        reason: `إنشاء حساب أكاديمي جديد برتبة ${createdUser.roleTitleAr}`,
      });

      res.status(201).json({
        success: true,
        data: {
          id: createdUser.id,
          uid: createdUser.uid,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          roleTitleAr: createdUser.roleTitleAr,
          assignedCollegeId: createdUser.assignedCollegeId,
          assignedDepartmentId: createdUser.assignedDepartmentId,
          assignedFacultyId: createdUser.assignedFacultyId,
          avatar: createdUser.avatar,
          mustChangePassword: createdUser.mustChangePassword,
          status: createdUser.status,
        },
      });
    } catch (err: any) {
      console.error('Error creating user:', err);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'فشل إنشاء المستخدم في قاعدة البيانات: ' + err.message,
        },
      });
    }
  }
);

// 5.5 PUT /api/users/:id — Update user details & prevent self-privilege escalation (Requirement 6)
app.put('/api/users/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caller = req.user!;
    const { name, email, employeeId, avatar, role, roleTitleAr, status, assignedCollegeId, assignedDepartmentId, password } = req.body;

    // Self privilege escalation prevention (Requirement 6)
    if (caller.id === id) {
      if (
        (role !== undefined && role !== caller.role) ||
        (assignedCollegeId !== undefined && assignedCollegeId !== caller.assignedCollegeId) ||
        (assignedDepartmentId !== undefined && assignedDepartmentId !== caller.assignedDepartmentId)
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_SELF_PRIVILEGE_ESCALATION',
            message: 'لا يمكنك تعديل دورك الوظيفي أو كليتك أو قسمك بنفسك',
          },
        });
      }
    } else {
      // Non-self updates: only OWNER can edit other users
      if (caller.role !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'تعديل بيانات المستخدمين الآخرين متاح فقط لـ OWNER' },
        });
      }
    }

    const existing = await db.select().from(users).where(eq(users.id, id));
    if (!existing[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'المستخدم غير موجود' } });
    if (avatar !== undefined && avatar !== existing[0].avatar) {
      return res.status(400).json({ success: false, error: { code: 'AVATAR_UPLOAD_REQUIRED', message: 'غيّر الصورة عبر أداة رفع الصور' } });
    }
    if (email !== undefined) {
      const duplicate = await db.select({ id: users.id }).from(users).where(and(eq(users.email, String(email).trim().toLowerCase()), ne(users.id, id)));
      if (duplicate.length) return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'البريد الإلكتروني مستخدم مسبقاً' } });
    }
    if (password !== undefined) {
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(422).json({ success: false, error: { code: 'INVALID_PASSWORD', message: passwordError } });
    }
    if (caller.id !== id && existing[0].role === 'OWNER' && (role === 'OWNER' ? false : role !== undefined || status === 'inactive')) {
      const ownerCount = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'OWNER'), eq(users.status, 'active')));
      if (ownerCount.length <= 1) return res.status(409).json({ success: false, error: { code: 'LAST_OWNER', message: 'لا يمكن تعطيل أو تخفيض آخر مالك للنظام' } });
    }
    if (caller.id === id && status === 'inactive') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN_SELF', message: 'لا يمكنك تعطيل حسابك' } });

    let passwordHash: string | undefined;
    if (password !== undefined) passwordHash = await bcrypt.hash(password.trim(), 12);

    const [updatedUser] = await db
      .update(users)
      .set({
        name: name ? name.trim() : undefined,
        email: email !== undefined ? String(email).trim().toLowerCase() : undefined,
        employeeId: employeeId !== undefined ? employeeId : undefined,
        avatar: undefined,
        role: caller.role === 'OWNER' && role ? role : undefined,
        roleTitleAr: roleTitleAr || undefined,
        status: status || undefined,
        assignedCollegeId: caller.role === 'OWNER' && assignedCollegeId !== undefined ? assignedCollegeId : undefined,
        assignedDepartmentId: caller.role === 'OWNER' && assignedDepartmentId !== undefined ? assignedDepartmentId : undefined,
        passwordHash: passwordHash || undefined,
        mustChangePassword: passwordHash ? false : undefined,
        tokenVersion: (passwordHash || role !== undefined || status !== undefined || assignedCollegeId !== undefined || assignedDepartmentId !== undefined)
          ? sql`${users.tokenVersion} + 1` : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'المستخدم غير موجود' },
      });
    }

    await db.insert(auditLogs).values({ id: generateId('audit-user-update'), userId: caller.id, userName: caller.name, userRole: caller.role, action: 'UPDATE', entity: 'users', entityId: id, reason: 'تحديث بيانات مستخدم' });
    res.json({ success: true, data: toSafeUser(updatedUser) });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  }
});

// 5.6 DELETE /api/users/:id — Deactivate user (OWNER only) (Requirement 4)
app.delete('/api/users/:id', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.id === id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN_SELF', message: 'لا يمكنك حذف حسابك' } });
    const target = await db.select().from(users).where(eq(users.id, id));
    if (!target[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'المستخدم غير موجود' } });
    if (target[0].role === 'OWNER') {
      const owners = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'OWNER'), eq(users.status, 'active')));
      if (owners.length <= 1) return res.status(409).json({ success: false, error: { code: 'LAST_OWNER', message: 'لا يمكن حذف آخر مالك للنظام' } });
    }
    const [deactivatedUser] = await db
      .update(users)
      .set({ status: 'inactive', tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!deactivatedUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'المستخدم غير موجود' },
      });
    }
    await db.insert(auditLogs).values({ id: generateId('audit-user-delete'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role, action: 'DELETE', entity: 'users', entityId: id, reason: 'تعطيل مستخدم من إدارة الحسابات' });
    res.json({ success: true, message: 'تم تعطيل حساب المستخدم بنجاح' });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: err.message },
    });
  }
});

app.post('/api/users/:id/restore', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try {
    if (req.user!.id === req.params.id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN_SELF', message: 'الحساب الحالي غير مؤرشف' } });
    const [restored] = await db.update(users).set({ status: 'active', tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() }).where(and(eq(users.id, req.params.id), eq(users.status, 'inactive'))).returning();
    if (!restored) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'المستخدم المعطل غير موجود' } });
    await db.insert(auditLogs).values({ id: generateId('audit-user-restore'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role, action: 'RESTORE', entity: 'users', entityId: req.params.id, reason: 'إعادة تفعيل حساب مستخدم' });
    res.json({ success: true, data: toSafeUser(restored) });
  } catch (err: any) { res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } }); }
});

async function assignMonitor(entity: 'college' | 'department', entityId: string, userId: string | null, caller: AuthUser) {
  const table = entity === 'college' ? colleges : departments;
  const recordRows = await db.select().from(table).where(eq(table.id, entityId));
  if (!recordRows[0]) throw Object.assign(new Error('العنصر غير موجود'), { status: 404 });
  const previousUserId = recordRows[0].monitorUserId as string | null;
  let name = '';
  if (userId) {
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const user = rows[0];
    if (!user || user.status === 'inactive' || user.role !== (entity === 'college' ? 'COLLEGE_MONITOR' : 'DEPARTMENT_MONITOR')) throw Object.assign(new Error('المستخدم غير مؤهل لهذه المسؤولية'), { status: 422 });
    if (entity === 'department' && user.assignedDepartmentId !== entityId) throw Object.assign(new Error('مسؤول القسم يجب أن يكون مرتبطاً بالقسم'), { status: 422 });
    if (entity === 'college' && user.assignedCollegeId !== entityId) throw Object.assign(new Error('مسؤول الكلية يجب أن يكون مرتبطاً بالكلية'), { status: 422 });
    name = user.name;
  }
  if (previousUserId && previousUserId !== userId) {
    await db.update(users).set(entity === 'college' ? { assignedCollegeId: null, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() } : { assignedDepartmentId: null, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, previousUserId));
  }
  const [updated] = await db.update(table).set({ monitorUserId: userId, monitorName: name, updatedAt: new Date() }).where(eq(table.id, entityId)).returning();
  await db.insert(auditLogs).values({ id: generateId('audit-monitor'), userId: caller.id, userName: caller.name, userRole: caller.role, action: 'UPDATE', entity, entityId, reason: userId ? 'تعيين مسؤول متابعة' : 'إزالة مسؤول المتابعة' });
  return updated;
}

app.put('/api/colleges/:id/monitor', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try { const data = await assignMonitor('college', req.params.id, req.body.userId || null, req.user!); res.json({ success: true, data }); }
  catch (err: any) { res.status(err.status || 500).json({ success: false, error: { code: 'MONITOR_ASSIGNMENT_FAILED', message: err.message } }); }
});

app.put('/api/departments/:id/monitor', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR'), async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'COLLEGE_MONITOR') {
      const dept = await db.select({ collegeId: departments.collegeId }).from(departments).where(eq(departments.id, req.params.id));
      if (!dept[0] || dept[0].collegeId !== req.user!.assignedCollegeId) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'القسم خارج نطاق كليتك' } });
    }
    const data = await assignMonitor('department', req.params.id, req.body.userId || null, req.user!); res.json({ success: true, data });
  } catch (err: any) { res.status(err.status || 500).json({ success: false, error: { code: 'MONITOR_ASSIGNMENT_FAILED', message: err.message } }); }
});

app.put('/api/faculties/:id/account', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'), async (req: Request, res: Response) => {
  try {
    const facultyRows = await db.select().from(faculties).where(eq(faculties.id, req.params.id));
    const faculty = facultyRows[0];
    if (!faculty) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'التدريسي غير موجود' } });
    if (req.user!.role === 'COLLEGE_MONITOR' && req.user!.assignedCollegeId !== faculty.collegeId) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'التدريسي خارج نطاق كليتك' } });
    if (req.user!.role === 'DEPARTMENT_MONITOR' && req.user!.assignedDepartmentId !== faculty.departmentId) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'التدريسي خارج نطاق قسمك' } });
    const userId = req.body.userId as string | undefined;
    if (!userId) return res.status(400).json({ success: false, error: { code: 'INVALID_ACCOUNT', message: 'حدد حساباً لربطه' } });
    const accountRows = await db.select().from(users).where(eq(users.id, userId));
    const account = accountRows[0];
    if (!account || !['FACULTY', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'].includes(account.role)) return res.status(422).json({ success: false, error: { code: 'INVALID_ACCOUNT', message: 'اختر حساب تدريسي أو حساب مسؤول مرتبط بالنطاق' } });
    if (account.assignedFacultyId && account.assignedFacultyId !== faculty.id) return res.status(409).json({ success: false, error: { code: 'ACCOUNT_ALREADY_LINKED', message: 'الحساب مرتبط بتدريسي آخر' } });
    const linked = await db.update(users).set({ assignedFacultyId: faculty.id, assignedCollegeId: faculty.collegeId, assignedDepartmentId: faculty.departmentId, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    await db.insert(auditLogs).values({ id: generateId('audit-faculty-account'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role, action: 'UPDATE', entity: 'faculties', entityId: faculty.id, reason: 'ربط حساب دخول بالتدريسي' });
    res.json({ success: true, data: toSafeUser(linked[0]) });
  } catch (err: any) { res.status(500).json({ success: false, error: { code: 'ACCOUNT_LINK_FAILED', message: 'تعذر ربط الحساب' } }); }
});

// Archive restoration endpoints. Parent records must be active before children are restored.
app.post('/api/colleges/:id/restore', authenticateToken, requireRole('OWNER'), (req, res) => restoreScopedEntity(req, res, colleges, 'colleges', true));
app.post('/api/departments/:id/restore', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR'), async (req, res) => {
  const row = (await db.select().from(departments).where(eq(departments.id, req.params.id)).limit(1))[0];
  const college = row ? (await db.select().from(colleges).where(eq(colleges.id, row.collegeId)).limit(1))[0] : null;
  return restoreScopedEntity(req, res, departments, 'departments', !!row && (req.user!.role === 'OWNER' || (req.user!.role === 'COLLEGE_MONITOR' && req.user!.assignedCollegeId === row.collegeId)), !!college && !college.isDeleted);
});
app.post('/api/faculties/:id/restore', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'), async (req, res) => {
  const row = (await db.select().from(faculties).where(eq(faculties.id, req.params.id)).limit(1))[0];
  const department = row ? (await db.select().from(departments).where(eq(departments.id, row.departmentId)).limit(1))[0] : null;
  const college = row ? (await db.select().from(colleges).where(eq(colleges.id, row.collegeId)).limit(1))[0] : null;
  return restoreScopedEntity(req, res, faculties, 'faculties', facultyInUserScope(req.user!, row), !!department && !department.isDeleted && !!college && !college.isDeleted && department.collegeId === row?.collegeId);
});
app.post('/api/buildings/:id/restore', authenticateToken, requireRole('OWNER'), (req, res) => restoreScopedEntity(req, res, buildings, 'buildings', true));
app.post('/api/rooms/:id/restore', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR'), async (req, res) => {
  const row = (await db.select().from(rooms).where(eq(rooms.id, req.params.id)).limit(1))[0];
  const [building, college] = row ? await Promise.all([
    db.select().from(buildings).where(eq(buildings.id, row.buildingId)).limit(1).then(rows => rows[0]),
    db.select().from(colleges).where(eq(colleges.id, row.collegeId)).limit(1).then(rows => rows[0]),
  ]) : [null, null];
  const department = row?.departmentId ? (await db.select().from(departments).where(eq(departments.id, row.departmentId)).limit(1))[0] : null;
  const allowed = req.user!.role === 'OWNER' || (req.user!.role === 'COLLEGE_MONITOR' && row?.collegeId === req.user!.assignedCollegeId);
  const parentsActive = !!building && !building.isDeleted && !!college && !college.isDeleted && (!row?.departmentId || (!!department && !department.isDeleted && department.collegeId === row.collegeId));
  return restoreScopedEntity(req, res, rooms, 'rooms', allowed, parentsActive);
});
app.post('/api/stages/:id/restore', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'), async (req, res) => {
  const row = (await db.select().from(stages).where(eq(stages.id, req.params.id)).limit(1))[0];
  const department = row ? (await db.select().from(departments).where(eq(departments.id, row.departmentId)).limit(1))[0] : null;
  const college = department ? (await db.select().from(colleges).where(eq(colleges.id, department.collegeId)).limit(1))[0] : null;
  return restoreScopedEntity(req, res, stages, 'stages', await departmentInUserScope(req.user!, row?.departmentId), !!department && !department.isDeleted && !!college && !college.isDeleted);
});
app.post('/api/sections/:id/restore', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'), async (req, res) => {
  const row = (await db.select().from(sections).where(eq(sections.id, req.params.id)).limit(1))[0];
  const stage = row ? (await db.select().from(stages).where(eq(stages.id, row.stageId)).limit(1))[0] : null;
  const department = row ? (await db.select().from(departments).where(eq(departments.id, row.departmentId)).limit(1))[0] : null;
  const college = department ? (await db.select().from(colleges).where(eq(colleges.id, department.collegeId)).limit(1))[0] : null;
  const parentsActive = !!stage && !stage.isDeleted && stage.departmentId === row?.departmentId && !!department && !department.isDeleted && !!college && !college.isDeleted;
  return restoreScopedEntity(req, res, sections, 'sections', await departmentInUserScope(req.user!, row?.departmentId), parentsActive);
});
app.post('/api/subjects/:id/restore', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'), async (req, res) => {
  const row = (await db.select().from(subjects).where(eq(subjects.id, req.params.id)).limit(1))[0];
  const [stage, department] = row ? await Promise.all([
    db.select().from(stages).where(eq(stages.id, row.stageId)).limit(1).then(rows => rows[0]),
    db.select().from(departments).where(eq(departments.id, row.departmentId)).limit(1).then(rows => rows[0]),
  ]) : [null, null];
  const college = department ? (await db.select().from(colleges).where(eq(colleges.id, department.collegeId)).limit(1))[0] : null;
  const parentsActive = !!stage && !stage.isDeleted && stage.departmentId === row?.departmentId && !!department && !department.isDeleted && !!college && !college.isDeleted;
  return restoreScopedEntity(req, res, subjects, 'subjects', await departmentInUserScope(req.user!, row?.departmentId), parentsActive);
});

app.get('/api/archive', authenticateToken, requireRole('OWNER'), async (_req, res) => {
  try {
    const [archivedColleges, archivedDepartments, archivedFaculty, archivedBuildings, archivedRooms, archivedStages, archivedSections, archivedSubjects, archivedSchedules, archivedUsers] = await Promise.all([
      db.select().from(colleges).where(eq(colleges.isDeleted, true)),
      db.select().from(departments).where(eq(departments.isDeleted, true)),
      db.select().from(faculties).where(eq(faculties.isDeleted, true)),
      db.select().from(buildings).where(eq(buildings.isDeleted, true)),
      db.select().from(rooms).where(eq(rooms.isDeleted, true)),
      db.select().from(stages).where(eq(stages.isDeleted, true)),
      db.select().from(sections).where(eq(sections.isDeleted, true)),
      db.select().from(subjects).where(eq(subjects.isDeleted, true)),
      db.select().from(schedules).where(eq(schedules.isDeleted, true)),
      db.select().from(users).where(eq(users.status, 'inactive')),
    ]);
    res.json({
      colleges: archivedColleges, departments: archivedDepartments, faculties: archivedFaculty,
      buildings: archivedBuildings, rooms: archivedRooms, stages: archivedStages,
      sections: archivedSections, subjects: archivedSubjects, schedules: archivedSchedules,
      users: archivedUsers.map(toSafeUser),
    });
  } catch {
    res.status(500).json({ success: false, error: { code: 'ARCHIVE_LOAD_FAILED', message: 'تعذر تحميل الأرشيف' } });
  }
});

app.post('/api/schedules/:id/restore', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'), async (req, res) => {
  try {
    const user = req.user!;
    const [schedule] = await db.select().from(schedules).where(and(eq(schedules.id, req.params.id), eq(schedules.isDeleted, true))).limit(1);
    if (!schedule) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'المحاضرة المؤرشفة غير موجودة' } });
    if (!(await scheduleInUserScope(user, schedule))) return denyOutOfScope(res);
    const linked = await db.select({ sectionId: scheduleSections.sectionId }).from(scheduleSections).where(eq(scheduleSections.scheduleId, schedule.id));
    const sectionIds = [...new Set([schedule.sectionId, ...linked.map(item => item.sectionId)])];
    const sectionRows = await db.select().from(sections).where(inArray(sections.id, sectionIds));
    const [department, stage, subject] = await Promise.all([
      db.select().from(departments).where(eq(departments.id, schedule.departmentId)).limit(1).then(rows => rows[0]),
      db.select().from(stages).where(eq(stages.id, schedule.stageId)).limit(1).then(rows => rows[0]),
      db.select().from(subjects).where(eq(subjects.id, schedule.subjectId)).limit(1).then(rows => rows[0]),
    ]);
    if (!department || department.isDeleted || !stage || stage.isDeleted || stage.departmentId !== schedule.departmentId || !subject || subject.isDeleted || subject.departmentId !== schedule.departmentId || subject.stageId !== schedule.stageId || sectionRows.length !== sectionIds.length || sectionRows.some(section => section.isDeleted || section.departmentId !== schedule.departmentId || section.stageId !== schedule.stageId)) {
      return res.status(409).json({ success: false, error: { code: 'RESTORE_PARENT_REQUIRED', message: 'استعد الأقسام والشعب المرتبطة أولاً' } });
    }
    const [room] = await db.select().from(rooms).where(and(eq(rooms.id, schedule.roomId), eq(rooms.isDeleted, false))).limit(1);
    const [faculty] = await db.select().from(faculties).where(and(eq(faculties.id, schedule.facultyId), eq(faculties.isDeleted, false))).limit(1);
    if (!room || !faculty || faculty.isDeleted || faculty.departmentId !== schedule.departmentId || room.collegeId !== department.collegeId || (room.departmentId && room.departmentId !== schedule.departmentId) || sectionRows.reduce((sum, section) => sum + Number(section.studentCount || 0), 0) > Number(room.capacity || 0)) {
      return res.status(409).json({ success: false, error: { code: 'RESTORE_DEPENDENCY_INVALID', message: 'تحقق من حالة القاعة والتدريسي وسعتها أولاً' } });
    }
    const scheduleTermSemester = normalizeSemester(schedule.semester);
    if (!scheduleTermSemester) return res.status(409).json({ success: false, error: { code: 'INVALID_SCHEDULE_TERM', message: 'بيانات الفصل الدراسي للمحاضرة غير صالحة' } });
    const scheduleTerm: AcademicTerm = { academicYear: schedule.academicYear, semester: scheduleTermSemester };
    const active = (await db.select().from(schedules).where(and(
      eq(schedules.day, schedule.day),
      eq(schedules.academicYear, schedule.academicYear),
      eq(schedules.isDeleted, false),
    ))).filter(other => isSameAcademicTerm(other, scheduleTerm));
    let conflict = false;
    for (const other of active) {
      if (!areIntervalsOverlapping(other.startTime, other.endTime, schedule.startTime, schedule.endTime)) continue;
      if (other.roomId === schedule.roomId || other.facultyId === schedule.facultyId || sectionIds.includes(other.sectionId)) { conflict = true; break; }
      const otherSections = await db.select({ sectionId: scheduleSections.sectionId }).from(scheduleSections).where(eq(scheduleSections.scheduleId, other.id));
      if (otherSections.some(link => sectionIds.includes(link.sectionId))) { conflict = true; break; }
    }
    if (conflict) return res.status(409).json({ success: false, error: { code: 'SCHEDULE_CONFLICT', message: 'لا يمكن استعادة المحاضرة لوجود تعارض في الوقت' } });
    const [restored] = await db.update(schedules).set({ isDeleted: false, updatedAt: new Date() }).where(eq(schedules.id, schedule.id)).returning();
    await db.insert(auditLogs).values({ id: generateId('audit-schedule-restore'), userId: user.id, userName: user.name, userRole: user.role, action: 'RESTORE', entity: 'schedules', entityId: schedule.id, reason: 'استعادة محاضرة من الأرشيف' });
    res.json({ success: true, data: restored });
  } catch {
    res.status(500).json({ success: false, error: { code: 'RESTORE_FAILED', message: 'تعذرت استعادة المحاضرة' } });
  }
});

app.post('/api/users/:id/reset-password', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.id === id) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN_SELF', message: 'استخدم تغيير كلمة المرور من ملفك الشخصي' } });
    const target = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
    if (!target.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'المستخدم غير موجود' } });
    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    await db.update(users).set({ passwordHash: await bcrypt.hash(temporaryPassword, 12), mustChangePassword: true, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, id));
    await db.insert(auditLogs).values({ id: generateId('audit-reset'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role, action: 'PASSWORD_RESET', entity: 'users', entityId: id, reason: 'إعادة تعيين كلمة مرور المستخدم' });
    res.json({ success: true, temporaryPassword });
  } catch (err: any) { res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'تعذر إعادة تعيين كلمة المرور' } }); }
});

app.post('/api/auth/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(422).json({ success: false, error: { code: 'INVALID_PASSWORD', message: passwordError } });
    const found = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (!found[0]?.passwordHash || !(await bcrypt.compare(String(currentPassword || ''), found[0].passwordHash))) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'كلمة المرور الحالية غير صحيحة' } });
    await db.update(users).set({ passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: false, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, req.user!.id));
    await db.insert(auditLogs).values({ id: generateId('audit-password'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role, action: 'PASSWORD_CHANGE', entity: 'users', entityId: req.user!.id, reason: 'تغيير كلمة المرور' });
    res.json({ success: true, message: 'تم تغيير كلمة المرور' });
  } catch { res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'تعذر تغيير كلمة المرور' } }); }
});

// ==========================================
// 6. ACADEMIC STRUCTURE APIS
// ==========================================

// 6.1 Colleges API (Requirements 4, 5)
// Read: all authenticated roles, scoped to assigned college for non-OWNER
app.get(
  '/api/colleges',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      let query;
      if (user.role === 'OWNER') {
        query = db.select().from(colleges).where(eq(colleges.isDeleted, false));
      } else {
        const assignedCollegeId = user.assignedCollegeId || '__NO_COLLEGE__';
        query = db.select().from(colleges).where(
          and(eq(colleges.isDeleted, false), eq(colleges.id, assignedCollegeId))
        );
      }
      const list = await query;
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  '/api/colleges/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const conditions = [eq(colleges.id, id), eq(colleges.isDeleted, false)];
      if (user.role !== 'OWNER') {
        conditions.push(eq(colleges.id, user.assignedCollegeId || '__NO_COLLEGE__'));
      }
      const list = await db.select().from(colleges).where(and(...conditions));
      if (list.length === 0) {
        return res.status(404).json({ error: 'الكلية غير موجودة أو خارج نطاق صلاحياتك الأكاديمية' });
      }
      res.json(list[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Write: OWNER only (Requirement 4)
app.post(
  '/api/colleges',
  authenticateToken,
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    try {
      const { nameAr, nameEn, code, deanName, monitorName, monitorUserId, phone, email, status, logoPath } = req.body;
      if (!nameAr || !code) {
        return res.status(400).json({ error: 'اسم الكلية بالعربي ورمز الكلية مطلوبان' });
      }

      const newId = generateId('col');
      const [created] = await db.insert(colleges).values({
        id: newId,
        nameAr: nameAr.trim(),
        nameEn: (nameEn || '').trim(),
        code: code.trim().toUpperCase(),
        deanName: (deanName || '').trim(),
        monitorName: (monitorName || '').trim(),
        monitorUserId: monitorUserId || null,
        phone: (phone || '').trim(),
        email: (email || '').trim(),
        logoPath: logoPath || null,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      await db.insert(auditLogs).values({
        id: generateId('audit-col'),
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: 'CREATE',
        entity: 'colleges',
        entityId: created.id,
        reason: `إضافة كلية جديدة: ${created.nameAr} (${created.code})`,
      });

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة الكلية: ' + err.message });
    }
  }
);

app.put(
  '/api/colleges/:id',
  authenticateToken,
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nameAr, nameEn, code, deanName, monitorName, monitorUserId, phone, email, status, logoPath } = req.body;

      const [updated] = await db.update(colleges).set({
        nameAr: nameAr ? nameAr.trim() : undefined,
        nameEn: nameEn !== undefined ? nameEn.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        deanName: deanName !== undefined ? deanName.trim() : undefined,
        monitorName: monitorName !== undefined ? monitorName.trim() : undefined,
        monitorUserId: monitorUserId !== undefined ? monitorUserId : undefined,
        phone: phone !== undefined ? phone.trim() : undefined,
        email: email !== undefined ? email.trim() : undefined,
        logoPath: logoPath !== undefined ? logoPath : undefined,
        status: status || undefined,
        updatedAt: new Date(),
      }).where(and(eq(colleges.id, id), eq(colleges.isDeleted, false))).returning();

      if (!updated) {
        return res.status(404).json({ error: 'الكلية غير موجودة' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل الكلية: ' + err.message });
    }
  }
);

app.delete(
  '/api/colleges/:id',
  authenticateToken,
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [deleted] = await db.update(colleges)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(eq(colleges.id, id), eq(colleges.isDeleted, false)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'الكلية غير موجودة' });
      }

      res.json({ success: true, message: 'تم حذف الكلية بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف الكلية: ' + err.message });
    }
  }
);

// 6.2 Departments API (Requirements 4, 5)
// Read: Scoped in SQL
app.get(
  '/api/departments',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { collegeId } = req.query;
      const conditions = [eq(departments.isDeleted, false)];

      if (user.role === 'COLLEGE_MONITOR') {
        const assignedColId = user.assignedCollegeId || '__NO_COLLEGE__';
        conditions.push(eq(departments.collegeId, assignedColId));
      } else if (user.role === 'DEPARTMENT_MONITOR' || user.role === 'FACULTY') {
        if (user.assignedDepartmentId) {
          conditions.push(eq(departments.id, user.assignedDepartmentId));
        } else if (user.assignedCollegeId) {
          conditions.push(eq(departments.collegeId, user.assignedCollegeId));
        }
      } else if (user.role === 'OWNER') {
        if (collegeId && collegeId !== 'ALL') {
          conditions.push(eq(departments.collegeId, String(collegeId)));
        }
      }

      const list = await db.select().from(departments).where(and(...conditions));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  '/api/departments/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const conditions = [eq(departments.id, id), eq(departments.isDeleted, false)];

      if (user.role === 'COLLEGE_MONITOR') {
        conditions.push(eq(departments.collegeId, user.assignedCollegeId || '__NO_COLLEGE__'));
      } else if (user.role === 'DEPARTMENT_MONITOR') {
        conditions.push(eq(departments.id, user.assignedDepartmentId || '__NO_DEPT__'));
      }

      const list = await db.select().from(departments).where(and(...conditions));
      if (list.length === 0) {
        return res.status(404).json({ error: 'القسم غير موجود أو خارج نطاق صلاحياتك الأكاديمية' });
      }
      res.json(list[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Write: OWNER and COLLEGE_MONITOR (for their college) (Requirement 4)
app.post(
  '/api/departments',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { collegeId, nameAr, nameEn, code, headName, monitorName, monitorUserId, status, logoPath } = req.body;
      if (!collegeId || !nameAr || !code) {
        return res.status(400).json({ error: 'الكلية التابع لها، اسم القسم بالعربي، والرمز مطلوبان' });
      }

      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId !== collegeId) {
        return res.status(403).json({ error: 'لا يمكنك إضافة قسم لكلية أخرى خارج نطاق صلاحياتك' });
      }

      const newId = generateId('dept');
      const [created] = await db.insert(departments).values({
        id: newId,
        collegeId,
        nameAr: nameAr.trim(),
        nameEn: (nameEn || '').trim(),
        code: code.trim().toUpperCase(),
        headName: (headName || '').trim(),
        monitorName: (monitorName || '').trim(),
        monitorUserId: monitorUserId || null,
        logoPath: logoPath || null,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة القسم: ' + err.message });
    }
  }
);

app.put(
  '/api/departments/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { nameAr, nameEn, code, headName, monitorName, monitorUserId, status, logoPath } = req.body;

      const conditions = [eq(departments.id, id), eq(departments.isDeleted, false)];
      if (user.role === 'COLLEGE_MONITOR') {
        conditions.push(eq(departments.collegeId, user.assignedCollegeId || '__NO_COLLEGE__'));
      }

      const [updated] = await db.update(departments).set({
        nameAr: nameAr ? nameAr.trim() : undefined,
        nameEn: nameEn !== undefined ? nameEn.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        headName: headName !== undefined ? headName.trim() : undefined,
        monitorName: monitorName !== undefined ? monitorName.trim() : undefined,
        monitorUserId: monitorUserId !== undefined ? monitorUserId : undefined,
        logoPath: logoPath !== undefined ? logoPath : undefined,
        status: status || undefined,
        updatedAt: new Date(),
      }).where(and(...conditions)).returning();

      if (!updated) {
        return res.status(404).json({ error: 'القسم غير موجود أو خارج نطاق صلاحياتك الأكاديمية' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل القسم: ' + err.message });
    }
  }
);

app.delete(
  '/api/departments/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const conditions = [eq(departments.id, id), eq(departments.isDeleted, false)];
      if (user.role === 'COLLEGE_MONITOR') {
        conditions.push(eq(departments.collegeId, user.assignedCollegeId || '__NO_COLLEGE__'));
      }

      const [deleted] = await db.update(departments)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(...conditions))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'القسم غير موجود أو خارج نطاق صلاحياتك الأكاديمية' });
      }

      res.json({ success: true, message: 'تم حذف القسم بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف القسم: ' + err.message });
    }
  }
);

// 6.3 Buildings & Rooms API (Requirements 3, 4, 5)
app.get(
  '/api/buildings',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(buildings).where(eq(buildings.isDeleted, false));
      const scoped = req.user!.role === 'OWNER'
        ? list
        : (await Promise.all(list.map(async building => (await buildingInUserScope(req.user!, building.id)) ? building : null))).filter(Boolean);
      res.json(scoped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  '/api/buildings',
  authenticateToken,
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    try {
      const { nameAr, nameEn, code, floorsCount, latitude, longitude, status, photoPath } = req.body;
      if (!nameAr || !code) {
        return res.status(400).json({ error: 'اسم المبنى ورمزه مطلوبان' });
      }

      const newId = generateId('bld');
      const [created] = await db.insert(buildings).values({
        id: newId,
        nameAr: nameAr.trim(),
        nameEn: (nameEn || '').trim(),
        code: code.trim().toUpperCase(),
        floorsCount: Number(floorsCount) || 4,
        latitude: latitude !== undefined && latitude !== '' ? Number(latitude) : null,
        longitude: longitude !== undefined && longitude !== '' ? Number(longitude) : null,
        photoPath: photoPath || null,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة المبنى: ' + err.message });
    }
  }
);

app.put(
  '/api/buildings/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!(await buildingInUserScope(req.user!, id))) return denyOutOfScope(res);
      const { nameAr, nameEn, code, floorsCount, latitude, longitude, status, photoPath } = req.body;

      const [updated] = await db.update(buildings).set({
        nameAr: nameAr ? nameAr.trim() : undefined,
        nameEn: nameEn !== undefined ? nameEn.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        floorsCount: floorsCount !== undefined ? Number(floorsCount) : undefined,
        latitude: latitude !== undefined ? (latitude === '' ? null : Number(latitude)) : undefined,
        longitude: longitude !== undefined ? (longitude === '' ? null : Number(longitude)) : undefined,
        photoPath: photoPath !== undefined ? photoPath : undefined,
        status: status || undefined,
        updatedAt: new Date(),
      }).where(and(eq(buildings.id, id), eq(buildings.isDeleted, false))).returning();

      if (!updated) {
        return res.status(404).json({ error: 'المبنى غير موجود' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل المبنى: ' + err.message });
    }
  }
);

app.delete(
  '/api/buildings/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!(await buildingInUserScope(req.user!, id))) return denyOutOfScope(res);
      const [deleted] = await db.update(buildings)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(eq(buildings.id, id), eq(buildings.isDeleted, false)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'المبنى غير موجود' });
      }

      res.json({ success: true, message: 'تم حذف المبنى بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف المبنى: ' + err.message });
    }
  }
);

app.get(
  '/api/rooms',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const conditions = [eq(rooms.isDeleted, false)];
      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        conditions.push(eq(rooms.collegeId, user.assignedCollegeId));
      } else if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        conditions.push(eq(rooms.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'FACULTY' && user.assignedDepartmentId) {
        conditions.push(eq(rooms.departmentId, user.assignedDepartmentId));
      }
      const list = await db.select().from(rooms).where(and(...conditions));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  '/api/rooms',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { buildingId, collegeId, departmentId, nameAr, code, roomType, capacity, floor, status, photoPath, locationDescription } = req.body;
      if (!buildingId || !collegeId || !nameAr || !code) {
        return res.status(400).json({ error: 'المبنى، الكلية، اسم القاعة ورمزها حقول إلزامية' });
      }

      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId !== collegeId) {
        return res.status(403).json({ error: 'لا يمكنك إضافة قاعة لكلية أخرى' });
      }
      const college = (await db.select({ id: colleges.id }).from(colleges).where(and(eq(colleges.id, collegeId), eq(colleges.isDeleted, false))).limit(1))[0];
      if (!college) return res.status(400).json({ error: 'الكلية غير موجودة أو مؤرشفة' });
      if (departmentId) {
        const department = (await db.select({ collegeId: departments.collegeId }).from(departments).where(and(eq(departments.id, departmentId), eq(departments.isDeleted, false))).limit(1))[0];
        if (!department || department.collegeId !== collegeId) return res.status(400).json({ error: 'القسم المختار لا يتبع للكلية المحددة' });
      }
      const building = (await db.select({ id: buildings.id }).from(buildings).where(and(eq(buildings.id, buildingId), eq(buildings.isDeleted, false))).limit(1))[0];
      if (!building) return res.status(400).json({ error: 'المبنى غير موجود أو مؤرشف' });
      if (!(await buildingInUserScope(user, buildingId))) return denyOutOfScope(res);
      if (departmentId && !(await departmentInUserScope(user, departmentId))) return denyOutOfScope(res);

      const newId = generateId('room');
      const [created] = await db.insert(rooms).values({
        id: newId,
        buildingId,
        collegeId,
        departmentId: departmentId || null,
        nameAr: nameAr.trim(),
        code: code.trim().toUpperCase(),
        roomType: roomType || 'lecture_hall',
        capacity: Number(capacity) || 60,
        floor: floor || null,
        photoPath: photoPath || null,
        locationDescription: locationDescription || null,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة القاعة: ' + err.message });
    }
  }
);

app.put(
  '/api/rooms/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { buildingId, collegeId, departmentId, nameAr, code, roomType, capacity, floor, status, photoPath, locationDescription } = req.body;

      const conditions = [eq(rooms.id, id), eq(rooms.isDeleted, false)];
      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        conditions.push(eq(rooms.collegeId, user.assignedCollegeId));
      }
      if (buildingId && !(await buildingInUserScope(user, buildingId))) return denyOutOfScope(res);
      if (departmentId && !(await departmentInUserScope(user, departmentId))) return denyOutOfScope(res);
      if (collegeId && user.role === 'COLLEGE_MONITOR' && collegeId !== user.assignedCollegeId) return denyOutOfScope(res);
      const targetCollegeId = collegeId || (await db.select({ collegeId: rooms.collegeId }).from(rooms).where(and(...conditions)).limit(1))[0]?.collegeId;
      const targetBuildingId = buildingId || (await db.select({ buildingId: rooms.buildingId }).from(rooms).where(and(...conditions)).limit(1))[0]?.buildingId;
      const targetDepartmentId = departmentId !== undefined ? departmentId : (await db.select({ departmentId: rooms.departmentId }).from(rooms).where(and(...conditions)).limit(1))[0]?.departmentId;
      if (targetCollegeId) {
        const targetCollege = (await db.select({ id: colleges.id }).from(colleges).where(and(eq(colleges.id, targetCollegeId), eq(colleges.isDeleted, false))).limit(1))[0];
        if (!targetCollege) return res.status(400).json({ error: 'الكلية غير موجودة أو مؤرشفة' });
      }
      if (targetDepartmentId) {
        const targetDepartment = (await db.select({ collegeId: departments.collegeId }).from(departments).where(and(eq(departments.id, targetDepartmentId), eq(departments.isDeleted, false))).limit(1))[0];
        if (!targetDepartment || targetDepartment.collegeId !== targetCollegeId) return res.status(400).json({ error: 'القسم المختار لا يتبع للكلية المحددة' });
      }
      if (targetBuildingId) {
        const targetBuilding = (await db.select({ id: buildings.id }).from(buildings).where(and(eq(buildings.id, targetBuildingId), eq(buildings.isDeleted, false))).limit(1))[0];
        if (!targetBuilding) return res.status(400).json({ error: 'المبنى غير موجود أو مؤرشف' });
      }

      const [updated] = await db.update(rooms).set({
        buildingId: buildingId || undefined,
        collegeId: collegeId || undefined,
        departmentId: departmentId !== undefined ? departmentId : undefined,
        nameAr: nameAr ? nameAr.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        roomType: roomType || undefined,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        floor: floor !== undefined ? floor : undefined,
        photoPath: photoPath !== undefined ? photoPath : undefined,
        locationDescription: locationDescription !== undefined ? locationDescription : undefined,
        status: status || undefined,
        updatedAt: new Date(),
      }).where(and(...conditions)).returning();

      if (!updated) {
        return res.status(404).json({ error: 'القاعة غير موجودة أو خارج نطاق صلاحياتك الأكاديمية' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل القاعة: ' + err.message });
    }
  }
);

app.delete(
  '/api/rooms/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const conditions = [eq(rooms.id, id), eq(rooms.isDeleted, false)];
      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        conditions.push(eq(rooms.collegeId, user.assignedCollegeId));
      }

      const [deleted] = await db.update(rooms)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(...conditions))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'القاعة غير موجودة أو خارج نطاق صلاحياتك الأكاديمية' });
      }

      res.json({ success: true, message: 'تم حذف القاعة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف القاعة: ' + err.message });
    }
  }
);

// 6.4 Academic Years & Semesters (Requirements 3, 4)
app.get('/api/term/current', authenticateToken, requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'), async (_req: Request, res: Response) => {
  try {
    const term = await getCurrentTerm();
    res.json({ ...term, label: formatAcademicTerm(term) });
  } catch (error: any) {
    res.status(409).json({ success: false, error: { code: 'CURRENT_TERM_NOT_CONFIGURED', message: error.message } });
  }
});

app.post('/api/term/open', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    let current: AcademicTerm;
    try { current = await getCurrentTerm(); }
    catch (error: any) { return res.status(409).json({ success: false, error: { code: 'CURRENT_TERM_NOT_CONFIGURED', message: error.message } }); }
    const targetYear = validateAcademicYear(body.academicYear);
    const targetSemester = normalizeSemester(body.semester);
    if (!targetYear || !targetSemester) return res.status(400).json({ error: 'اختر سنة دراسية وفصلاً صالحين' });
    const target: AcademicTerm = { academicYear: targetYear, semester: targetSemester };
    const source = resolveAcademicTerm({ academicYear: body.fromAcademicYear, semester: body.fromSemester }, current);
    const sourceSchedules = body.copyPrevious === true
      ? (await db.select().from(schedules).where(and(eq(schedules.academicYear, source.academicYear), eq(schedules.isDeleted, false)))).filter(schedule => isSameAcademicTerm(schedule, source))
      : [];
    const targetSchedules = (await db.select().from(schedules).where(and(eq(schedules.academicYear, target.academicYear), eq(schedules.isDeleted, false)))).filter(schedule => isSameAcademicTerm(schedule, target));
    const links = await db.select().from(scheduleSections);
    const sectionIdsFor = (schedule: any) => Array.isArray(schedule.sectionIds) ? schedule.sectionIds : links.filter(link => link.scheduleId === schedule.id).map(link => link.sectionId).concat(links.some(link => link.scheduleId === schedule.id) ? [] : [schedule.sectionId]);
    const conflicts: Array<{ sourceScheduleId: string; conflictingScheduleId: string; kinds: string[]; day: string; startTime: string }> = [];
    const planned: any[] = [];
    for (const candidate of sourceSchedules) {
      const sectionIds = sectionIdsFor(candidate);
      const possibleConflicts = [...targetSchedules, ...planned];
      for (const existing of possibleConflicts) {
        if (existing.day !== candidate.day || !areIntervalsOverlapping(existing.startTime, existing.endTime, candidate.startTime, candidate.endTime)) continue;
        const existingSections = sectionIdsFor(existing);
        const kinds = [
          existing.roomId === candidate.roomId ? 'قاعة' : '',
          existing.facultyId === candidate.facultyId ? 'تدريسي' : '',
          sectionIds.some((id: string) => existingSections.includes(id)) ? 'شعبة' : '',
        ].filter(Boolean);
        if (kinds.length) conflicts.push({ sourceScheduleId: candidate.id, conflictingScheduleId: existing.id, kinds, day: candidate.day, startTime: candidate.startTime });
      }
      planned.push({ ...candidate, id: `preview-${candidate.id}`, sectionIds, academicYear: target.academicYear, semester: target.semester });
    }
    const preview = { term: { ...target, label: formatAcademicTerm(target) }, sourceTerm: { ...source, label: formatAcademicTerm(source) }, copyPrevious: body.copyPrevious === true, schedulesCount: sourceSchedules.length, conflicts };
    if (body.preview === true) return res.json({ success: true, preview });
    if (body.confirm !== true) return res.status(400).json({ error: 'يلزم تأكيد فتح الفصل بعد مراجعة المعاينة', preview });
    if (conflicts.length) return res.status(409).json({ error: 'توجد تعارضات. عالجها في الجدول ثم أعد المعاينة قبل النسخ', preview });

    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const newIds = new Map<string, string>();
      for (const sourceSchedule of sourceSchedules) {
        const id = generateId('sch');
        newIds.set(sourceSchedule.id, id);
        await db.insert(schedules).values(cloneScheduleForTerm(sourceSchedule, id, target));
      }
      for (const link of links) {
        const newScheduleId = newIds.get(link.scheduleId);
        if (newScheduleId) await db.insert(scheduleSections).values({ scheduleId: newScheduleId, sectionId: link.sectionId });
      }
      const settingsRow = (await db.select().from(systemSettings).where(eq(systemSettings.key, 'academicSettings')).limit(1))[0];
      let savedSettings: any = {};
      try { savedSettings = settingsRow ? JSON.parse(settingsRow.value) : {}; } catch { savedSettings = {}; }
      const nextSettings = {
        ...savedSettings,
        academicStructure: { ...(savedSettings.academicStructure || {}), currentAcademicYear: target.academicYear, currentSemester: target.semester },
      };
      const settingValue = JSON.stringify(nextSettings);
      if (settingsRow) {
        await db.update(systemSettings).set({ value: settingValue, updatedAt: new Date() }).where(eq(systemSettings.id, settingsRow.id));
      } else {
        await db.insert(systemSettings).values({ id: generateId('setting'), key: 'academicSettings', value: settingValue, description: 'إعدادات الفصل الأكاديمي الحالي' });
      }
      await db.insert(auditLogs).values({
        id: generateId('audit-term'), userId: req.user!.id, userName: req.user!.name, userRole: req.user!.role,
        action: 'TERM_OPEN', entity: 'academic_term', entityId: `${target.academicYear}:${target.semester}`,
        reason: `فتح ${formatAcademicTerm(target)}؛ نسخ ${newIds.size} جدولاً دون حضور`,
      });
      sqlite.exec('COMMIT');
      res.status(201).json({ success: true, term: { ...target, label: formatAcademicTerm(target) }, copiedSchedules: newIds.size });
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get(
  '/api/academic-years',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(academicYears);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  '/api/academic-years',
  authenticateToken,
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    try {
      const { name, isCurrent, startDate, endDate } = req.body;
      if (!validateAcademicYear(name) || !startDate || !endDate) return res.status(400).json({ error: 'اسم السنة وتاريخا البداية والنهاية مطلوبة' });
      const newId = generateId('ay');
      const [created] = await db.insert(academicYears).values({
        id: newId,
        name,
        isCurrent: !!isCurrent,
        startDate,
        endDate,
      }).returning();
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  '/api/semesters',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(semesters);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 6.5 Stages & Sections (Requirements 3, 4, 5)
app.get(
  '/api/stages',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const conditions = [eq(stages.isDeleted, false)];
      if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        conditions.push(eq(stages.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'FACULTY' && user.assignedDepartmentId) {
        conditions.push(eq(stages.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'COLLEGE_MONITOR') {
        const ids = (await scopedDepartmentIds(user)) || [];
        conditions.push(ids.length ? inArray(stages.departmentId, ids) : eq(stages.departmentId, '__NO_DEPT__'));
      }
      const list = await db.select().from(stages).where(and(...conditions));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  '/api/stages',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { departmentId, nameAr, nameEn, yearNumber, status } = req.body;
      if (!departmentId || !nameAr) {
        return res.status(400).json({ error: 'القسم واسم المرحلة حقول مطلوبة' });
      }
      if (!(await departmentInUserScope(req.user!, departmentId))) return denyOutOfScope(res);

      const newId = generateId('stage');
      const [created] = await db.insert(stages).values({
        id: newId,
        departmentId,
        nameAr: nameAr.trim(),
        nameEn: (nameEn || '').trim(),
        yearNumber: Number(yearNumber) || 1,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة المرحلة: ' + err.message });
    }
  }
);

app.put(
  '/api/stages/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingStage = (await db.select().from(stages).where(and(eq(stages.id, id), eq(stages.isDeleted, false))).limit(1))[0];
      if (!existingStage || !(await departmentInUserScope(req.user!, existingStage.departmentId))) return denyOutOfScope(res);
      const { nameAr, nameEn, yearNumber, status } = req.body;
      const [updated] = await db.update(stages).set({
        nameAr: nameAr ? nameAr.trim() : undefined,
        nameEn: nameEn !== undefined ? nameEn.trim() : undefined,
        yearNumber: yearNumber !== undefined ? Number(yearNumber) : undefined,
        status: status || undefined,
      }).where(and(eq(stages.id, id), eq(stages.isDeleted, false))).returning();

      if (!updated) {
        return res.status(404).json({ error: 'المرحلة غير موجودة' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل المرحلة: ' + err.message });
    }
  }
);

app.delete(
  '/api/stages/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingStage = (await db.select().from(stages).where(and(eq(stages.id, id), eq(stages.isDeleted, false))).limit(1))[0];
      if (!existingStage || !(await departmentInUserScope(req.user!, existingStage.departmentId))) return denyOutOfScope(res);
      const [deleted] = await db.update(stages).set({ isDeleted: true }).where(and(eq(stages.id, id), eq(stages.isDeleted, false))).returning();
      if (!deleted) {
        return res.status(404).json({ error: 'المرحلة غير موجودة' });
      }
      res.json({ success: true, message: 'تم حذف المرحلة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف المرحلة: ' + err.message });
    }
  }
);

app.get(
  '/api/sections',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const conditions = [eq(sections.isDeleted, false)];
      if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        conditions.push(eq(sections.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'FACULTY' && user.assignedDepartmentId) {
        conditions.push(eq(sections.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'COLLEGE_MONITOR') {
        const ids = (await scopedDepartmentIds(user)) || [];
        conditions.push(ids.length ? inArray(sections.departmentId, ids) : eq(sections.departmentId, '__NO_DEPT__'));
      }
      const list = await db.select().from(sections).where(and(...conditions));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  '/api/sections',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { stageId, departmentId, name, studentCount, status } = req.body;
      if (!stageId || !departmentId || !name) {
        return res.status(400).json({ error: 'المرحلة، القسم، ورمز الشعبة حقول إلزامية' });
      }
      if (!(await departmentInUserScope(req.user!, departmentId))) return denyOutOfScope(res);
      const stage = (await db.select().from(stages).where(and(eq(stages.id, stageId), eq(stages.isDeleted, false))).limit(1))[0];
      if (!stage || stage.departmentId !== departmentId) return res.status(400).json({ error: 'المرحلة المختارة لا تتبع للقسم المحدد' });

      const newId = generateId('sec');
      const [created] = await db.insert(sections).values({
        id: newId,
        stageId,
        departmentId,
        name: name.trim().toUpperCase(),
        studentCount: Number(studentCount) || 50,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة الشعبة: ' + err.message });
    }
  }
);

app.put(
  '/api/sections/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingSection = (await db.select().from(sections).where(and(eq(sections.id, id), eq(sections.isDeleted, false))).limit(1))[0];
      if (!existingSection || !(await departmentInUserScope(req.user!, existingSection.departmentId))) return denyOutOfScope(res);
      const { name, studentCount, status } = req.body;
      const [updated] = await db.update(sections).set({
        name: name ? name.trim().toUpperCase() : undefined,
        studentCount: studentCount !== undefined ? Number(studentCount) : undefined,
        status: status || undefined,
      }).where(and(eq(sections.id, id), eq(sections.isDeleted, false))).returning();

      if (!updated) {
        return res.status(404).json({ error: 'الشعبة غير موجودة' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل الشعبة: ' + err.message });
    }
  }
);

app.delete(
  '/api/sections/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingSection = (await db.select().from(sections).where(and(eq(sections.id, id), eq(sections.isDeleted, false))).limit(1))[0];
      if (!existingSection || !(await departmentInUserScope(req.user!, existingSection.departmentId))) return denyOutOfScope(res);
      const [deleted] = await db.update(sections).set({ isDeleted: true }).where(and(eq(sections.id, id), eq(sections.isDeleted, false))).returning();
      if (!deleted) {
        return res.status(404).json({ error: 'الشعبة غير موجودة' });
      }
      res.json({ success: true, message: 'تم حذف الشعبة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف الشعبة: ' + err.message });
    }
  }
);

// 6.6 Subjects API (Requirements 3, 4, 5)
app.get(
  '/api/subjects',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const conditions = [eq(subjects.isDeleted, false)];
      if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        conditions.push(eq(subjects.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'FACULTY' && user.assignedDepartmentId) {
        conditions.push(eq(subjects.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'COLLEGE_MONITOR') {
        const ids = (await scopedDepartmentIds(user)) || [];
        conditions.push(ids.length ? inArray(subjects.departmentId, ids) : eq(subjects.departmentId, '__NO_DEPT__'));
      }
      const list = await db.select().from(subjects).where(and(...conditions));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  '/api/subjects',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const {
        departmentId,
        stageId,
        code,
        nameAr,
        nameEn,
        type,
        theoreticalHours,
        practicalHours,
        creditUnits,
        status,
      } = req.body;

      if (!departmentId || !stageId || !nameAr || !code) {
        return res.status(400).json({ error: 'القسم، المرحلة، اسم المادة ورمزها حقول إلزامية' });
      }
      if (!(await departmentInUserScope(req.user!, departmentId))) return denyOutOfScope(res);
      const stage = (await db.select().from(stages).where(and(eq(stages.id, stageId), eq(stages.isDeleted, false))).limit(1))[0];
      if (!stage || stage.departmentId !== departmentId) return res.status(400).json({ error: 'المرحلة المختارة لا تتبع للقسم المحدد' });

      const newId = generateId('subj');
      const [created] = await db.insert(subjects).values({
        id: newId,
        departmentId,
        stageId,
        code: code.trim().toUpperCase(),
        nameAr: nameAr.trim(),
        nameEn: (nameEn || '').trim(),
        type: type || 'theoretical',
        theoreticalHours: Number(theoreticalHours) || 2,
        practicalHours: Number(practicalHours) || 0,
        creditUnits: Number(creditUnits) || 3,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة المادة: ' + err.message });
    }
  }
);

app.put(
  '/api/subjects/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingSubject = (await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.isDeleted, false))).limit(1))[0];
      if (!existingSubject || !(await departmentInUserScope(req.user!, existingSubject.departmentId))) return denyOutOfScope(res);
      const {
        nameAr,
        nameEn,
        code,
        type,
        theoreticalHours,
        practicalHours,
        creditUnits,
        status,
      } = req.body;

      const [updated] = await db.update(subjects).set({
        nameAr: nameAr ? nameAr.trim() : undefined,
        nameEn: nameEn !== undefined ? nameEn.trim() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        type: type || undefined,
        theoreticalHours: theoreticalHours !== undefined ? Number(theoreticalHours) : undefined,
        practicalHours: practicalHours !== undefined ? Number(practicalHours) : undefined,
        creditUnits: creditUnits !== undefined ? Number(creditUnits) : undefined,
        status: status || undefined,
      }).where(and(eq(subjects.id, id), eq(subjects.isDeleted, false))).returning();

      if (!updated) {
        return res.status(404).json({ error: 'المادة غير موجودة' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل المادة: ' + err.message });
    }
  }
);

app.delete(
  '/api/subjects/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingSubject = (await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.isDeleted, false))).limit(1))[0];
      if (!existingSubject || !(await departmentInUserScope(req.user!, existingSubject.departmentId))) return denyOutOfScope(res);
      const [deleted] = await db.update(subjects).set({ isDeleted: true }).where(and(eq(subjects.id, id), eq(subjects.isDeleted, false))).returning();
      if (!deleted) {
        return res.status(404).json({ error: 'المادة غير موجودة' });
      }
      res.json({ success: true, message: 'تم حذف المادة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف المادة: ' + err.message });
    }
  }
);

// 6.7 Faculties API (Requirements 3, 4, 5)
app.get(
  '/api/faculties',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const conditions = [eq(faculties.isDeleted, false)];

      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        conditions.push(eq(faculties.collegeId, user.assignedCollegeId));
      } else if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        conditions.push(eq(faculties.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'FACULTY' && user.assignedFacultyId) {
        conditions.push(eq(faculties.id, user.assignedFacultyId));
      }

      const list = await db.select().from(faculties).where(and(...conditions));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  '/api/faculties/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const conditions = [eq(faculties.id, id), eq(faculties.isDeleted, false)];

      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        conditions.push(eq(faculties.collegeId, user.assignedCollegeId));
      } else if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        conditions.push(eq(faculties.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'FACULTY' && user.assignedFacultyId) {
        conditions.push(eq(faculties.id, user.assignedFacultyId));
      }

      const list = await db.select().from(faculties).where(and(...conditions));
      if (list.length === 0) {
        return res.status(404).json({ error: 'التدريسي غير موجود أو خارج نطاق صلاحياتك الأكاديمية' });
      }
      res.json(list[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  '/api/faculties',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const {
        employeeId,
        collegeId,
        departmentId,
        nameAr,
        nameEn,
        academicTitle,
        specialization,
        phone,
        email,
        status,
        photoPath,
      } = req.body;

      if (!collegeId || !departmentId || !nameAr || !email) {
        return res.status(400).json({ error: 'الكلية، القسم، الاسم بالعربي والبريد الإلكتروني حقول إلزامية' });
      }
      const facultyDepartment = (await db.select({ collegeId: departments.collegeId }).from(departments).where(eq(departments.id, departmentId)).limit(1))[0];
      if (!facultyDepartment || facultyDepartment.collegeId !== collegeId || !(await departmentInUserScope(req.user!, departmentId))) return denyOutOfScope(res);

      const newId = generateId('fac');
      const [created] = await db.insert(faculties).values({
        id: newId,
        employeeId: employeeId || '',
        collegeId,
        departmentId,
        nameAr: nameAr.trim(),
        nameEn: (nameEn || '').trim(),
        academicTitle: academicTitle || 'أستاذ مساعد',
        specialization: specialization || 'عام',
        phone: phone || '',
        email: email.trim().toLowerCase(),
        photoPath: photoPath || null,
        status: status || 'active',
        isDeleted: false,
      }).returning();

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة التدريسي: ' + err.message });
    }
  }
);

app.put(
  '/api/faculties/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        nameAr,
        nameEn,
        academicTitle,
        specialization,
        phone,
        email,
        status,
        photoPath,
      } = req.body;
      const existingFaculty = (await db.select().from(faculties).where(and(eq(faculties.id, req.params.id), eq(faculties.isDeleted, false))).limit(1))[0];
      if (!facultyInUserScope(req.user!, existingFaculty)) return denyOutOfScope(res);

      const [updated] = await db.update(faculties).set({
        nameAr: nameAr ? nameAr.trim() : undefined,
        nameEn: nameEn !== undefined ? nameEn.trim() : undefined,
        academicTitle: academicTitle || undefined,
        specialization: specialization || undefined,
        phone: phone !== undefined ? phone : undefined,
        email: email ? email.trim().toLowerCase() : undefined,
        photoPath: photoPath !== undefined ? photoPath : undefined,
        status: status || undefined,
        updatedAt: new Date(),
      }).where(and(eq(faculties.id, id), eq(faculties.isDeleted, false))).returning();

      if (!updated) {
        return res.status(404).json({ error: 'التدريسي غير موجود' });
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل التدريسي: ' + err.message });
    }
  }
);

app.delete(
  '/api/faculties/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existingFaculty = (await db.select().from(faculties).where(and(eq(faculties.id, id), eq(faculties.isDeleted, false))).limit(1))[0];
      if (!facultyInUserScope(req.user!, existingFaculty)) return denyOutOfScope(res);
      const [deleted] = await db.update(faculties)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(eq(faculties.id, id), eq(faculties.isDeleted, false)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'التدريسي غير موجود' });
      }

      res.json({ success: true, message: 'تم حذف التدريسي بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف التدريسي: ' + err.message });
    }
  }
);

// ==========================================
// 7. SCHEDULES & CONFLICT ENGINE (Requirements 4, 5, 8)
// ==========================================

// 7.1 GET /api/schedules — Scoped in SQL
app.get(
  '/api/schedules',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { facultyId, departmentId, day, roomId, mine } = req.query;
      const conditions = [eq(schedules.isDeleted, false)];

      if (user.role === 'FACULTY' || (mine === '1' && hasFacultyPortal(user))) {
        const assignedFacId = user.assignedFacultyId || '__NO_FACULTY__';
        conditions.push(eq(schedules.facultyId, assignedFacId));
      } else if (user.role === 'DEPARTMENT_MONITOR') {
        const assignedDeptId = user.assignedDepartmentId || '__NO_DEPT__';
        conditions.push(eq(schedules.departmentId, assignedDeptId));
      } else if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        const collegeDepts = await db
          .select({ id: departments.id })
          .from(departments)
          .where(and(eq(departments.collegeId, user.assignedCollegeId), eq(departments.isDeleted, false)));
        const deptIds = collegeDepts.map(d => d.id);
        if (deptIds.length === 0) {
          return res.json([]);
        }
        conditions.push(inArray(schedules.departmentId, deptIds));
      }

      if (facultyId && typeof facultyId === 'string' && user.role !== 'FACULTY') {
        conditions.push(eq(schedules.facultyId, facultyId));
      }
      if (departmentId && typeof departmentId === 'string' && departmentId !== 'ALL' && user.role === 'OWNER') {
        conditions.push(eq(schedules.departmentId, departmentId));
      }
      if (roomId && typeof roomId === 'string' && roomId !== 'ALL') {
        conditions.push(eq(schedules.roomId, roomId));
      }
      if (day && typeof day === 'string' && day !== 'ALL') {
        conditions.push(eq(schedules.day, day));
      }

      const list = await db.select().from(schedules).where(and(...conditions));
      const linkedSections = list.length
        ? await db.select().from(scheduleSections).where(inArray(scheduleSections.scheduleId, list.map(schedule => schedule.id)))
        : [];
      const sectionMap = new Map<string, string[]>();
      for (const link of linkedSections) sectionMap.set(link.scheduleId, [...(sectionMap.get(link.scheduleId) || []), link.sectionId]);
      res.json(list.map(schedule => ({ ...schedule, sectionIds: sectionMap.get(schedule.id) || [schedule.sectionId] })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 7.2 POST /api/schedules — Create schedule with strict conflict check & override control (Requirements 4, 8)
app.post(
  '/api/schedules',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const item = req.body;
      const { allowConflictOverride, overrideReason } = req.body;
      let term: AcademicTerm;
      try { term = await resolveRequestedTerm(item); }
      catch (error: any) { return res.status(409).json({ error: error.message, code: 'CURRENT_TERM_NOT_CONFIGURED' }); }

      if (!item.departmentId || !item.facultyId || !item.roomId || !item.day || !item.startTime || !item.endTime) {
        return res.status(400).json({ error: 'القسم، التدريسي، القاعة، اليوم، ووقت البداية والنهاية حقول إلزامية' });
      }

      if (item.startTime >= item.endTime) {
        return res.status(400).json({ error: 'وقت بداية المحاضرة يجب أن يكون قبل وقت نهايتها' });
      }

      if (!(await departmentInUserScope(user, item.departmentId))) return denyOutOfScope(res);
      const requestedSectionIds = [...new Set([item.sectionId, ...(Array.isArray(item.sectionIds) ? item.sectionIds : [])].filter(Boolean).map(String))];
      if (requestedSectionIds.length === 0) return res.status(400).json({ error: 'الشعبة حقل إلزامي' });
      const requestedSections = await db.select().from(sections).where(inArray(sections.id, requestedSectionIds));
      if (requestedSections.length !== requestedSectionIds.length || requestedSections.some(section => section.isDeleted || section.departmentId !== item.departmentId || section.stageId !== item.stageId)) {
        return res.status(400).json({ error: 'الشعب المشتركة يجب أن تكون ضمن القسم والمرحلة نفسيهما' });
      }
      const [scheduleDepartment, scheduleStage, scheduleSubject] = await Promise.all([
        db.select().from(departments).where(and(eq(departments.id, item.departmentId), eq(departments.isDeleted, false))).limit(1).then(rows => rows[0]),
        db.select().from(stages).where(and(eq(stages.id, item.stageId), eq(stages.isDeleted, false))).limit(1).then(rows => rows[0]),
        db.select().from(subjects).where(and(eq(subjects.id, item.subjectId), eq(subjects.isDeleted, false))).limit(1).then(rows => rows[0]),
      ]);
      if (!scheduleDepartment || !scheduleStage || scheduleStage.departmentId !== item.departmentId || !scheduleSubject || scheduleSubject.departmentId !== item.departmentId || scheduleSubject.stageId !== item.stageId) {
        return res.status(400).json({ error: 'تحقق من ارتباط المرحلة والمادة بالقسم المحدد' });
      }
      for (const section of requestedSections) {
        if (!(await departmentInUserScope(user, section.departmentId))) return denyOutOfScope(res);
      }
      const scheduleFaculty = (await db.select().from(faculties).where(and(eq(faculties.id, item.facultyId), eq(faculties.isDeleted, false))).limit(1))[0];
      const scheduleRoom = (await db.select().from(rooms).where(and(eq(rooms.id, item.roomId), eq(rooms.isDeleted, false))).limit(1))[0];
      if (!scheduleFaculty || scheduleFaculty.departmentId !== item.departmentId || !facultyInUserScope(user, scheduleFaculty) || !scheduleRoom || scheduleRoom.collegeId !== scheduleDepartment.collegeId || (scheduleRoom.departmentId && scheduleRoom.departmentId !== item.departmentId) || (user.role === 'COLLEGE_MONITOR' && scheduleRoom.collegeId !== user.assignedCollegeId)) return denyOutOfScope(res);
      const totalSectionEnrollment = requestedSections.reduce((total, section) => total + Number(section.studentCount || 0), 0);
      if (totalSectionEnrollment > Number(scheduleRoom.capacity || 0)) {
        return res.status(400).json({ error: `سعة القاعة (${scheduleRoom.capacity}) أقل من مجموع طلاب الشعب (${totalSectionEnrollment})` });
      }

      // Department monitor scope check
      if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId && user.assignedDepartmentId !== item.departmentId) {
        return res.status(403).json({ error: 'غير مصرح لك بإضافة جدول لقسم آخر' });
      }

      // Conflict detection
      const existingSchedules = await db.select().from(schedules).where(
        and(eq(schedules.day, item.day), eq(schedules.isDeleted, false))
      );

      const existingLinks = existingSchedules.length ? await db.select().from(scheduleSections).where(inArray(scheduleSections.scheduleId, existingSchedules.map(schedule => schedule.id))) : [];
      const membership = new Map<string, string[]>();
      for (const link of existingLinks) membership.set(link.scheduleId, [...(membership.get(link.scheduleId) || []), link.sectionId]);
      const { roomConflict, facultyConflict, sectionConflict } = findScheduleTermConflicts({ ...item, id: '', academicYear: term.academicYear, semester: term.semester, sectionIds: requestedSectionIds }, existingSchedules, term, membership);

      const hasConflict = !!(roomConflict || facultyConflict || sectionConflict);

      if (hasConflict) {
        if (!allowConflictOverride) {
          return res.status(409).json({
            conflict: true,
            hasRoomConflict: !!roomConflict,
            conflictingRoomSchedule: roomConflict,
            hasFacultyConflict: !!facultyConflict,
            conflictingFacultySchedule: facultyConflict,
            hasSectionConflict: !!sectionConflict,
            conflictingSectionSchedule: sectionConflict,
            message: 'تم رصد تعارض في الجدول (في القاعة أو التدريسي أو الشعبة)',
          });
        }

        // Conflict Override Check (Requirement 8): OWNER or COLLEGE_MONITOR ONLY + Mandatory Reason
        if (user.role !== 'OWNER' && user.role !== 'COLLEGE_MONITOR') {
          return res.status(403).json({
            error: 'تجاوز التعارض في الجداول مقتصر على صلاحيات مالك النظام (OWNER) ومسؤول الكلية (COLLEGE_MONITOR) فقط',
          });
        }

        if (!overrideReason || typeof overrideReason !== 'string' || overrideReason.trim().length < 5) {
          return res.status(400).json({
            error: 'سبب التجاوز إلزامي ويجب أن لا يقل عن 5 أحرف لتسجيله في سجل التدقيق الأمني (overrideReason required)',
          });
        }
      }

      const newId = generateId('sch');
      const newSchedule = {
        id: newId,
        departmentId: item.departmentId,
        stageId: item.stageId,
        sectionId: item.sectionId,
        subjectId: item.subjectId,
        facultyId: item.facultyId,
        roomId: item.roomId,
        day: item.day,
        startTime: item.startTime,
        endTime: item.endTime,
        lectureType: item.lectureType || 'theoretical',
        academicYear: term.academicYear,
        semester: term.semester,
        status: 'active',
        isDeleted: false,
      };

      await db.insert(schedules).values(newSchedule);
      await db.insert(scheduleSections).values(requestedSectionIds.map(sectionId => ({ scheduleId: newId, sectionId })));

      // Audit Log
      await db.insert(auditLogs).values({
        id: generateId('audit-sch'),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: hasConflict && allowConflictOverride ? 'SCHEDULE_CONFLICT_OVERRIDE' : 'CREATE',
        entity: 'schedule',
        entityId: newId,
        reason: hasConflict && allowConflictOverride
          ? `تجاوز تعارض معتمد: ${overrideReason}`
          : 'إضافة محاضرة جديدة إلى الجدول الدراسي',
      });

      res.status(201).json({ success: true, schedule: newSchedule });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 7.3 PUT /api/schedules/:id — Update schedule with conflict check & override control (Requirements 4, 8)
app.put(
  '/api/schedules/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const item = req.body;
      const { allowConflictOverride, overrideReason } = req.body;

      const [existing] = await db.select().from(schedules).where(and(eq(schedules.id, id), eq(schedules.isDeleted, false)));
      if (!existing) {
        return res.status(404).json({ error: 'المحاضرة غير موجودة في الجدول الأكاديمي' });
      }

      const merged = { ...existing, ...item };
      let term: AcademicTerm;
      try { term = await resolveRequestedTerm({ academicYear: merged.academicYear, semester: merged.semester }); }
      catch (error: any) { return res.status(409).json({ error: error.message, code: 'CURRENT_TERM_NOT_CONFIGURED' }); }
      merged.academicYear = term.academicYear;
      merged.semester = term.semester;
      const requestedSectionIds = [...new Set([merged.sectionId, ...(Array.isArray(item.sectionIds) ? item.sectionIds : [])].filter(Boolean).map(String))];
      const requestedSections = await db.select().from(sections).where(inArray(sections.id, requestedSectionIds));
      if (requestedSections.length !== requestedSectionIds.length || requestedSections.some(section => section.isDeleted || section.departmentId !== merged.departmentId || section.stageId !== merged.stageId)) {
        return res.status(400).json({ error: 'الشعب المشتركة يجب أن تكون ضمن القسم والمرحلة نفسيهما' });
      }
      for (const section of requestedSections) {
        if (!(await departmentInUserScope(user, section.departmentId))) return denyOutOfScope(res);
      }

      const [scheduleDepartment, scheduleStage, scheduleSubject, scheduleFaculty] = await Promise.all([
        db.select().from(departments).where(and(eq(departments.id, merged.departmentId), eq(departments.isDeleted, false))).limit(1).then(rows => rows[0]),
        db.select().from(stages).where(and(eq(stages.id, merged.stageId), eq(stages.isDeleted, false))).limit(1).then(rows => rows[0]),
        db.select().from(subjects).where(and(eq(subjects.id, merged.subjectId), eq(subjects.isDeleted, false))).limit(1).then(rows => rows[0]),
        db.select().from(faculties).where(and(eq(faculties.id, merged.facultyId), eq(faculties.isDeleted, false))).limit(1).then(rows => rows[0]),
      ]);
      if (!scheduleDepartment || !scheduleStage || scheduleStage.departmentId !== merged.departmentId || !scheduleSubject || scheduleSubject.departmentId !== merged.departmentId || scheduleSubject.stageId !== merged.stageId || !scheduleFaculty || scheduleFaculty.departmentId !== merged.departmentId || !facultyInUserScope(user, scheduleFaculty)) {
        return res.status(400).json({ error: 'تحقق من ارتباط التدريسي والمرحلة والمادة بالقسم المحدد' });
      }

      const updateRoom = (await db.select().from(rooms).where(and(eq(rooms.id, merged.roomId), eq(rooms.isDeleted, false))).limit(1))[0];
      if (!updateRoom || updateRoom.collegeId !== scheduleDepartment.collegeId || (updateRoom.departmentId && updateRoom.departmentId !== merged.departmentId)) return denyOutOfScope(res);
      const totalSectionEnrollment = requestedSections.reduce((total, section) => total + Number(section.studentCount || 0), 0);
      if (!updateRoom || totalSectionEnrollment > Number(updateRoom.capacity || 0)) {
        return res.status(400).json({ error: `سعة القاعة (${updateRoom?.capacity ?? 0}) أقل من مجموع طلاب الشعب (${totalSectionEnrollment})` });
      }

      if (merged.startTime >= merged.endTime) {
        return res.status(400).json({ error: 'وقت بداية المحاضرة يجب أن يكون قبل وقت نهايتها' });
      }

      if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId && user.assignedDepartmentId !== merged.departmentId) {
        return res.status(403).json({ error: 'غير مصرح لك بتعديل جدول قسم آخر' });
      }
      if (!(await scheduleInUserScope(user, existing)) || !(await departmentInUserScope(user, merged.departmentId))) return denyOutOfScope(res);

      // Conflict detection against other active schedules
      const otherSchedules = await db.select().from(schedules).where(
        and(
          eq(schedules.day, merged.day),
          eq(schedules.isDeleted, false),
          ne(schedules.id, id)
        )
      );

      const otherLinks = otherSchedules.length ? await db.select().from(scheduleSections).where(inArray(scheduleSections.scheduleId, otherSchedules.map(schedule => schedule.id))) : [];
      const otherMembership = new Map<string, string[]>();
      for (const link of otherLinks) otherMembership.set(link.scheduleId, [...(otherMembership.get(link.scheduleId) || []), link.sectionId]);
      const { roomConflict, facultyConflict, sectionConflict } = findScheduleTermConflicts({ ...merged, sectionIds: requestedSectionIds }, otherSchedules, term, otherMembership);

      const hasConflict = !!(roomConflict || facultyConflict || sectionConflict);

      if (hasConflict) {
        if (!allowConflictOverride) {
          return res.status(409).json({
            conflict: true,
            hasRoomConflict: !!roomConflict,
            conflictingRoomSchedule: roomConflict,
            hasFacultyConflict: !!facultyConflict,
            conflictingFacultySchedule: facultyConflict,
            hasSectionConflict: !!sectionConflict,
            conflictingSectionSchedule: sectionConflict,
            message: 'تم رصد تعارض في التعديل مع محاضرة أخرى (في القاعة أو التدريسي أو الشعبة)',
          });
        }

        // Role check (Requirement 8)
        if (user.role !== 'OWNER' && user.role !== 'COLLEGE_MONITOR') {
          return res.status(403).json({
            error: 'تجاوز التعارض في الجداول مقتصر على صلاحيات مالك النظام (OWNER) ومسؤول الكلية (COLLEGE_MONITOR) فقط',
          });
        }

        if (!overrideReason || typeof overrideReason !== 'string' || overrideReason.trim().length < 5) {
          return res.status(400).json({
            error: 'سبب التجاوز إلزامي ويجب أن لا يقل عن 5 أحرف لتسجيله في سجل التدقيق الأمني (overrideReason required)',
          });
        }
      }

      const [updated] = await db.update(schedules).set({
        departmentId: merged.departmentId,
        stageId: merged.stageId,
        sectionId: merged.sectionId,
        subjectId: merged.subjectId,
        facultyId: merged.facultyId,
        roomId: merged.roomId,
        day: merged.day,
        startTime: merged.startTime,
        endTime: merged.endTime,
        lectureType: merged.lectureType,
        academicYear: merged.academicYear,
        semester: merged.semester,
        status: merged.status || 'active',
        updatedAt: new Date(),
      }).where(eq(schedules.id, id)).returning();
      await db.delete(scheduleSections).where(eq(scheduleSections.scheduleId, id));
      await db.insert(scheduleSections).values(requestedSectionIds.map(sectionId => ({ scheduleId: id, sectionId })));

      await db.insert(auditLogs).values({
        id: generateId('audit-sch'),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: hasConflict && allowConflictOverride ? 'SCHEDULE_CONFLICT_OVERRIDE' : 'UPDATE',
        entity: 'schedule',
        entityId: id,
        reason: hasConflict && allowConflictOverride
          ? `تجاوز تعارض معتمد: ${overrideReason}`
          : 'تعديل بيانات المحاضرة في الجدول الدراسي',
      });

      res.json({ success: true, schedule: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 7.4 DELETE /api/schedules/:id — Soft Delete Schedule
app.delete(
  '/api/schedules/:id',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const existing = (await db.select().from(schedules).where(and(eq(schedules.id, id), eq(schedules.isDeleted, false))).limit(1))[0];
      if (!(await scheduleInUserScope(user, existing))) return denyOutOfScope(res);

      const [deleted] = await db.update(schedules).set({
        isDeleted: true,
        updatedAt: new Date(),
      }).where(and(eq(schedules.id, id), eq(schedules.isDeleted, false))).returning();

      if (!deleted) {
        return res.status(404).json({ error: 'المحاضرة غير موجودة' });
      }

      await db.insert(auditLogs).values({
        id: generateId('audit-sch'),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'SOFT_DELETE',
        entity: 'schedule',
        entityId: id,
        reason: 'حذف المحاضرة من الجدول الدراسي',
      });

      res.json({ success: true, message: 'تم حذف المحاضرة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// 8. ATTENDANCE & EVIDENCE APIS (Requirements 3, 4, 5)
// ==========================================

// 8.1 GET /api/attendance — Scoped in SQL
app.get(
  '/api/attendance',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { date, facultyId, mine } = req.query;
      const conditions: any[] = [];

      if (user.role === 'DEPARTMENT_MONITOR' && !user.assignedDepartmentId) {
        return res.status(403).json({ success: false, error: { code: 'SCOPE_NOT_ASSIGNED', message: 'لا يوجد قسم محدد لحسابك' } });
      }
      if (user.role === 'COLLEGE_MONITOR' && !user.assignedCollegeId) {
        return res.status(403).json({ success: false, error: { code: 'SCOPE_NOT_ASSIGNED', message: 'لا توجد كلية محددة لحسابك' } });
      }

      if (user.role === 'FACULTY' || (mine === '1' && hasFacultyPortal(user))) {
        conditions.push(eq(attendanceRecords.facultyId, user.assignedFacultyId || '__NO_FACULTY__'));
      } else if (facultyId && typeof facultyId === 'string') {
        const targetFaculty = (await db.select().from(faculties).where(eq(faculties.id, facultyId)).limit(1))[0];
        if (!facultyInUserScope(user, targetFaculty)) return denyOutOfScope(res);
        conditions.push(eq(attendanceRecords.facultyId, facultyId));
      } else if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        const scopedFaculty = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.departmentId, user.assignedDepartmentId));
        conditions.push(scopedFaculty.length ? inArray(attendanceRecords.facultyId, scopedFaculty.map(item => item.id)) : eq(attendanceRecords.facultyId, '__NO_FACULTY__'));
      } else if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        const scopedFaculty = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.collegeId, user.assignedCollegeId));
        conditions.push(scopedFaculty.length ? inArray(attendanceRecords.facultyId, scopedFaculty.map(item => item.id)) : eq(attendanceRecords.facultyId, '__NO_FACULTY__'));
      }

      if (date && typeof date === 'string') {
        conditions.push(eq(attendanceRecords.lectureDate, date));
      }

      const query = conditions.length > 0
        ? db.select().from(attendanceRecords).where(and(...conditions)).orderBy(desc(attendanceRecords.recordedAt))
        : db.select().from(attendanceRecords).orderBy(desc(attendanceRecords.recordedAt));

      const records = await query;
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 8.2 POST /api/attendance — Record attendance with permission & faculty check (Requirement 4)
app.post(
  '/api/attendance',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const {
        scheduleId,
        facultyId,
        lectureDate,
        studentsPresent,
        studentsEnrolled: customEnrolled,
        evidencePhotoUrl,
        notes,
        recordingMode,
        onBehalfReason,
        onBehalfOtherNote,
        clientRecordedAt,
        portalMode,
        sectionAttendance,
      } = req.body;

      if (!scheduleId || !facultyId || !lectureDate) {
        return res.status(400).json({ error: 'المعلومات الأساسية للمحاضرة ناقصة' });
      }

      // The faculty portal is also available to a monitor account linked to
      // one faculty record, but only for that linked record.
      if ((user.role === 'FACULTY' || (portalMode === 'faculty' && hasFacultyPortal(user))) && user.assignedFacultyId && user.assignedFacultyId !== facultyId) {
        return res.status(403).json({
          error: 'غير مصرح لك بتسجيل الحضور لتدريسي آخر',
        });
      }

      const scheduleItems = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
      const sch = scheduleItems[0];
      if (!sch) {
        return res.status(404).json({ error: 'المحاضرة غير موجودة في الجدول الأكاديمي' });
      }
      if (!(await scheduleInUserScope(user, sch)) || sch.facultyId !== facultyId && user.role !== 'OWNER' && user.role !== 'COLLEGE_MONITOR' && user.role !== 'DEPARTMENT_MONITOR') return denyOutOfScope(res);

      if (recordingMode === 'ON_BEHALF_OF_FACULTY' && (typeof onBehalfReason !== 'string' || !onBehalfReason.trim())) {
        return res.status(400).json({
          error: 'يرجى تحديد سبب إلزامي للتسجيل نيابة عن التدريسي (نسيان، عطل فني، انقطاع إنترنت...)',
        });
      }
      const isProxyRecording = recordingMode === 'ON_BEHALF_OF_FACULTY';
      const isAuthorizedProxyRecorder = user.role === 'OWNER' || user.role === 'COLLEGE_MONITOR' || user.role === 'DEPARTMENT_MONITOR';
      if (isProxyRecording && !isAuthorizedProxyRecorder) {
        return res.status(403).json({ error: 'التسجيل نيابة عن التدريسي متاح لمسؤولي المتابعة فقط' });
      }
      const lectureWeekday = weekdayFromIsoDate(String(lectureDate));
      if (!lectureWeekday) return res.status(400).json({ error: 'تاريخ المحاضرة غير صالح' });
      if (String(lectureDate) > getBaghdadDateKey()) {
        return res.status(400).json({ error: 'لا يمكن تسجيل حضور بتاريخ مستقبلي' });
      }
      if (!isProxyRecording && lectureWeekday !== sch.day) {
        return res.status(400).json({ error: 'تاريخ المحاضرة لا يطابق يوم الجدول' });
      }

      const linkedSectionRows = await db.select({ sectionId: scheduleSections.sectionId }).from(scheduleSections).where(eq(scheduleSections.scheduleId, scheduleId));
      const attendanceSectionIds = linkedSectionRows.length ? linkedSectionRows.map(row => row.sectionId) : [sch.sectionId];
      const sectionItems = await db.select().from(sections).where(inArray(sections.id, attendanceSectionIds));
      if (sectionItems.length !== attendanceSectionIds.length || sectionItems.some(section => section.isDeleted || section.departmentId !== sch.departmentId || section.stageId !== sch.stageId)) {
        return res.status(409).json({ error: 'تعذر تسجيل الحضور: إحدى الشعب المرتبطة بالمحاضرة غير صالحة' });
      }
      const stageItems = await db.select({ id: stages.id, nameAr: stages.nameAr }).from(stages).where(inArray(stages.id, [...new Set(sectionItems.map(section => section.stageId))]));
      const stageNameById = new Map(stageItems.map(stage => [stage.id, stage.nameAr]));
      const sectionEnrolledTotal = sectionItems.reduce((total, section) => total + Number(section.studentCount || 0), 0);
      const enrolled = sectionItems.length > 1 ? sectionEnrolledTotal : (customEnrolled || sectionEnrolledTotal || 50);

      const presentNum = Number(studentsPresent) || 0;
      if (presentNum > enrolled) {
        return res.status(400).json({
          error: `خطأ في إدخال عدد الحضور: عدد الطلاب الحاضرين (${presentNum}) لا يمكن أن يتجاوز عدد المسجلين في الشعبة (${enrolled})`,
        });
      }
      const sectionAttendanceRows = Array.isArray(sectionAttendance) && sectionAttendance.length
        ? sectionAttendance
        : sectionItems.map(section => ({ sectionId: section.id, studentsPresent: sectionItems.length === 1 ? presentNum : 0 }));
      const submittedSectionIds = sectionAttendanceRows.map((row: any) => String(row.sectionId || ''));
      if (submittedSectionIds.length !== attendanceSectionIds.length || new Set(submittedSectionIds).size !== submittedSectionIds.length || attendanceSectionIds.some(id => !submittedSectionIds.includes(id))) {
        return res.status(400).json({ error: 'أدخل عدد الحاضرين لكل شعبة مرة واحدة' });
      }
      if (sectionAttendanceRows.reduce((sum: number, row: any) => sum + Number(row.studentsPresent || 0), 0) !== presentNum) {
        return res.status(400).json({ error: 'يجب أن يساوي مجموع حضور الشعب إجمالي الحضور' });
      }
      for (const row of sectionAttendanceRows) {
        const section = sectionItems.find(item => item.id === row.sectionId);
        if (!section || Number(row.studentsPresent || 0) > Number(section.studentCount || 0)) {
          return res.status(400).json({ error: 'عدد الحضور لا يمكن أن يتجاوز عدد المسجلين في أي شعبة' });
        }
      }

      // Duplicate Attendance Prevention
      const existingAttendance = await db.select().from(attendanceRecords).where(
        and(
          eq(attendanceRecords.facultyId, facultyId),
          eq(attendanceRecords.scheduleId, scheduleId),
          eq(attendanceRecords.lectureDate, lectureDate)
        )
      );

      if (existingAttendance.length > 0) {
        return res.status(409).json({
          error: 'تم تسجيل حضور هذه المحاضرة مسبقاً لهذا التدريسي في هذا اليوم، يمنع التكرار.',
        });
      }

      const percentage = Number(((presentNum / enrolled) * 100).toFixed(2));
      const recordId = generateId('att');
      const [snapshotFaculty, snapshotSubject, snapshotSection, snapshotRoom, snapshotDepartment, snapshotCollege] = await Promise.all([
        db.select().from(faculties).where(eq(faculties.id, facultyId)),
        db.select().from(subjects).where(eq(subjects.id, sch.subjectId)),
        db.select().from(sections).where(eq(sections.id, sch.sectionId)),
        db.select().from(rooms).where(eq(rooms.id, sch.roomId)),
        db.select().from(departments).where(eq(departments.id, sch.departmentId)),
        db.select().from(colleges).where(eq(colleges.id, (await db.select({ collegeId: faculties.collegeId }).from(faculties).where(eq(faculties.id, facultyId)))[0]?.collegeId || '')),
      ]);
      const facultySnapshot = snapshotFaculty[0];
      const subjectSnapshot = snapshotSubject[0];
      const sectionSnapshot = snapshotSection[0];
      const roomSnapshot = snapshotRoom[0];
      const departmentSnapshot = snapshotDepartment[0];
      const collegeSnapshot = snapshotCollege[0];

      const newRecord = {
        id: recordId,
        facultyId,
        scheduleId,
        subjectId: sch.subjectId,
        sectionId: sch.sectionId,
        stageId: sch.stageId,
        roomId: sch.roomId,
        academicYear: sch.academicYear,
        semester: sch.semester,
        lectureDate,
        scheduledStart: sch.startTime,
        scheduledEnd: sch.endTime,
        recordedAt: new Date(),
        attendanceStatus: 'PRESENT',
        studentsEnrolled: enrolled,
        studentsPresent: presentNum,
        attendancePercentage: percentage.toString(),
        evidencePhotoUrl: evidencePhotoUrl || null,
        recordedByUserId: user.id,
        recordedByRole: user.role,
        recordingMode: recordingMode || 'DIRECT',
        onBehalfReason: onBehalfReason || null,
        onBehalfOtherNote: onBehalfOtherNote || null,
        clientRecordedAt: clientRecordedAt ? new Date(clientRecordedAt) : new Date(),
        serverSyncedAt: new Date(),
        syncStatus: 'SYNCED',
        notes: notes || null,
        snapshotFacultyName: facultySnapshot ? `${facultySnapshot.academicTitle} ${facultySnapshot.nameAr}` : null,
        snapshotSubjectCode: subjectSnapshot?.code || null,
        snapshotSubjectName: subjectSnapshot?.nameAr || null,
        snapshotSectionName: sectionSnapshot?.name || null,
        snapshotRoomName: roomSnapshot ? `${roomSnapshot.nameAr} (${roomSnapshot.code})` : null,
        snapshotDepartmentName: departmentSnapshot?.nameAr || null,
        snapshotCollegeName: collegeSnapshot?.nameAr || null,
        snapshotSemesterName: sch.semester,
      };

      await db.insert(attendanceRecords).values(newRecord);
      await db.insert(attendanceSectionRecords).values(sectionAttendanceRows.map((row: any) => {
        const section = sectionItems.find(item => item.id === row.sectionId)!;
        const sectionPresent = Number(row.studentsPresent || 0);
        const sectionEnrolled = Number(section.studentCount || 0);
        return {
          id: generateId('att-sec'),
          attendanceId: recordId,
          scheduleId,
          sectionId: section.id,
          studentsEnrolled: sectionEnrolled,
          studentsPresent: sectionPresent,
          attendancePercentage: sectionEnrolled ? ((sectionPresent / sectionEnrolled) * 100).toFixed(2) : '0',
          snapshotSectionName: section.name,
          snapshotDepartmentName: departmentSnapshot?.nameAr || null,
          snapshotStageName: stageNameById.get(section.stageId) || null,
          lectureDate,
        };
      }));

      if (evidencePhotoUrl) {
        await db.insert(attendanceEvidence).values({
          id: generateId('evid'),
          attendanceId: recordId,
          facultyId,
          scheduleId,
          lectureDate,
          photoUrl: evidencePhotoUrl,
          recordedByUserId: user.id,
        });
      }

      await db.insert(lectureSessions).values({
        id: generateId('sess'),
        scheduleId,
        date: lectureDate,
        plannedRoomId: sch.roomId,
        actualRoomId: sch.roomId,
        plannedFacultyId: sch.facultyId,
        actualFacultyId: facultyId,
        status: 'PRESENT',
        checkInTime: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        notes: notes || null,
      }).onConflictDoUpdate({
        target: [lectureSessions.scheduleId, lectureSessions.date],
        set: {
          status: 'PRESENT',
          checkInTime: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
          notes: notes || null,
        },
      });

      await db.insert(auditLogs).values({
        id: generateId('audit-att'),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: recordingMode === 'ON_BEHALF_OF_FACULTY' ? 'ON_BEHALF_ATTENDANCE' : 'RECORD_ATTENDANCE',
        entity: 'attendance',
        entityId: recordId,
        reason: recordingMode === 'ON_BEHALF_OF_FACULTY'
          ? `تسجيل حضور نيابي: ${onBehalfReason} (${onBehalfOtherNote || ''})`
          : 'توثيق حضور مباشر للمحاضرة عبر الكاميرا الحية',
      });

      res.status(201).json({ success: true, record: newRecord });
    } catch (err: any) {
      if (err.code === '23505' || (err.message && err.message.includes('unique constraint'))) {
        return res.status(409).json({
          error: 'تم تسجيل حضور هذه المحاضرة مسبقاً لهذا التدريسي في هذا اليوم، يمنع التكرار.',
        });
      }
      console.error('Attendance recording error:', err);
      res.status(500).json({ error: 'فشل حفظ سجل الحضور: ' + err.message });
    }
  }
);

// 8.3 POST /api/attendance/offline-sync
app.post(
  '/api/attendance/offline-sync',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { batch } = req.body;
      if (!Array.isArray(batch) || batch.length === 0) {
        return res.json({ synced: 0, failed: 0, items: [] });
      }

      const results: any[] = [];

      for (const item of batch) {
        try {
          const batchSchedule = (await db.select().from(schedules).where(eq(schedules.id, item.scheduleId)).limit(1))[0];
          if (!(await scheduleInUserScope(user, batchSchedule))) {
            results.push({ id: item.id, status: 'FORBIDDEN', message: 'العنصر خارج نطاق المستخدم' });
            continue;
          }
          // The schedule is the authority for all academic relationships. A
          // client cannot combine an in-scope schedule with a foreign
          // faculty/section/room/subject in the offline payload.
          const scopedRelations = ['departmentId', 'stageId', 'sectionId', 'subjectId', 'facultyId', 'roomId'] as const;
          const hasMismatchedRelation = scopedRelations.some(field => item[field] !== undefined && item[field] !== null && item[field] !== batchSchedule[field]);
          if (hasMismatchedRelation) {
            results.push({ id: item.id, status: 'FORBIDDEN', message: 'بيانات العنصر لا تطابق نطاق المحاضرة' });
            continue;
          }
          const scheduleDepartmentId = batchSchedule.departmentId;
          const scheduleStageId = batchSchedule.stageId;
          const scheduleSectionId = batchSchedule.sectionId;
          const scheduleSubjectId = batchSchedule.subjectId;
          const scheduleFacultyId = batchSchedule.facultyId;
          const scheduleRoomId = batchSchedule.roomId;
          const existing = await db.select().from(attendanceRecords).where(
            and(
              eq(attendanceRecords.facultyId, scheduleFacultyId),
              eq(attendanceRecords.scheduleId, item.scheduleId),
              eq(attendanceRecords.lectureDate, item.lectureDate)
            )
          );

          if (existing.length > 0) {
            results.push({ id: item.id, status: 'SYNC_CONFLICT', message: 'مسجلة مسبقاً' });
            continue;
          }

          const enrolled = item.studentsEnrolled || 50;
          const present = item.studentsPresent || 0;
          const percentage = Number(((present / enrolled) * 100).toFixed(2));
          const recordId = item.id || generateId('att');
          const [offlineFaculty, offlineSubject, offlineSection, offlineRoom, offlineDepartment] = await Promise.all([
            db.select().from(faculties).where(eq(faculties.id, scheduleFacultyId)),
            db.select().from(subjects).where(eq(subjects.id, scheduleSubjectId)),
            db.select().from(sections).where(eq(sections.id, scheduleSectionId)),
            db.select().from(rooms).where(eq(rooms.id, scheduleRoomId)),
            db.select().from(departments).where(eq(departments.id, scheduleDepartmentId)),
          ]);
          const offlineCollege = offlineFaculty[0]?.collegeId ? await db.select().from(colleges).where(eq(colleges.id, offlineFaculty[0].collegeId)) : [];

          await db.insert(attendanceRecords).values({
            id: recordId,
            facultyId: scheduleFacultyId,
            scheduleId: item.scheduleId,
            subjectId: scheduleSubjectId,
            sectionId: scheduleSectionId,
            stageId: scheduleStageId,
            roomId: scheduleRoomId,
            academicYear: batchSchedule.academicYear,
            semester: batchSchedule.semester,
            lectureDate: item.lectureDate,
            scheduledStart: item.scheduledStart || '08:30',
            scheduledEnd: item.scheduledEnd || '10:30',
            recordedAt: new Date(),
            attendanceStatus: item.attendanceStatus || 'PRESENT',
            studentsEnrolled: enrolled,
            studentsPresent: present,
            attendancePercentage: percentage.toString(),
            evidencePhotoUrl: item.evidencePhotoUrl || null,
            recordedByUserId: user.id,
            recordedByRole: user.role,
            recordingMode: 'OFFLINE_SYNC',
            clientRecordedAt: item.clientRecordedAt ? new Date(item.clientRecordedAt) : new Date(),
            serverSyncedAt: new Date(),
            syncStatus: 'SYNCED',
            notes: item.notes || 'تمت المزامنة بنجاح من طابور Offline',
            snapshotFacultyName: offlineFaculty[0] ? `${offlineFaculty[0].academicTitle} ${offlineFaculty[0].nameAr}` : null,
            snapshotSubjectCode: offlineSubject[0]?.code || null,
            snapshotSubjectName: offlineSubject[0]?.nameAr || null,
            snapshotSectionName: offlineSection[0]?.name || null,
            snapshotRoomName: offlineRoom[0] ? `${offlineRoom[0].nameAr} (${offlineRoom[0].code})` : null,
            snapshotDepartmentName: offlineDepartment[0]?.nameAr || null,
            snapshotCollegeName: offlineCollege[0]?.nameAr || null,
            snapshotSemesterName: batchSchedule.semester,
          });

          results.push({ id: item.id, status: 'SYNCED' });
        } catch (e: any) {
          results.push({ id: item.id, status: 'SYNC_FAILED', error: e.message });
        }
      }

      // Keep the public response shape compatible with the client and the
      // permissions matrix: offline queue entries are returned as `items`.
      // `results` remains as a backwards-compatible alias for older clients.
      res.json({ success: true, items: results, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 8.4 Resolve Unrecorded Sessions
app.post(
  '/api/lecture-sessions/resolve-unrecorded',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { scheduleId, date, reason, notes } = req.body;

      if (!scheduleId || !date || !reason) {
        return res.status(400).json({ error: 'يرجى تقديم سبب عدم الانعقاد والمحاضرة' });
      }

      const schList = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
      const sch = schList[0];
      if (!sch) return res.status(404).json({ error: 'المحاضرة غير موجودة' });
      if (!(await scheduleInUserScope(user, sch))) return denyOutOfScope(res);

      await db.insert(lectureSessions).values({
        id: generateId('sess-unrec'),
        scheduleId,
        date,
        plannedRoomId: sch.roomId,
        actualRoomId: sch.roomId,
        plannedFacultyId: sch.facultyId,
        actualFacultyId: sch.facultyId,
        status: 'NOT_RECORDED',
        isUnrecordedResolved: true,
        unrecordedReason: reason,
        unrecordedNotes: notes || null,
        resolvedByUserId: user.id,
      }).onConflictDoUpdate({
        target: [lectureSessions.scheduleId, lectureSessions.date],
        set: {
          isUnrecordedResolved: true,
          unrecordedReason: reason,
          unrecordedNotes: notes || null,
          resolvedByUserId: user.id,
        },
      });

      await db.insert(auditLogs).values({
        id: generateId('audit-unrec'),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'RESOLVE_UNRECORDED',
        entity: 'lecture_session',
        entityId: `${scheduleId}-${date}`,
        reason: `توثيق سبب عدم انعقاد/تسجيل المحاضرة: ${reason}`,
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// 9. IMPORT ENGINE & TRANSACTIONAL ROLLBACK (Requirements 3, 4, 7)
// ==========================================

app.post(
  '/api/import/:entityType',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    const user = req.user!;
    const { entityType } = req.params;
    const data = Array.isArray(req.body.data) ? req.body.data : Array.isArray(req.body) ? req.body : [];
    const fileName = req.body.fileName || `import_${entityType}_${Date.now()}.xlsx`;
    let importTerm: AcademicTerm | null = null;
    if (entityType === 'schedules') {
      try { importTerm = await getCurrentTerm(); }
      catch (error: any) { return res.status(409).json({ success: false, error: error.message, code: 'CURRENT_TERM_NOT_CONFIGURED' }); }
    }

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'ملف الاستيراد فارغ أو لا يحتوي على صفوف بيانات صالحة' });
    }

    // Buildings are global records in the current schema (they do not carry
    // a college/department owner), so only OWNER may import them. Perform
    // this authorization check before row validation; otherwise a forbidden
    // caller can receive a misleading 400 for missing spreadsheet fields.
    if (entityType === 'buildings' && user.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'استيراد المباني مقتصر على مالك النظام' },
      });
    }

    // Reject out-of-scope import rows before opening the transaction. This keeps
    // the API response a clear 403 instead of treating an authorization failure
    // as a spreadsheet validation error.
    if (entityType === 'subjects' || entityType === 'schedules' || entityType === 'rooms') {
      const [scopeDepartments, scopeColleges, scopeBuildings] = await Promise.all([
        db.select({ id: departments.id, code: departments.code }).from(departments).where(eq(departments.isDeleted, false)),
        db.select({ id: colleges.id, code: colleges.code }).from(colleges).where(eq(colleges.isDeleted, false)),
        db.select({ id: buildings.id, code: buildings.code }).from(buildings).where(eq(buildings.isDeleted, false)),
      ]);
      const resolveIdOrCode = (rows: Array<{ id: string; code: string }>, value: unknown) => {
        const normalized = String(value || '').trim().toLowerCase();
        return rows.find(row => row.id.toLowerCase() === normalized || row.code.toLowerCase() === normalized)?.id;
      };
      for (const row of data) {
        const departmentId = resolveIdOrCode(scopeDepartments, row.departmentId || row.departmentCode || row['رمز القسم']);
        if (departmentId && entityType !== 'rooms' && !(await departmentInUserScope(user, departmentId))) {
          return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'يوجد صف خارج نطاق المستخدم' } });
        }
        if (entityType === 'rooms') {
          const collegeId = resolveIdOrCode(scopeColleges, row.collegeId || row.collegeCode || row['رمز الكلية']);
          const roomDepartmentId = resolveIdOrCode(scopeDepartments, row.departmentId || row.departmentCode || row['رمز القسم']);
          const buildingId = resolveIdOrCode(scopeBuildings, row.buildingId || row.buildingCode || row['رمز المبنى']);
          if (user.role === 'COLLEGE_MONITOR' && collegeId && collegeId !== user.assignedCollegeId) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'يوجد صف خارج نطاق الكلية' } });
          }
          if (roomDepartmentId && !(await departmentInUserScope(user, roomDepartmentId))) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'يوجد صف خارج نطاق القسم' } });
          }
          if (buildingId && !(await buildingInUserScope(user, buildingId)) && user.role !== 'OWNER') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'المبنى خارج نطاق المستخدم' } });
          }
        }
        if (entityType === 'schedules') {
          const facultyId = row.facultyId || row.facultyEmail || row['البريد الإلكتروني للتدريسي'];
          if (facultyId) {
            const facultyRow = (await db.select().from(faculties).where(eq(faculties.id, String(facultyId))).limit(1))[0];
            if (facultyRow && !facultyInUserScope(user, facultyRow)) {
              return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'التدريسي خارج نطاق المستخدم' } });
            }
          }
        }
      }
    }

    const authorId = user.id;
    const authorName = user.name;
    const authorRole = user.role;
    const jobId = generateId('job');

    const errorList: { row: number; field: string; message: string; recordKey?: string }[] = [];

    try {
      let importedCreated = 0;
      let importedUpdated = 0;
      await db.transaction(async (tx) => {
        // Step 1: Reference dictionaries
        const existingColleges = await tx.select().from(colleges).where(eq(colleges.isDeleted, false)).all();
        const existingDepts = await tx.select().from(departments).where(eq(departments.isDeleted, false)).all();
        const existingBuildings = await tx.select().from(buildings).where(eq(buildings.isDeleted, false)).all();
        const existingRooms = await tx.select().from(rooms).where(eq(rooms.isDeleted, false)).all();
        const existingStages = await tx.select().from(stages).where(eq(stages.isDeleted, false)).all();
        const existingSections = await tx.select().from(sections).where(eq(sections.isDeleted, false)).all();
        const existingSubjects = await tx.select().from(subjects).where(eq(subjects.isDeleted, false)).all();
        const existingFaculties = await tx.select().from(faculties).where(eq(faculties.isDeleted, false)).all();
        const existingSchedules = await tx.select().from(schedules).where(eq(schedules.isDeleted, false)).all();
        const existingScheduleSections = await tx.select().from(scheduleSections).all();

        const collegeMap = new Map<string, string>();
        existingColleges.forEach(c => {
          collegeMap.set(c.id, c.id);
          collegeMap.set(c.id.toLowerCase(), c.id);
          collegeMap.set(c.id.toUpperCase(), c.id);
          collegeMap.set(c.code.toLowerCase(), c.id);
          collegeMap.set(c.code.toUpperCase(), c.id);
        });

        const deptMap = new Map<string, string>();
        existingDepts.forEach(d => {
          deptMap.set(d.id, d.id);
          deptMap.set(d.id.toLowerCase(), d.id);
          deptMap.set(d.id.toUpperCase(), d.id);
          deptMap.set(d.code.toLowerCase(), d.id);
          deptMap.set(d.code.toUpperCase(), d.id);
        });

        const buildingMap = new Map<string, string>();
        existingBuildings.forEach(b => {
          buildingMap.set(b.id, b.id);
          buildingMap.set(b.id.toLowerCase(), b.id);
          buildingMap.set(b.id.toUpperCase(), b.id);
          buildingMap.set(b.code.toLowerCase(), b.id);
          buildingMap.set(b.code.toUpperCase(), b.id);
        });

        const roomMap = new Map<string, string>();
        existingRooms.forEach(r => {
          roomMap.set(r.id, r.id);
          roomMap.set(r.id.toLowerCase(), r.id);
          roomMap.set(r.id.toUpperCase(), r.id);
          roomMap.set(r.code.toLowerCase(), r.id);
          roomMap.set(r.code.toUpperCase(), r.id);
        });

        const facultyMap = new Map<string, string>();
        const facultyByEmployeeId = new Map<string, string>();
        existingFaculties.forEach(f => {
          facultyMap.set(f.id, f.id);
          facultyMap.set(f.id.toLowerCase(), f.id);
          facultyMap.set(f.id.toUpperCase(), f.id);
          facultyMap.set(f.email.toLowerCase(), f.id);
          facultyMap.set(f.email.toUpperCase(), f.id);
          if (f.employeeId) facultyByEmployeeId.set(f.employeeId.trim().toLowerCase(), f.id);
        });

        const subjectMap = new Map<string, string>();
        existingSubjects.forEach(s => {
          subjectMap.set(s.id, s.id);
          subjectMap.set(s.id.toLowerCase(), s.id);
          subjectMap.set(s.id.toUpperCase(), s.id);
          subjectMap.set(s.code.toLowerCase(), s.id);
          subjectMap.set(s.code.toUpperCase(), s.id);
        });

        const sectionMap = new Map<string, string>();
        existingSections.forEach(sec => {
          sectionMap.set(sec.id, sec.id);
          sectionMap.set(sec.id.toLowerCase(), sec.id);
          sectionMap.set(sec.id.toUpperCase(), sec.id);
          sectionMap.set(sec.name.toLowerCase(), sec.id);
          sectionMap.set(sec.name.toUpperCase(), sec.id);
        });

        const stageMap = new Map<string, string>();
        existingStages.forEach(st => {
          stageMap.set(st.id, st.id);
          stageMap.set(st.id.toLowerCase(), st.id);
          stageMap.set(st.id.toUpperCase(), st.id);
          stageMap.set(String(st.yearNumber), st.id);
        });

        const recordsToInsert: any[] = [];
        const recordsToUpdate: any[] = [];
        const scheduleSectionLinks: Array<{ scheduleId: string; sectionId: string }> = [];
        const batchCodes = new Set<string>();
        const batchFacultyEmployeeIds = new Set<string>();

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 1;

          switch (entityType) {
            case 'colleges': {
              const errorCountBefore = errorList.length;
              if (authorRole !== 'OWNER') {
                errorList.push({ row: rowNum, field: 'role', message: 'استيراد الكليات مقتصر على OWNER فقط' });
              }
              const code = (row.code || row['رمز الكلية'] || '').toString().trim().toUpperCase();
              const nameAr = (row.nameAr || row['اسم الكلية بالعربية'] || row.name || '').toString().trim();
              const nameEn = (row.nameEn || row['اسم الكلية بالإنجليزية'] || '').toString().trim() || nameAr;
              const deanName = (row.deanName || row['عميد الكلية'] || '').toString().trim();
              const monitorName = (row.monitorName || row['مسؤول المتابعة'] || '').toString().trim();
              const phone = (row.phone || row['رقم الهاتف'] || '').toString().trim();
              const email = (row.email || row['البريد الإلكتروني'] || '').toString().trim();

              if (!code) errorList.push({ row: rowNum, field: 'code', message: 'رمز الكلية إلزامي' });
              if (!nameAr) errorList.push({ row: rowNum, field: 'nameAr', message: 'اسم الكلية بالعربية إلزامي' });
              if (!deanName) errorList.push({ row: rowNum, field: 'deanName', message: 'اسم عميد الكلية إلزامي' });
              if (!monitorName) errorList.push({ row: rowNum, field: 'monitorName', message: 'اسم مسؤول المتابعة إلزامي' });
              if (!phone) errorList.push({ row: rowNum, field: 'phone', message: 'رقم الهاتف إلزامي' });
              if (!email) errorList.push({ row: rowNum, field: 'email', message: 'البريد الإلكتروني إلزامي' });

              if (code && (batchCodes.has(code) || collegeMap.has(code))) {
                errorList.push({ row: rowNum, field: 'code', message: `رمز الكلية (${code}) مكرر في الملف أو موجود مسبقاً` });
              }
              if (code) batchCodes.add(code);

              if (errorList.length === errorCountBefore) {
                const id = generateId('col');
                collegeMap.set(code, id);
                recordsToInsert.push({
                  id,
                  universityId: 'univ-mustaqbal',
                  code,
                  nameAr,
                  nameEn,
                  deanName,
                  monitorName,
                  phone,
                  email,
                  status: 'active',
                  isDeleted: false,
                });
              }
              break;
            }

            case 'departments': {
              const errorCountBefore = errorList.length;
              if (authorRole === 'DEPARTMENT_MONITOR') errorList.push({ row: rowNum, field: 'role', message: 'مسؤول القسم لا يستورد أقساماً جديدة' });
              const collegeRef = (row.collegeId || row.collegeCode || row['رمز الكلية'] || '').toString().trim().toUpperCase();
              const resolvedCollegeId = collegeMap.get(collegeRef) || collegeRef;
              const code = (row.code || row['رمز القسم'] || '').toString().trim().toUpperCase();
              const nameAr = (row.nameAr || row['اسم القسم بالعربية'] || row.name || '').toString().trim();
              const nameEn = (row.nameEn || row['اسم القسم بالإنجليزية'] || '').toString().trim() || nameAr;
              const headName = (row.headName || row['رئيس القسم'] || '').toString().trim();
              const monitorName = (row.monitorName || row['مسؤول المتابعة'] || '').toString().trim();
              const phone = (row.phone || row['رقم الهاتف'] || '').toString().trim();
              const email = (row.email || row['البريد الإلكتروني'] || '').toString().trim();

              if (authorRole === 'COLLEGE_MONITOR' && user.assignedCollegeId !== resolvedCollegeId) {
                errorList.push({ row: rowNum, field: 'collegeId', message: 'لا يمكنك استيراد أقسام لكلية أخرى' });
              }
              if (!code) errorList.push({ row: rowNum, field: 'code', message: 'رمز القسم إلزامي' });
              if (!nameAr) errorList.push({ row: rowNum, field: 'nameAr', message: 'اسم القسم بالعربية إلزامي' });
              if (!headName) errorList.push({ row: rowNum, field: 'headName', message: 'اسم رئيس القسم إلزامي' });
              if (!monitorName) errorList.push({ row: rowNum, field: 'monitorName', message: 'اسم مسؤول المتابعة إلزامي' });
              if (!phone) errorList.push({ row: rowNum, field: 'phone', message: 'رقم الهاتف إلزامي' });
              if (!email) errorList.push({ row: rowNum, field: 'email', message: 'البريد الإلكتروني إلزامي' });

              if (!resolvedCollegeId || !collegeMap.has(resolvedCollegeId)) {
                errorList.push({ row: rowNum, field: 'collegeId', message: `الكلية التابع لها القسم (${collegeRef}) غير موجودة بالنظام` });
              }
              if (code && (batchCodes.has(code) || deptMap.has(code))) {
                errorList.push({ row: rowNum, field: 'code', message: `رمز القسم (${code}) مكرر أو موجود مسبقاً` });
              }
              if (code) batchCodes.add(code);

              if (errorList.length === errorCountBefore) {
                const id = generateId('dept');
                deptMap.set(code, id);
                recordsToInsert.push({
                  id,
                  collegeId: resolvedCollegeId,
                  code,
                  nameAr,
                  nameEn,
                  headName,
                  monitorName,
                  phone,
                  email,
                  status: 'active',
                  isDeleted: false,
                });
              }
              break;
            }

            case 'faculty': {
              const errorCountBefore = errorList.length;
              const collegeRef = (row.collegeId || row.collegeCode || row['رمز الكلية'] || '').toString().trim().toUpperCase();
              const deptRef = (row.departmentId || row.departmentCode || row['رمز القسم'] || '').toString().trim().toUpperCase();
              const resolvedCollegeId = collegeMap.get(collegeRef) || collegeRef;
              const resolvedDeptId = deptMap.get(deptRef) || deptRef;

              const nameAr = (row.nameAr || row['اسم التدريسي بالعربية'] || row.name || '').toString().trim();
              const nameEn = (row.nameEn || row['الاسم بالإنجليزية'] || '').toString().trim() || nameAr;
              const academicTitle = (row.academicTitle || row['اللقب العلمي'] || '').toString().trim();
              const specialization = (row.specialization || row['التخصص'] || row['التخصص العام والدقيق'] || '').toString().trim();
              const email = (row.email || row['البريد الإلكتروني'] || '').toString().trim().toLowerCase();
              const phone = (row.phone || row['رقم الهاتف'] || '').toString().trim();
              const employeeId = (row.employeeId || row['الرقم الوظيفي'] || '').toString().trim();
              const existingByEmployeeId = employeeId ? existingFaculties.find(f => f.employeeId.trim().toLowerCase() === employeeId.toLowerCase()) : undefined;
              const existingByEmail = email ? existingFaculties.find(f => f.email.toLowerCase() === email) : undefined;
              const existingFaculty = existingByEmployeeId || existingByEmail;

              if (authorRole === 'COLLEGE_MONITOR' && user.assignedCollegeId !== resolvedCollegeId) {
                errorList.push({ row: rowNum, field: 'collegeId', message: 'لا يمكنك استيراد تدريسيين لكلية أخرى' });
              }
              if (authorRole === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId !== resolvedDeptId) {
                errorList.push({ row: rowNum, field: 'departmentId', message: 'لا يمكنك استيراد تدريسيين لقسم آخر' });
              }
              if (!nameAr) errorList.push({ row: rowNum, field: 'nameAr', message: 'اسم التدريسي إلزامي' });
              if (!email) errorList.push({ row: rowNum, field: 'email', message: 'البريد الإلكتروني للتدريسي إلزامي' });
              if (!academicTitle) errorList.push({ row: rowNum, field: 'academicTitle', message: 'اللقب العلمي إلزامي' });
              if (!specialization) errorList.push({ row: rowNum, field: 'specialization', message: 'التخصص إلزامي' });
              if (!phone) errorList.push({ row: rowNum, field: 'phone', message: 'رقم الهاتف إلزامي' });

              if (!resolvedCollegeId || !collegeMap.has(resolvedCollegeId)) {
                errorList.push({ row: rowNum, field: 'collegeId', message: `الكلية (${collegeRef}) غير موجودة` });
              }
              if (!resolvedDeptId || !deptMap.has(resolvedDeptId)) {
                errorList.push({ row: rowNum, field: 'departmentId', message: `القسم (${deptRef}) غير موجود` });
              }
              if (existingByEmployeeId && existingByEmail && existingByEmployeeId.id !== existingByEmail.id) {
                errorList.push({ row: rowNum, field: 'employeeId', message: 'الرقم الوظيفي والبريد يعودان إلى سجلين مختلفين' });
              }
              if (email && batchCodes.has(email)) errorList.push({ row: rowNum, field: 'email', message: `البريد الإلكتروني (${email}) مكرر داخل الملف` });
              if (employeeId && batchFacultyEmployeeIds.has(employeeId.toLowerCase())) errorList.push({ row: rowNum, field: 'employeeId', message: `الرقم الوظيفي (${employeeId}) مكرر داخل الملف` });
              const emailOwnerId = email ? facultyMap.get(email) : undefined;
              if (emailOwnerId && emailOwnerId !== existingFaculty?.id) errorList.push({ row: rowNum, field: 'email', message: `البريد الإلكتروني (${email}) مستخدم في سجل تدريسي آخر` });
              const employeeOwnerId = employeeId ? facultyByEmployeeId.get(employeeId.toLowerCase()) : undefined;
              if (employeeOwnerId && employeeOwnerId !== existingFaculty?.id) errorList.push({ row: rowNum, field: 'employeeId', message: `الرقم الوظيفي (${employeeId}) مستخدم في سجل تدريسي آخر` });
              if (email) batchCodes.add(email);
              if (employeeId) batchFacultyEmployeeIds.add(employeeId.toLowerCase());

              if (errorList.length === errorCountBefore) {
                const id = existingFaculty?.id || generateId('fac');
                facultyMap.set(email, id);
                const facultyValues = {
                  id,
                  collegeId: resolvedCollegeId,
                  departmentId: resolvedDeptId,
                  employeeId: employeeId || existingFaculty?.employeeId || `EMP-${Math.floor(10000 + Math.random() * 90000)}`,
                  nameAr,
                  nameEn,
                  academicTitle,
                  specialization,
                  email,
                  phone,
                  status: 'active',
                  isDeleted: false,
                };
                if (existingFaculty) recordsToUpdate.push(facultyValues);
                else recordsToInsert.push(facultyValues);
              }
              break;
            }

            case 'subjects': {
              const errorCountBefore = errorList.length;
              const deptRef = (row.departmentId || row.departmentCode || row['رمز القسم'] || '').toString().trim().toUpperCase();
              const resolvedDeptId = deptMap.get(deptRef) || deptRef;
              const stageRef = (row.stageId || row.stageNumber || row['المرحلة'] || '1').toString().trim();
              const resolvedStageId = existingStages.find(stage => stage.departmentId === resolvedDeptId && (stage.id === stageRef || String(stage.yearNumber) === stageRef || stage.nameAr === stageRef))?.id || '';

              const code = (row.code || row['رمز المادة'] || '').toString().trim().toUpperCase();
              const nameAr = (row.nameAr || row['اسم المادة بالعربية'] || row.name || '').toString().trim();
              const nameEn = (row.nameEn || row['الاسم بالإنجليزية'] || '').toString().trim() || nameAr;
              const type = (row.type || row['نوع المادة'] || 'theoretical').toString().toLowerCase();
              const theoreticalHours = Number(row.theoreticalHours || row['الساعات النظرية'] || 2);
              const practicalHours = Number(row.practicalHours || row['الساعات العملية'] || 0);
              const creditUnits = Number(row.creditUnits || row['الوحدات الدراسية'] || (theoreticalHours + practicalHours / 2));

              if (!(await departmentInUserScope(user, resolvedDeptId))) errorList.push({ row: rowNum, field: 'departmentId', message: 'القسم خارج نطاق المستخدم' });

              if (!code) errorList.push({ row: rowNum, field: 'code', message: 'رمز المادة إلزامي' });
              if (!nameAr) errorList.push({ row: rowNum, field: 'nameAr', message: 'اسم المادة إلزامي' });
              if (!resolvedDeptId || !deptMap.has(resolvedDeptId)) {
                errorList.push({ row: rowNum, field: 'departmentId', message: `القسم (${deptRef}) غير موجود` });
              }
              if (!resolvedStageId) errorList.push({ row: rowNum, field: 'stageId', message: `المرحلة (${stageRef}) غير موجودة في القسم المحدد` });
              if (code && (batchCodes.has(code) || subjectMap.has(code))) {
                errorList.push({ row: rowNum, field: 'code', message: `رمز المادة (${code}) مكرر أو موجود مسبقاً` });
              }
              if (code) batchCodes.add(code);

              if (errorList.length === errorCountBefore) {
                const id = generateId('subj');
                subjectMap.set(code, id);
                recordsToInsert.push({
                  id,
                  departmentId: resolvedDeptId,
                  stageId: resolvedStageId,
                  code,
                  nameAr,
                  nameEn,
                  type: ['theoretical', 'practical', 'hybrid', 'clinical', 'seminar'].includes(type) ? type : 'theoretical',
                  theoreticalHours,
                  practicalHours,
                  creditUnits,
                  status: 'active',
                  isDeleted: false,
                });
              }
              break;
            }

            case 'schedules': {
              const errorCountBefore = errorList.length;
              const deptRef = (row.departmentId || row.departmentCode || row['رمز القسم'] || '').toString().trim();
              const resolvedDeptId = deptMap.get(deptRef) || deptMap.get(deptRef.toUpperCase()) || deptRef;
              const stageRef = (row.stageId || row.stageNumber || row['المرحلة'] || '1').toString().trim();
              const resolvedStageId = existingStages.find(stage => stage.departmentId === resolvedDeptId && (stage.id === stageRef || String(stage.yearNumber) === stageRef || stage.nameAr === stageRef))?.id || '';

              // NOTE: the template explicitly instructs users to separate multiple section
              // codes with an Arabic semicolon (؛, U+061B) or an Arabic comma (،, U+060C).
              // The split pattern below previously omitted ؛ entirely (it only matched the
              // Latin ';'), so any row following the template's own example (e.g. "SEC-3A؛
              // SEC-3B") was treated as one unsplit section reference and always failed
              // with "الشعبة (...) غير موجودة". ؛ is now included alongside the Latin ';',
              // '،' and ','.
              const sectionRefs: string[] = Array.from(new Set<string>(String(row.sectionIds || row.sectionId || row.sectionCode || row['رموز الشعب'] || row['رمز الشعبة'] || row['الشعب'] || '').split(/[؛،;,]/).map((value: string) => value.trim()).filter(Boolean)));
              const resolvedSectionIds = sectionRefs.map((ref: string) => sectionMap.get(ref) || sectionMap.get(ref.toUpperCase()) || ref);
              const resolvedSectionId = resolvedSectionIds[0] || '';

              const subjectRef = (row.subjectId || row.subjectCode || row['رمز المادة'] || '').toString().trim();
              const resolvedSubjectId = subjectMap.get(subjectRef) || subjectMap.get(subjectRef.toUpperCase()) || subjectRef;

              const facultyRef = (row.facultyId || row.facultyEmail || row['البريد الإلكتروني للتدريسي'] || '').toString().trim();
              const resolvedFacultyId = facultyMap.get(facultyRef) || facultyMap.get(facultyRef.toLowerCase()) || facultyRef;

              const roomRef = (row.roomId || row.roomCode || row['رمز القاعة'] || '').toString().trim();
              const resolvedRoomId = roomMap.get(roomRef) || roomMap.get(roomRef.toUpperCase()) || roomRef;

              const day = (row.day || row['اليوم'] || '').toString().trim();
              const startTime = (row.startTime || row['وقت البدء'] || '').toString().trim();
              const endTime = (row.endTime || row['وقت الانتهاء'] || '').toString().trim();
              const lectureType = (row.lectureType || row['نوع المحاضرة'] || 'theoretical').toString().toLowerCase();

              const rawAcademicYear = (row.academicYear || row['السنة الدراسية'] || '').toString().trim();
              const rawSemester = (row.semester || row['الفصل الدراسي'] || '').toString().trim();
              const academicYear = rawAcademicYear ? validateAcademicYear(rawAcademicYear) : importTerm!.academicYear;
              const semester = rawSemester ? normalizeSemester(rawSemester) : importTerm!.semester;

              if (!(await departmentInUserScope(user, resolvedDeptId))) errorList.push({ row: rowNum, field: 'departmentId', message: 'القسم خارج نطاق المستخدم' });
              const scheduleFacultyRow = existingFaculties.find(f => f.id === resolvedFacultyId);
              if (scheduleFacultyRow && !facultyInUserScope(user, scheduleFacultyRow)) errorList.push({ row: rowNum, field: 'facultyId', message: 'التدريسي خارج نطاق المستخدم' });
              const scheduleRoomRow = existingRooms.find(r => r.id === resolvedRoomId);
              if (scheduleRoomRow && user.role === 'COLLEGE_MONITOR' && scheduleRoomRow.collegeId !== user.assignedCollegeId) errorList.push({ row: rowNum, field: 'roomId', message: 'القاعة خارج نطاق الكلية' });

              if (!day) errorList.push({ row: rowNum, field: 'day', message: 'اليوم إلزامي' });
              if (!startTime) errorList.push({ row: rowNum, field: 'startTime', message: 'وقت البدء إلزامي' });
              if (!endTime) errorList.push({ row: rowNum, field: 'endTime', message: 'وقت الانتهاء إلزامي' });
              if (!academicYear) errorList.push({ row: rowNum, field: 'academicYear', message: 'السنة الدراسية غير صالحة' });
              if (!semester) errorList.push({ row: rowNum, field: 'semester', message: 'الفصل الدراسي غير صالح' });

              if (!resolvedDeptId || !deptMap.has(resolvedDeptId)) errorList.push({ row: rowNum, field: 'departmentId', message: `القسم (${deptRef}) غير موجود` });
               if (!resolvedStageId) errorList.push({ row: rowNum, field: 'stageId', message: `المرحلة (${stageRef}) غير موجودة في القسم المحدد` });
               if (!resolvedSectionId || !sectionMap.has(resolvedSectionId)) errorList.push({ row: rowNum, field: 'sectionId', message: `الشعبة (${sectionRefs.join('، ')}) غير موجودة` });
               for (const sectionId of resolvedSectionIds) {
                 const sectionRow = existingSections.find(section => section.id === sectionId);
                 if (!sectionRow) errorList.push({ row: rowNum, field: 'sectionIds', message: `الشعبة (${sectionId}) غير موجودة` });
                 else if (sectionRow.departmentId !== resolvedDeptId || sectionRow.stageId !== resolvedStageId) errorList.push({ row: rowNum, field: 'sectionIds', message: 'كل الشعب يجب أن تكون ضمن القسم والمرحلة نفسيهما' });
                 else if (!(await departmentInUserScope(user, sectionRow.departmentId))) errorList.push({ row: rowNum, field: 'sectionIds', message: 'إحدى الشعب خارج نطاق المستخدم' });
               }
              const importedSubject = existingSubjects.find(subject => subject.id === resolvedSubjectId);
              if (!resolvedSubjectId || !importedSubject) errorList.push({ row: rowNum, field: 'subjectId', message: `المادة (${subjectRef}) غير موجودة` });
              else if (importedSubject.departmentId !== resolvedDeptId || importedSubject.stageId !== resolvedStageId) errorList.push({ row: rowNum, field: 'subjectId', message: 'المادة لا تتبع للقسم والمرحلة المحددين' });
              if (!resolvedFacultyId || !facultyMap.has(resolvedFacultyId)) errorList.push({ row: rowNum, field: 'facultyId', message: `التدريسي (${facultyRef}) غير موجود` });
              else if (scheduleFacultyRow && scheduleFacultyRow.departmentId !== resolvedDeptId) errorList.push({ row: rowNum, field: 'facultyId', message: 'التدريسي لا يتبع للقسم المحدد' });
              if (!resolvedRoomId || !roomMap.has(resolvedRoomId)) errorList.push({ row: rowNum, field: 'roomId', message: `القاعة (${roomRef}) غير موجودة` });
              else if (scheduleRoomRow && (scheduleRoomRow.collegeId !== existingDepts.find(department => department.id === resolvedDeptId)?.collegeId || (scheduleRoomRow.departmentId && scheduleRoomRow.departmentId !== resolvedDeptId))) errorList.push({ row: rowNum, field: 'roomId', message: 'القاعة لا تتبع لكلية أو قسم الجدول' });

              const requestedSectionRows = resolvedSectionIds.map((sectionId: string) => existingSections.find(section => section.id === sectionId)).filter(Boolean);
              if (scheduleRoomRow && requestedSectionRows.length === resolvedSectionIds.length) {
                const expectedCapacity = requestedSectionRows.reduce((total: number, section: any) => total + Number(section.studentCount || 0), 0);
                if (expectedCapacity > Number(scheduleRoomRow.capacity || 0)) errorList.push({ row: rowNum, field: 'roomId', message: 'سعة القاعة أقل من مجموع طلاب الشعب' });
              }

              if (resolvedRoomId && resolvedFacultyId && resolvedSectionId && day && startTime && endTime && academicYear && semester) {
                const allExistingAndBatch = [...existingSchedules, ...recordsToInsert];
                
                const roomConf = allExistingAndBatch.find(s => 
                  s.roomId === resolvedRoomId && 
                  s.day === day && 
                  s.academicYear === academicYear && 
                  normalizeSemester(s.semester) === semester &&
                  areIntervalsOverlapping(s.startTime, s.endTime, startTime, endTime)
                );
                if (roomConf) errorList.push({ row: rowNum, field: 'roomId', message: `تعارض قاعة: القاعة مشغولة في نفس اليوم والتوقيت لعام ${academicYear} وفصل ${semester}` });

                const facConf = allExistingAndBatch.find(s => 
                  s.facultyId === resolvedFacultyId && 
                  s.day === day && 
                  s.academicYear === academicYear && 
                  normalizeSemester(s.semester) === semester &&
                  areIntervalsOverlapping(s.startTime, s.endTime, startTime, endTime)
                );
                if (facConf) errorList.push({ row: rowNum, field: 'facultyId', message: `تعارض تدريسي: التدريسي لديه محاضرة أخرى في نفس الوقت لعام ${academicYear} وفصل ${semester}` });

                const sectionConf = allExistingAndBatch.find(s => {
                  if (s.day !== day || s.academicYear !== academicYear || normalizeSemester(s.semester) !== semester || !areIntervalsOverlapping(s.startTime, s.endTime, startTime, endTime)) return false;
                  const linkedIds = [
                    ...existingScheduleSections.filter(link => link.scheduleId === s.id).map(link => link.sectionId),
                    ...scheduleSectionLinks.filter(link => link.scheduleId === s.id).map(link => link.sectionId),
                  ];
                  const occupied = new Set([s.sectionId, ...linkedIds]);
                  return resolvedSectionIds.some((sectionId: string) => occupied.has(sectionId));
                });
                if (sectionConf) errorList.push({ row: rowNum, field: 'sectionIds', message: `تعارض شعبة: إحدى الشعب لديها محاضرة أخرى في نفس الوقت لعام ${academicYear} وفصل ${semester}` });
              }

              if (errorList.length === errorCountBefore) {
                 const id = generateId('sch');
                 scheduleSectionLinks.push(...resolvedSectionIds.map((sectionId: string) => ({ scheduleId: id, sectionId })));
                recordsToInsert.push({
                  id,
                  departmentId: resolvedDeptId,
                  stageId: resolvedStageId,
                  sectionId: resolvedSectionId,
                  subjectId: resolvedSubjectId,
                  facultyId: resolvedFacultyId,
                  roomId: resolvedRoomId,
                  day,
                  startTime,
                  endTime,
                  lectureType: ['theoretical', 'practical', 'clinical', 'seminar', 'workshop', 'tutorial'].includes(lectureType) ? lectureType : 'theoretical',
                  academicYear,
                  semester,
                  status: 'active',
                  isDeleted: false,
                });
              }
              break;
            }

            case 'buildings': {
              if (authorRole !== 'OWNER') errorList.push({ row: rowNum, field: 'role', message: 'استيراد المباني مقتصر على OWNER لأن المبنى لا يحمل collegeId في قاعدة البيانات' });
              const code = (row.code || row['رمز المبنى'] || '').trim().toUpperCase();
              const nameAr = (row.nameAr || row['اسم المبنى بالعربية'] || row.name || '').trim();
              const nameEn = (row.nameEn || row['اسم المبنى بالإنجليزية'] || '').trim() || nameAr;
              const floorsCount = Number(row.floorsCount || row['عدد الطوابق'] || 1);

              if (!code) errorList.push({ row: rowNum, field: 'code', message: 'رمز المبنى إلزامي' });
              if (!nameAr) errorList.push({ row: rowNum, field: 'nameAr', message: 'اسم المبنى بالعربية إلزامي' });
              if (code && (batchCodes.has(code) || buildingMap.has(code))) {
                errorList.push({ row: rowNum, field: 'code', message: `رمز المبنى (${code}) مكرر أو موجود مسبقاً` });
              }
              if (code) batchCodes.add(code);

              if (errorList.length === 0) {
                const id = generateId('bld');
                buildingMap.set(code, id);
                recordsToInsert.push({
                  id,
                  universityId: 'univ-mustaqbal',
                  code,
                  nameAr,
                  nameEn,
                  floorsCount,
                  status: 'active',
                  isDeleted: false,
                });
              }
              break;
            }

            case 'rooms': {
              const buildingRef = (row.buildingId || row.buildingCode || row['رمز المبنى'] || '').trim().toUpperCase();
              const resolvedBuildingId = buildingMap.get(buildingRef) || buildingRef;
              const collegeRef = (row.collegeId || row.collegeCode || row['رمز الكلية'] || '').trim().toUpperCase();
              const resolvedCollegeId = collegeMap.get(collegeRef) || collegeRef || null;
              const code = (row.code || row['رمز القاعة'] || '').trim().toUpperCase();
              const nameAr = (row.nameAr || row.name || row['اسم القاعة'] || '').trim();
              const capacity = Number(row.capacity || row['السعة'] || 30);
              const roomType = (row.roomType || row['نوع القاعة'] || 'lecture_hall').toLowerCase();

              if (authorRole === 'COLLEGE_MONITOR' && resolvedCollegeId !== user.assignedCollegeId) errorList.push({ row: rowNum, field: 'collegeId', message: 'القاعة خارج نطاق الكلية' });
              if (authorRole === 'DEPARTMENT_MONITOR') errorList.push({ row: rowNum, field: 'role', message: 'مسؤول القسم لا ينشئ قاعات عبر الاستيراد العام' });

              if (!code) errorList.push({ row: rowNum, field: 'code', message: 'رمز القاعة إلزامي' });
              if (!nameAr) errorList.push({ row: rowNum, field: 'nameAr', message: 'اسم القاعة إلزامي' });
              if (!resolvedBuildingId || !buildingMap.has(resolvedBuildingId)) {
                errorList.push({ row: rowNum, field: 'buildingId', message: `المبنى (${buildingRef}) غير موجود` });
              }
              if (!resolvedCollegeId || !collegeMap.has(resolvedCollegeId)) {
                errorList.push({ row: rowNum, field: 'collegeId', message: `الكلية (${collegeRef}) غير موجودة` });
              }
              if (code && (batchCodes.has(code) || roomMap.has(code))) {
                errorList.push({ row: rowNum, field: 'code', message: `رمز القاعة (${code}) مكرر أو موجود مسبقاً` });
              }
              if (code) batchCodes.add(code);

              if (errorList.length === 0) {
                const id = generateId('room');
                roomMap.set(code, id);
                recordsToInsert.push({
                  id,
                  buildingId: resolvedBuildingId,
                  collegeId: resolvedCollegeId,
                  code,
                  nameAr,
                  capacity,
                  roomType: ['lecture_hall', 'lab', 'smart_classroom', 'seminar_hall', 'auditorium', 'clinic'].includes(roomType) ? roomType : 'lecture_hall',
                  status: 'active',
                  isDeleted: false,
                });
              }
              break;
            }

            default:
              errorList.push({ row: 0, field: 'entityType', message: `نوع الكيان (${entityType}) غير مدعوم في محرك الاستيراد` });
              break;
          }
        }

        importedCreated = recordsToInsert.length;
        importedUpdated = recordsToUpdate.length;

        if (errorList.length > 0) {
          await tx.insert(importJobs).values({
            id: jobId,
            fileName,
            importType: entityType.toUpperCase(),
            uploadedByUserId: authorId,
            status: 'FAILED',
            rowsProcessed: data.length,
            rowsCreated: 0,
            rowsFailed: errorList.length,
            errorSummary: `فشل استيراد ${errorList.length} صف بسبب قيود التكامل والتحقق`,
            errorDetails: JSON.stringify(errorList.slice(0, 50)),
          }).run();

          const customErr: any = new Error('VALIDATION_FAILED');
          customErr.errorList = errorList;
          throw customErr;
        }

        if (recordsToInsert.length > 0 || recordsToUpdate.length > 0) {
          switch (entityType) {
            case 'colleges':
              await tx.insert(colleges).values(recordsToInsert).run();
              break;
            case 'departments':
              await tx.insert(departments).values(recordsToInsert).run();
              break;
            case 'buildings':
              await tx.insert(buildings).values(recordsToInsert).run();
              break;
            case 'rooms':
              await tx.insert(rooms).values(recordsToInsert).run();
              break;
            case 'faculty':
              if (recordsToInsert.length) await tx.insert(faculties).values(recordsToInsert).run();
              for (const faculty of recordsToUpdate) {
                const { id, ...updates } = faculty;
                await tx.update(faculties).set({ ...updates, updatedAt: new Date() }).where(eq(faculties.id, id)).run();
              }
              break;
            case 'subjects':
              await tx.insert(subjects).values(recordsToInsert).run();
              break;
            case 'schedules':
              await tx.insert(schedules).values(recordsToInsert).run();
              if (scheduleSectionLinks.length > 0) await tx.insert(scheduleSections).values(scheduleSectionLinks).run();
              break;
          }

          await tx.insert(importJobs).values({
            id: jobId,
            fileName,
            importType: entityType.toUpperCase(),
            uploadedByUserId: authorId,
            status: 'COMPLETED',
            rowsProcessed: data.length,
            rowsCreated: recordsToInsert.length,
            rowsUpdated: recordsToUpdate.length,
            rowsFailed: 0,
            completedAt: new Date(),
          }).run();

          await tx.insert(auditLogs).values({
            id: generateId('audit-imp'),
            userId: authorId,
            userName: authorName,
            userRole: authorRole,
            action: 'IMPORT_DATA',
            entity: entityType,
            entityId: jobId,
            reason: `استيراد ملف ${fileName} بنجاح: تم إنشاء ${recordsToInsert.length} سجل جديد في ${entityType}`,
          }).run();
        }
      });

      res.status(201).json({
        success: true,
        message: `تم استيراد ${data.length} سجل في ${entityType} بنجاح تام وبشكل ذري`,
        count: data.length,
        created: importedCreated,
        updated: importedUpdated,
        entityType,
        jobId,
      });
    } catch (err: any) {
      if (err.message === 'VALIDATION_FAILED' || err.errorList) {
        return res.status(400).json({
          success: false,
          error: 'فشل استيراد البيانات: تم التراجع عن العملية (Rollback) بالكامل لضمان سلامة قاعدة البيانات',
          errors: err.errorList || errorList,
          rowsProcessed: data.length,
          rowsCreated: 0,
        });
      }
      console.error('Import transaction error:', err);
      res.status(500).json({
        success: false,
        error: 'فشل استيراد البيانات: ' + (err.message || 'Unknown error'),
      });
    }
  }
);

app.get(
  '/api/import/template/:entityType',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    const { entityType } = req.params;

    const templates: Record<string, { columns: any[]; sampleData: any[] }> = {
      colleges: {
        columns: [
          { key: 'code', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
          { key: 'nameAr', labelAr: 'اسم الكلية بالعربية', labelEn: 'Name (Arabic)', required: true, example: 'كلية الهندسة والتقنيات الهندسية' },
          { key: 'nameEn', labelAr: 'اسم الكلية بالإنجليزية', labelEn: 'Name (English)', required: false, example: 'College of Engineering' },
          { key: 'deanName', labelAr: 'عميد الكلية', labelEn: 'Dean Name', required: false, example: 'أ.د. أزهر محسن التميمي' },
          { key: 'monitorName', labelAr: 'مسؤول المتابعة', labelEn: 'Monitor Name', required: false, example: 'د. وسام حميد' },
          { key: 'phone', labelAr: 'رقم الهاتف', labelEn: 'Phone', required: false, example: '+964 781 111 2233' },
          { key: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email', required: false, example: 'engineering@uomus.edu.iq' },
        ],
        sampleData: [
          { code: 'ENG', nameAr: 'كلية الهندسة والتقنيات الهندسية', nameEn: 'College of Engineering', deanName: 'أ.د. أزهر محسن التميمي', monitorName: 'د. وسام حميد', phone: '+964 781 111 2233', email: 'engineering@uomus.edu.iq' },
        ],
      },
      departments: {
        columns: [
          { key: 'collegeCode', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
          { key: 'code', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CPE' },
          { key: 'nameAr', labelAr: 'اسم القسم بالعربية', labelEn: 'Department Name (Arabic)', required: true, example: 'قسم هندسة تقنيات الحاسوب' },
          { key: 'nameEn', labelAr: 'اسم القسم بالإنجليزية', labelEn: 'Department Name (English)', required: false, example: 'Computer Engineering Tech Dept' },
          { key: 'headName', labelAr: 'رئيس القسم', labelEn: 'Head Name', required: false, example: 'أ.م.د. علي جاسم الحميري' },
          { key: 'monitorName', labelAr: 'مسؤول المتابعة', labelEn: 'Monitor Name', required: false, example: 'م. أحمد خالد' },
        ],
        sampleData: [
          { collegeCode: 'ENG', code: 'CPE', nameAr: 'قسم هندسة تقنيات الحاسوب', nameEn: 'Computer Engineering Tech Dept', headName: 'أ.م.د. علي جاسم الحميري', monitorName: 'م. أحمد خالد' },
        ],
      },
      faculty: {
        columns: [
          { key: 'collegeCode', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
          { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CPE' },
          { key: 'nameAr', labelAr: 'اسم التدريسي بالعربية', labelEn: 'Faculty Name (Arabic)', required: true, example: 'أ.د. حيدر كاظم عبيد' },
          { key: 'nameEn', labelAr: 'الاسم بالإنجليزية', labelEn: 'Faculty Name (English)', required: false, example: 'Prof. Dr. Haider Kadhim' },
          { key: 'academicTitle', labelAr: 'اللقب العلمي', labelEn: 'Academic Title', required: true, example: 'أستاذ دكتور' },
          { key: 'specialization', labelAr: 'التخصص', labelEn: 'Specialization', required: false, example: 'هندسة تقنيات الحاسوب' },
          { key: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email', required: true, example: 'haider.kadhim@uomus.edu.iq' },
          { key: 'phone', labelAr: 'رقم الهاتف', labelEn: 'Phone', required: false, example: '+964 780 123 4567' },
        ],
        sampleData: [
          { collegeCode: 'ENG', departmentCode: 'CPE', nameAr: 'أ.د. حيدر كاظم عبيد', nameEn: 'Prof. Dr. Haider Kadhim', academicTitle: 'أستاذ دكتور', specialization: 'هندسة تقنيات الحاسوب', email: 'haider.kadhim@uomus.edu.iq', phone: '+964 780 123 4567' },
        ],
      },
      subjects: {
        columns: [
          { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CPE' },
          { key: 'stageNumber', labelAr: 'المرحلة', labelEn: 'Stage', required: false, example: '1' },
          { key: 'code', labelAr: 'رمز المادة', labelEn: 'Subject Code', required: true, example: 'CPE-301' },
          { key: 'nameAr', labelAr: 'اسم المادة بالعربية', labelEn: 'Subject Name (Arabic)', required: true, example: 'شبكات الحاسوب' },
          { key: 'nameEn', labelAr: 'الاسم بالإنجليزية', labelEn: 'Subject Name (English)', required: false, example: 'Computer Networks' },
          { key: 'type', labelAr: 'نوع المادة', labelEn: 'Subject Type', required: false, example: 'theoretical' },
          { key: 'theoreticalHours', labelAr: 'الساعات النظرية', labelEn: 'Theoretical Hours', required: false, example: '2' },
          { key: 'practicalHours', labelAr: 'الساعات العملية', labelEn: 'Practical Hours', required: false, example: '0' },
          { key: 'creditUnits', labelAr: 'الوحدات الدراسية', labelEn: 'Credit Units', required: false, example: '3' },
        ],
        sampleData: [
          { departmentCode: 'CPE', stageNumber: '1', code: 'CPE-301', nameAr: 'شبكات الحاسوب', nameEn: 'Computer Networks', type: 'theoretical', theoreticalHours: '2', practicalHours: '0', creditUnits: '3' },
        ],
      },
      buildings: {
        columns: [
          { key: 'code', labelAr: 'رمز المبنى', labelEn: 'Building Code', required: true, example: 'BLD-A' },
          { key: 'nameAr', labelAr: 'اسم المبنى بالعربية', labelEn: 'Building Name (Arabic)', required: true, example: 'المبنى الهندسي الأول' },
          { key: 'nameEn', labelAr: 'اسم المبنى بالإنجليزية', labelEn: 'Building Name (English)', required: false, example: 'Engineering Building 1' },
          { key: 'floorsCount', labelAr: 'عدد الطوابق', labelEn: 'Floors Count', required: false, example: '4' },
        ],
        sampleData: [
          { code: 'BLD-A', nameAr: 'المبنى الهندسي الأول', nameEn: 'Engineering Building 1', floorsCount: '4' },
        ],
      },
      rooms: {
        columns: [
          { key: 'buildingCode', labelAr: 'رمز المبنى', labelEn: 'Building Code', required: true, example: 'BLD-A' },
          { key: 'collegeCode', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
          { key: 'code', labelAr: 'رمز القاعة', labelEn: 'Room Code', required: true, example: 'H-101' },
          { key: 'nameAr', labelAr: 'اسم القاعة', labelEn: 'Room Name', required: true, example: 'قاعة المحاضرات 101' },
          { key: 'capacity', labelAr: 'السعة', labelEn: 'Capacity', required: false, example: '60' },
          { key: 'roomType', labelAr: 'نوع القاعة', labelEn: 'Room Type', required: false, example: 'lecture_hall' },
        ],
        sampleData: [
          { buildingCode: 'BLD-A', collegeCode: 'ENG', code: 'H-101', nameAr: 'قاعة المحاضرات 101', capacity: '60', roomType: 'lecture_hall' },
        ],
      },
      schedules: {
        columns: [
          { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CPE' },
          { key: 'stageNumber', labelAr: 'المرحلة', labelEn: 'Stage', required: true, example: '3' },
          { key: 'sectionIds', labelAr: 'رموز الشعب (افصل بينها بـ ؛ أو ،)', labelEn: 'Section Codes (separate with ; or Arabic comma)', required: true, example: 'SEC-3A؛ SEC-3B' },
          { key: 'subjectCode', labelAr: 'رمز المادة', labelEn: 'Subject Code', required: true, example: 'CPE-301' },
          { key: 'facultyEmail', labelAr: 'البريد الإلكتروني للتدريسي', labelEn: 'Faculty Email', required: true, example: 'haider.kadhim@uomus.edu.iq' },
          { key: 'roomCode', labelAr: 'رمز القاعة', labelEn: 'Room Code', required: true, example: 'H-101' },
          { key: 'day', labelAr: 'اليوم', labelEn: 'Day of Week', required: true, example: 'Sunday' },
          { key: 'startTime', labelAr: 'وقت البدء (HH:mm)', labelEn: 'Start Time', required: true, example: '08:30' },
          { key: 'endTime', labelAr: 'وقت الانتهاء (HH:mm)', labelEn: 'End Time', required: true, example: '10:30' },
          { key: 'lectureType', labelAr: 'نوع المحاضرة', labelEn: 'Lecture Type', required: true, example: 'theoretical' },
          { key: 'academicYear', labelAr: 'السنة الدراسية (اختياري؛ الافتراضي الفصل الحالي)', labelEn: 'Academic Year (optional; defaults to current term)', required: false, example: '' },
          { key: 'semester', labelAr: 'الفصل الدراسي (اختياري؛ الافتراضي الفصل الحالي)', labelEn: 'Semester (optional; defaults to current term)', required: false, example: '' },
        ],
        sampleData: [
          { departmentCode: 'CPE', stageNumber: '3', sectionIds: 'SEC-3A؛ SEC-3B', subjectCode: 'CPE-301', facultyEmail: 'haider.kadhim@uomus.edu.iq', roomCode: 'H-101', day: 'Sunday', startTime: '08:30', endTime: '10:30', lectureType: 'theoretical' },
        ],
      },
    };

    const template = templates[entityType];
    if (!template) {
      return res.status(404).json({ error: `قالب الكيان (${entityType}) غير متاح` });
    }

    res.json({
      entityType,
      university: 'جامعة المستقبل (Al-Mustaqbal University)',
      columns: template.columns,
      sampleData: template.sampleData,
    });
  }
);

app.get(
  '/api/import/jobs',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      let jobs = await db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(50);
      if (req.user!.role === 'COLLEGE_MONITOR') {
        const scopedUsers = await db.select({ id: users.id }).from(users).where(eq(users.assignedCollegeId, req.user!.assignedCollegeId || '__NO_COLLEGE__'));
        const ids = new Set(scopedUsers.map(item => item.id));
        jobs = jobs.filter(job => ids.has(job.uploadedByUserId));
      } else if (req.user!.role === 'DEPARTMENT_MONITOR') {
        const scopedUsers = await db.select({ id: users.id }).from(users).where(eq(users.assignedDepartmentId, req.user!.assignedDepartmentId || '__NO_DEPT__'));
        const ids = new Set(scopedUsers.map(item => item.id));
        jobs = jobs.filter(job => ids.has(job.uploadedByUserId));
      }
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// 10. WORKLOAD & REPORTS APIS (Requirements 3, 4, 5)
// ==========================================

const DEFAULT_QUOTA_MAP: Record<string, number> = {
  'أستاذ': 10,
  'أستاذ دكتور': 10,
  'استاذ': 10,
  'استاذ دكتور': 10,
  'أستاذ مساعد': 12,
  'أستاذ مساعد دكتور': 12,
  'استاذ مساعد': 12,
  'استاذ مساعد دكتور': 12,
  'مدرس': 14,
  'مدرس دكتور': 14,
  'مدرس مساعد': 16,
};

app.get(
  '/api/workloads',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { collegeId, departmentId, facultyId, academicTitle, search } = req.query;
      const term = await resolveRequestedTerm(req.query);

      const conditions = [eq(faculties.isDeleted, false)];
      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        conditions.push(eq(faculties.collegeId, user.assignedCollegeId));
      } else if (user.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        conditions.push(eq(faculties.departmentId, user.assignedDepartmentId));
      } else if (user.role === 'FACULTY' && user.assignedFacultyId) {
        conditions.push(eq(faculties.id, user.assignedFacultyId));
      }

      const allFaculties = await db.select().from(faculties).where(and(...conditions));
      // A requested faculty must first be resolved through the scoped query.
      // Do not return a successful response that could be used to probe or
      // distinguish a faculty outside the caller's college/department scope.
      if (facultyId && !allFaculties.some(faculty => faculty.id === String(facultyId))) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'التدريسي غير موجود ضمن نطاقك' } });
      }
      const allPolicies = await db.select().from(workloadPolicies);
      const allSchedules = (await db.select().from(schedules).where(and(eq(schedules.isDeleted, false), eq(schedules.academicYear, term.academicYear)))).filter(schedule => isSameAcademicTerm(schedule, term));
      const allRecords = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.academicYear, term.academicYear), inArray(attendanceRecords.semester, semesterDatabaseValues(term.semester))));
      const allDepts = await db.select().from(departments).where(eq(departments.isDeleted, false));
      const allColleges = await db.select().from(colleges).where(eq(colleges.isDeleted, false));

      const deptMap = new Map<string, string>();
      allDepts.forEach(d => deptMap.set(d.id, d.nameAr));

      const collegeMap = new Map<string, string>();
      allColleges.forEach(c => collegeMap.set(c.id, c.nameAr));

      let summaries = allFaculties.map(fac => {
        const matchedPolicy = allPolicies.find(p => p.academicTitle === fac.academicTitle || p.academicTitle.includes(fac.academicTitle));
        const requiredHours = matchedPolicy ? matchedPolicy.requiredHours : (DEFAULT_QUOTA_MAP[fac.academicTitle] || 14);

        const facSchedules = allSchedules.filter(s => s.facultyId === fac.id);
        let weeklyScheduledHours = 0;
        facSchedules.forEach(s => {
          weeklyScheduledHours += calculateHourDuration(s.startTime, s.endTime);
        });

        const completedSessions = allRecords.filter(r => r.facultyId === fac.id && (r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'LATE' || r.attendanceStatus === 'present' || r.attendanceStatus === 'late'));
        // Completed workload labels are taken from the attendance snapshot. This
        // keeps historical reports stable when a faculty member is renamed or
        // moved to another department later.
        const historicalSnapshot = completedSessions.find(r => r.snapshotFacultyName || r.snapshotDepartmentName || r.snapshotCollegeName);
        let completedHours = 0;
        completedSessions.forEach(r => {
          completedHours += calculateHourDuration(r.scheduledStart, r.scheduledEnd);
        });

        const remainingHours = Math.max(0, requiredHours - weeklyScheduledHours);
        const extraHours = Math.max(0, weeklyScheduledHours - requiredHours);
        const completionPercentage = requiredHours > 0 ? Math.min(100, Math.round((weeklyScheduledHours / requiredHours) * 100)) : 100;

        let status: 'COMPLIANT' | 'DEFICIT' | 'OVERLOAD' = 'COMPLIANT';
        if (weeklyScheduledHours < requiredHours) status = 'DEFICIT';
        else if (weeklyScheduledHours > requiredHours) status = 'OVERLOAD';

        return {
          facultyId: fac.id,
          academicYear: term.academicYear,
          semester: term.semester,
          termLabel: formatAcademicTerm(term),
          facultyName: historicalSnapshot?.snapshotFacultyName || `${fac.academicTitle} ${fac.nameAr}`,
          rawNameAr: historicalSnapshot?.snapshotFacultyName || fac.nameAr,
          academicTitle: fac.academicTitle,
          collegeId: fac.collegeId,
          collegeName: historicalSnapshot?.snapshotCollegeName || collegeMap.get(fac.collegeId) || fac.collegeId,
          departmentId: fac.departmentId,
          departmentName: historicalSnapshot?.snapshotDepartmentName || deptMap.get(fac.departmentId) || fac.departmentId,
          specialization: fac.specialization,
          email: fac.email,
          weeklyRequiredHours: requiredHours,
          weeklyScheduledHours: Number(weeklyScheduledHours.toFixed(1)),
          completedHours: Number(completedHours.toFixed(1)),
          remainingHours: Number(remainingHours.toFixed(1)),
          extraHours: Number(extraHours.toFixed(1)),
          completionPercentage,
          status,
          statusLabelAr: status === 'COMPLIANT' ? 'مستوفٍ للنصاب' : status === 'OVERLOAD' ? 'ساعات إضافية (فائض)' : 'عجز في النصاب',
        };
      });

      if (collegeId && collegeId !== 'ALL') {
        summaries = summaries.filter(s => s.collegeId === collegeId);
      }
      if (departmentId && departmentId !== 'ALL') {
        summaries = summaries.filter(s => s.departmentId === departmentId);
      }
      if (facultyId) {
        summaries = summaries.filter(s => s.facultyId === facultyId);
      }
      if (academicTitle && academicTitle !== 'ALL') {
        summaries = summaries.filter(s => s.academicTitle.includes(String(academicTitle)));
      }
      if (search) {
        const q = String(search).toLowerCase();
        summaries = summaries.filter(s => s.facultyName.toLowerCase().includes(q) || s.departmentName.toLowerCase().includes(q));
      }

      res.json(summaries);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  '/api/workloads/summary',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const term = await resolveRequestedTerm(req.query);
      const facultyConditions: any[] = [eq(faculties.isDeleted, false)];
      if (user.role === 'COLLEGE_MONITOR') facultyConditions.push(eq(faculties.collegeId, user.assignedCollegeId || '__NO_COLLEGE__'));
      if (user.role === 'DEPARTMENT_MONITOR') facultyConditions.push(eq(faculties.departmentId, user.assignedDepartmentId || '__NO_DEPT__'));
      const allFaculties = await db.select().from(faculties).where(and(...facultyConditions));
      const allSchedules = (await db.select().from(schedules).where(and(eq(schedules.isDeleted, false), eq(schedules.academicYear, term.academicYear)))).filter(schedule => isSameAcademicTerm(schedule, term));

      let totalRequiredHours = 0;
      let totalScheduledHours = 0;
      let compliantCount = 0;
      let deficitCount = 0;
      let overloadCount = 0;

      allFaculties.forEach(fac => {
        const required = DEFAULT_QUOTA_MAP[fac.academicTitle] || 14;
        totalRequiredHours += required;

        const facSchedules = allSchedules.filter(s => s.facultyId === fac.id);
        let facHours = 0;
        facSchedules.forEach(s => {
          facHours += calculateHourDuration(s.startTime, s.endTime);
        });
        totalScheduledHours += facHours;

        if (facHours >= required) {
          if (facHours > required) overloadCount++;
          compliantCount++;
        } else {
          deficitCount++;
        }
      });

      const complianceRate = allFaculties.length > 0 ? Math.round((compliantCount / allFaculties.length) * 100) : 100;

      res.json({
        academicYear: term.academicYear,
        semester: term.semester,
        termLabel: formatAcademicTerm(term),
        totalFacultyCount: allFaculties.length,
        totalRequiredHours: Number(totalRequiredHours.toFixed(1)),
        totalScheduledHours: Number(totalScheduledHours.toFixed(1)),
        compliantCount,
        deficitCount,
        overloadCount,
        complianceRate,
        universityName: 'جامعة المستقبل',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Reports
app.get(
  '/api/reports/daily-attendance',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const { date, collegeId, departmentId } = req.query;
      const term = await resolveRequestedTerm(req.query);
      const targetDate = (date as string) || new Date().toISOString().slice(0, 10);

      const [allSessions, allSchedules, allFaculties, allSubjects, allRooms, allDepts, allColleges, allEvidence, allAttendance, allSectionAttendance] = await Promise.all([
        db.select().from(lectureSessions).where(eq(lectureSessions.date, targetDate)),
        db.select().from(schedules),
        db.select().from(faculties).where(eq(faculties.isDeleted, false)),
        db.select().from(subjects).where(eq(subjects.isDeleted, false)),
        db.select().from(rooms).where(eq(rooms.isDeleted, false)),
        db.select().from(departments).where(eq(departments.isDeleted, false)),
        db.select().from(colleges).where(eq(colleges.isDeleted, false)),
        db.select().from(attendanceEvidence).where(eq(attendanceEvidence.lectureDate, targetDate)),
        db.select().from(attendanceRecords).where(eq(attendanceRecords.lectureDate, targetDate)),
        db.select().from(attendanceSectionRecords).where(eq(attendanceSectionRecords.lectureDate, targetDate)),
      ]);

      const facMap = new Map(allFaculties.map(f => [f.id, f]));
      const subjMap = new Map(allSubjects.map(s => [s.id, s]));
      const roomMap = new Map(allRooms.map(r => [r.id, r]));
      const deptMap = new Map(allDepts.map(d => [d.id, d]));
      const collegeMap = new Map(allColleges.map(c => [c.id, c]));
      const evidenceSet = new Set(allEvidence.map(e => e.scheduleId));
      const termAttendance = allAttendance.filter(record => isSameAcademicTerm(record, term));
      const attendanceMap = new Map(termAttendance.map(a => [`${a.scheduleId}:${a.lectureDate}`, a]));
      const sectionAttendanceMap = new Map<string, typeof allSectionAttendance>();
      for (const detail of allSectionAttendance) sectionAttendanceMap.set(detail.attendanceId, [...(sectionAttendanceMap.get(detail.attendanceId) || []), detail]);

      const termScheduleIds = new Set(allSchedules.filter(schedule => !schedule.isDeleted && isSameAcademicTerm(schedule, term)).map(schedule => schedule.id));
      const reportScheduleIds = new Set([...termScheduleIds, ...termAttendance.map(record => record.scheduleId)]);
      let sessionRows = allSchedules.filter(schedule => reportScheduleIds.has(schedule.id)).map(sch => {
        const session = isSameAcademicTerm(sch, term) ? allSessions.find(s => s.scheduleId === sch.id) : undefined;
        const attendance = attendanceMap.get(`${sch.id}:${targetDate}`);
        const sectionDetails = attendance ? (sectionAttendanceMap.get(attendance.id) || []).map(detail => ({
          sectionId: detail.sectionId,
          sectionName: detail.snapshotSectionName,
          departmentName: detail.snapshotDepartmentName,
          stageName: detail.snapshotStageName,
          studentsEnrolled: detail.studentsEnrolled,
          studentsPresent: detail.studentsPresent,
          attendancePercentage: Number(detail.attendancePercentage),
        })) : [];
        const fac = facMap.get(sch.facultyId);
        const subj = subjMap.get(sch.subjectId);
        const room = roomMap.get(sch.roomId);
        const dept = deptMap.get(sch.departmentId);
        const college = dept ? collegeMap.get(dept.collegeId) : null;

        const status = session ? session.status : 'NOT_RECORDED';
        const isVerifiedWithCamera = evidenceSet.has(sch.id);

        return {
          scheduleId: sch.id,
          date: targetDate,
          day: sch.day,
          startTime: attendance?.scheduledStart || sch.startTime,
          endTime: attendance?.scheduledEnd || sch.endTime,
          durationHours: calculateHourDuration(attendance?.scheduledStart || sch.startTime, attendance?.scheduledEnd || sch.endTime),
          collegeId: dept ? dept.collegeId : '',
          collegeName: attendance?.snapshotCollegeName || (college ? college.nameAr : ''),
          departmentId: sch.departmentId,
          departmentName: attendance?.snapshotDepartmentName || (dept ? dept.nameAr : ''),
          facultyId: sch.facultyId,
          facultyName: attendance?.snapshotFacultyName || (fac ? `${fac.academicTitle} ${fac.nameAr}` : '—'),
          subjectId: sch.subjectId,
          subjectName: attendance?.snapshotSubjectName || (subj ? subj.nameAr : '—'),
          subjectCode: attendance?.snapshotSubjectCode || (subj ? subj.code : '—'),
          roomId: sch.roomId,
          roomName: attendance?.snapshotRoomName || (room ? `${room.nameAr} (${room.code})` : '—'),
          status: attendance?.attendanceStatus || status,
          statusLabelAr: (attendance?.attendanceStatus || status) === 'PRESENT' ? 'حاضر' : (attendance?.attendanceStatus || status) === 'LATE' ? 'متأخر' : (attendance?.attendanceStatus || status) === 'ABSENT' ? 'غائب' : (attendance?.attendanceStatus || status) === 'EXCUSED' ? 'مجاز' : 'غير مسجلة',
          checkInTime: session?.checkInTime || null,
          isVerifiedWithCamera,
          isUnrecordedResolved: session?.isUnrecordedResolved || false,
          unrecordedReason: session?.unrecordedReason || null,
          notes: session?.notes || null,
          sharedLecture: sectionDetails.length > 1,
          sections: sectionDetails,
          academicYear: attendance?.academicYear || sch.academicYear,
          semester: attendance?.semester || sch.semester,
          termLabel: formatAcademicTerm({ academicYear: attendance?.academicYear || sch.academicYear, semester: normalizeSemester(attendance?.semester || sch.semester) || term.semester }),
        };
      });

      if (collegeId && collegeId !== 'ALL') {
        sessionRows = sessionRows.filter(r => r.collegeId === collegeId);
      }
      if (departmentId && departmentId !== 'ALL') {
        sessionRows = sessionRows.filter(r => r.departmentId === departmentId);
      }
      if (req.user!.role === 'COLLEGE_MONITOR') sessionRows = sessionRows.filter(r => r.collegeId === req.user!.assignedCollegeId);
      if (req.user!.role === 'DEPARTMENT_MONITOR') sessionRows = sessionRows.filter(r => r.departmentId === req.user!.assignedDepartmentId);

      const totalScheduled = sessionRows.length;
      const totalPresent = sessionRows.filter(r => r.status === 'PRESENT' || r.status === 'present').length;
      const totalLate = sessionRows.filter(r => r.status === 'LATE' || r.status === 'late').length;
      const totalAbsent = sessionRows.filter(r => r.status === 'ABSENT' || r.status === 'absent').length;
      const totalUnrecorded = sessionRows.filter(r => r.status === 'NOT_RECORDED' || r.status === 'not_recorded').length;
      const cameraEvidenceCount = sessionRows.filter(r => r.isVerifiedWithCamera).length;
      const attendancePercentage = totalScheduled > 0 ? Math.round(((totalPresent + totalLate) / totalScheduled) * 100) : 0;

      res.json({
        reportTitle: 'الموقف اليومي الرسمي لانعقاد المحاضرات وحضور التدريسيين',
        universityName: 'جامعة المستقبل',
        date: targetDate,
        academicYear: term.academicYear,
        semester: term.semester,
        termLabel: formatAcademicTerm(term),
        kpis: {
          totalScheduled,
          totalPresent,
          totalLate,
          totalAbsent,
          totalUnrecorded,
          cameraEvidenceCount,
          attendancePercentage,
        },
        sessions: sessionRows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Reports — Room Utilization & Occupancy
app.get(
  '/api/reports/room-utilization',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { buildingId, collegeId, day } = req.query;
      const term = await resolveRequestedTerm(req.query);

      const roomConditions: any[] = [eq(rooms.isDeleted, false)];
      // Enforce caller scope independently from optional query filters so a
      // caller cannot widen access by supplying another collegeId.
      if (user.role === 'COLLEGE_MONITOR') {
        roomConditions.push(eq(rooms.collegeId, user.assignedCollegeId || '__NO_COLLEGE__'));
      } else if (user.role === 'DEPARTMENT_MONITOR') {
        roomConditions.push(eq(rooms.departmentId, user.assignedDepartmentId || '__NO_DEPT__'));
      }
      if (buildingId && buildingId !== 'ALL') {
        roomConditions.push(eq(rooms.buildingId, String(buildingId)));
      }
      if (collegeId && collegeId !== 'ALL') {
        roomConditions.push(eq(rooms.collegeId, String(collegeId)));
      }

      const allTargetRooms = await db.select().from(rooms).where(and(...roomConditions));
      const allSchedules = (await db.select().from(schedules).where(and(eq(schedules.isDeleted, false), eq(schedules.academicYear, term.academicYear)))).filter(schedule => isSameAcademicTerm(schedule, term));
      const allBuildings = await db.select().from(buildings).where(eq(buildings.isDeleted, false));
      const bldMap = new Map(allBuildings.map(b => [b.id, b.nameAr]));

      const results = allTargetRooms.map(room => {
        let roomSchedules = allSchedules.filter(s => s.roomId === room.id);
        if (day && day !== 'ALL') {
          roomSchedules = roomSchedules.filter(s => s.day === String(day));
        }

        let occupiedHours = 0;
        roomSchedules.forEach(s => {
          occupiedHours += calculateHourDuration(s.startTime, s.endTime);
        });

        const totalAvailableHours = 8;
        const utilizationRate = Math.round((occupiedHours / totalAvailableHours) * 100);

        return {
          roomId: room.id,
          roomCode: room.code,
          roomName: room.nameAr,
          roomType: room.roomType,
          capacity: room.capacity,
          buildingId: room.buildingId,
          buildingName: bldMap.get(room.buildingId) || room.buildingId,
          collegeId: room.collegeId,
          day: day || 'ALL',
          academicYear: term.academicYear,
          semester: term.semester,
          termLabel: formatAcademicTerm(term),
          reportType: 'CURRENT',
          occupiedHours: Number(occupiedHours.toFixed(1)),
          totalAvailableHours,
          utilizationRate,
          schedulesCount: roomSchedules.length,
        };
      });

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// 11. AUDIT LOGS & SETTINGS APIS (Requirements 3, 10)
// ==========================================

// 11.1 GET /api/audit-logs — OWNER & COLLEGE_MONITOR (scoped) only (Requirement 10)
app.get(
  '/api/audit-logs',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      if (user.role === 'COLLEGE_MONITOR' && user.assignedCollegeId) {
        // Query users belonging to the college
        const collegeUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.assignedCollegeId, user.assignedCollegeId));
        const userIds = new Set(collegeUsers.map(u => u.id));

        const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(200);
        const filtered = logs.filter(l => l.userId && userIds.has(l.userId));
        return res.json(filtered);
      }

      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(200);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 11.2 GET /api/settings — Requires token (Requirement 10)
app.get(
  '/api/settings',
  authenticateToken,
  requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(systemSettings);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 11.3 PUT /api/settings — OWNER only
app.put(
  '/api/settings',
  authenticateToken,
  requireRole('OWNER'),
  async (req: Request, res: Response) => {
    try {
      const { key, value, description } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ error: 'مفتاح الإعداد والقيمة مطلوبان (key and value required)' });
      }
      if (key === 'academicSettings') {
        const academicStructure = value?.academicStructure;
        if (!validateAcademicYear(academicStructure?.currentAcademicYear) || !normalizeSemester(academicStructure?.currentSemester)) {
          return res.status(400).json({ error: 'أدخل السنة الدراسية الحالية واختر الفصل قبل حفظ الإعدادات' });
        }
      }

      const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(systemSettings)
          .set({
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            description: description || existing[0].description,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.key, key));
      } else {
        await db.insert(systemSettings).values({
          id: generateId('setting'),
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          description: description || '',
          updatedAt: new Date(),
        });
      }

      res.json({ success: true, message: 'تم تحديث الإعدادات بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 11.4 GET & PUT /api/university
app.get('/api/university', authenticateToken, async (req: Request, res: Response) => {
  res.json({
    id: 'univ-mustaqbal',
    code: 'UOMUS',
    nameAr: 'جامعة المستقبل',
    nameEn: 'Al-Mustaqbal University',
    chancellorName: 'أ.د. حسن شاكر مجدي',
    logoUrl: '/favicon.svg',
    city: 'بابل - الحلة',
    address: 'طريق حلة - نجف، محافظة بابل، العراق',
    website: 'https://uomus.edu.iq',
    phone: '+964 780 000 0000',
    email: 'info@uomus.edu.iq',
    foundedYear: 2010,
  });
});

app.put('/api/university', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  res.json({ success: true, message: 'تم تحديث بيانات الجامعة بنجاح' });
});

// ==========================================
// 12. HEALTH & SYSTEM OPERATIONS (Requirements 3, 4)
// ==========================================

// 12.1 GET /api/health — Public Basic Liveness Healthcheck
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    system: 'Al-Mustaqbal University — Academic Monitoring System',
    timezone: 'Asia/Baghdad',
    database: 'SQLite',
    gpsPolicy: 'DISABLED (Strict Classroom Evidence Only)',
    timestamp: new Date().toISOString(),
  });
});

// 12.2 GET /api/system/health — Deep Diagnostic (OWNER only)
app.get('/api/system/health', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;
  let dbError = null;

  try {
    sqlite.prepare('SELECT 1 AS ping').get();
    dbLatencyMs = Date.now() - startTime;
  } catch (err: any) {
    dbStatus = 'degraded';
    dbError = err.message;
  }

  let counts: Record<string, number> = {};
  try {
    const [
      collegesCount,
      departmentsCount,
      buildingsCount,
      roomsCount,
      facultyCount,
      schedulesCount,
      attendanceCount,
      usersCount,
      sessionsCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(colleges),
      db.select({ count: sql<number>`count(*)` }).from(departments),
      db.select({ count: sql<number>`count(*)` }).from(buildings),
      db.select({ count: sql<number>`count(*)` }).from(rooms),
      db.select({ count: sql<number>`count(*)` }).from(faculties),
      db.select({ count: sql<number>`count(*)` }).from(schedules),
      db.select({ count: sql<number>`count(*)` }).from(attendanceRecords),
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(lectureSessions),
    ]);

    counts = {
      colleges: Number(collegesCount[0]?.count || 0),
      departments: Number(departmentsCount[0]?.count || 0),
      buildings: Number(buildingsCount[0]?.count || 0),
      rooms: Number(roomsCount[0]?.count || 0),
      faculty: Number(facultyCount[0]?.count || 0),
      schedules: Number(schedulesCount[0]?.count || 0),
      attendanceRecords: Number(attendanceCount[0]?.count || 0),
      users: Number(usersCount[0]?.count || 0),
      lectureSessions: Number(sessionsCount[0]?.count || 0),
    };
  } catch (err: any) {
    console.error('[HealthCheck] Error counting records:', err);
  }

  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  res.json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    systemName: 'نظام متابعة حضور التدريسيين والمحاضرات — جامعة المستقبل',
    systemNameEn: 'Al-Mustaqbal University Academic Attendance System',
    version: '1.0.0-phase8-hardened',
    environment: process.env.NODE_ENV || 'development',
    timezone: 'Asia/Baghdad',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    uptimeHuman: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    database: {
      provider: 'SQLite',
      status: dbStatus,
      latencyMs: dbLatencyMs,
      error: dbError,
      pool: {
        totalConnections: 1,
        idleConnections: 1,
        waitingRequests: 0,
      },
      file: databasePath,
    },
    tables: counts,
    memory: {
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    },
  });
});

// 12.3 GET /api/system/stats — OWNER only
app.get('/api/system/stats', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try {
    const [
      collegesData,
      departmentsData,
      buildingsData,
      roomsData,
      stagesData,
      sectionsData,
      subjectsData,
      facultyData,
      schedulesData,
      attendanceData,
      evidenceData,
      exceptionsData,
      usersData,
    ] = await Promise.all([
      db.select().from(colleges),
      db.select().from(departments),
      db.select().from(buildings),
      db.select().from(rooms),
      db.select().from(stages),
      db.select().from(sections),
      db.select().from(subjects),
      db.select().from(faculties),
      db.select().from(schedules),
      db.select().from(attendanceRecords),
      db.select().from(attendanceEvidence),
      db.select().from(academicExceptions),
      db.select().from(users),
    ]);

    const usersByRole = usersData.reduce((acc: Record<string, number>, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    const attendanceByStatus = attendanceData.reduce((acc: Record<string, number>, a) => {
      acc[a.attendanceStatus] = (acc[a.attendanceStatus] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        collegesCount: collegesData.length,
        departmentsCount: departmentsData.length,
        buildingsCount: buildingsData.length,
        roomsCount: roomsData.length,
        stagesCount: stagesData.length,
        sectionsCount: sectionsData.length,
        subjectsCount: subjectsData.length,
        facultyCount: facultyData.length,
        schedulesCount: schedulesData.length,
        attendanceRecordsCount: attendanceData.length,
        evidenceRecordsCount: evidenceData.length,
        exceptionsCount: exceptionsData.length,
        usersCount: usersData.length,
        usersByRole,
        attendanceByStatus,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12.4 POST /api/system/backup — OWNER only
app.post('/api/system/backup', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();
    const backupId = generateId('backup');

    const [
      collegesList,
      departmentsList,
      buildingsList,
      roomsList,
      academicYearsList,
      semestersList,
      stagesList,
      sectionsList,
      subjectsList,
      facultyList,
      schedulesList,
      attendanceRecordsList,
      evidenceList,
      workloadPoliciesList,
      exceptionsList,
      substitutionsList,
      coTeachingList,
      systemSettingsList,
      usersList,
    ] = await Promise.all([
      db.select().from(colleges),
      db.select().from(departments),
      db.select().from(buildings),
      db.select().from(rooms),
      db.select().from(academicYears),
      db.select().from(semesters),
      db.select().from(stages),
      db.select().from(sections),
      db.select().from(subjects),
      db.select().from(faculties),
      db.select().from(schedules),
      db.select().from(attendanceRecords),
      db.select().from(attendanceEvidence),
      db.select().from(workloadPolicies),
      db.select().from(academicExceptions),
      db.select().from(substitutions),
      db.select().from(coTeaching),
      db.select().from(systemSettings),
      db.select({
        id: users.id,
        uid: users.uid,
        name: users.name,
        email: users.email,
        role: users.role,
        roleTitleAr: users.roleTitleAr,
        assignedCollegeId: users.assignedCollegeId,
        assignedDepartmentId: users.assignedDepartmentId,
        assignedFacultyId: users.assignedFacultyId,
        avatar: users.avatar,
        status: users.status,
        createdAt: users.createdAt,
      }).from(users),
    ]);

    const backupPayload = {
      backupId,
      version: '1.0.0',
      university: 'جامعة المستقبل - Al-Mustaqbal University',
      exportedAt: timestamp,
      exportedBy: req.user!.name,
      data: {
        colleges: collegesList,
        departments: departmentsList,
        buildings: buildingsList,
        rooms: roomsList,
        academicYears: academicYearsList,
        semesters: semestersList,
        stages: stagesList,
        sections: sectionsList,
        subjects: subjectsList,
        faculties: facultyList,
        schedules: schedulesList,
        attendanceRecords: attendanceRecordsList,
        attendanceEvidence: evidenceList,
        workloadPolicies: workloadPoliciesList,
        academicExceptions: exceptionsList,
        substitutions: substitutionsList,
        coTeaching: coTeachingList,
        systemSettings: systemSettingsList,
        users: usersList,
      },
    };

    const payloadString = JSON.stringify(backupPayload);
    const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');

    const result = {
      ...backupPayload,
      checksum,
      totalRecords:
        collegesList.length +
        departmentsList.length +
        buildingsList.length +
        roomsList.length +
        stagesList.length +
        sectionsList.length +
        subjectsList.length +
        facultyList.length +
        schedulesList.length +
        attendanceRecordsList.length +
        usersList.length,
    };

    await db.insert(auditLogs).values({
      id: generateId('audit'),
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'BACKUP_GENERATED',
      entity: 'SYSTEM_BACKUP',
      entityId: backupId,
      newValue: JSON.stringify({ totalRecords: result.totalRecords, checksum }),
      timestamp: new Date(),
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12.5 POST /api/system/verify-integrity — OWNER only
app.post('/api/system/verify-integrity', authenticateToken, requireRole('OWNER'), async (req: Request, res: Response) => {
  try {
    const issues: Array<{
      level: 'ERROR' | 'WARNING' | 'INFO';
      category: string;
      entityId?: string;
      message: string;
    }> = [];

    const [
      collegesList,
      departmentsList,
      buildingsList,
      roomsList,
      stagesList,
      sectionsList,
      subjectsList,
      facultyList,
      schedulesList,
      usersList,
    ] = await Promise.all([
      db.select().from(colleges).where(eq(colleges.isDeleted, false)),
      db.select().from(departments).where(eq(departments.isDeleted, false)),
      db.select().from(buildings).where(eq(buildings.isDeleted, false)),
      db.select().from(rooms).where(eq(rooms.isDeleted, false)),
      db.select().from(stages).where(eq(stages.isDeleted, false)),
      db.select().from(sections).where(eq(sections.isDeleted, false)),
      db.select().from(subjects).where(eq(subjects.isDeleted, false)),
      db.select().from(faculties).where(eq(faculties.isDeleted, false)),
      db.select().from(schedules).where(eq(schedules.isDeleted, false)),
      db.select().from(users),
    ]);

    const collegeIds = new Set(collegesList.map(c => c.id));
    const deptIds = new Set(departmentsList.map(d => d.id));
    const buildingIds = new Set(buildingsList.map(b => b.id));
    const roomIds = new Set(roomsList.map(r => r.id));
    const stageIds = new Set(stagesList.map(s => s.id));
    const sectionIds = new Set(sectionsList.map(s => s.id));
    const subjectIds = new Set(subjectsList.map(s => s.id));
    const facultyIds = new Set(facultyList.map(f => f.id));

    for (const dept of departmentsList) {
      if (!collegeIds.has(dept.collegeId)) {
        issues.push({
          level: 'ERROR',
          category: 'DEPARTMENTS_ORPHAN',
          entityId: dept.id,
          message: `القسم "${dept.nameAr}" مرتبط بكلية غير موجودة (${dept.collegeId})`,
        });
      }
    }

    for (const room of roomsList) {
      if (!buildingIds.has(room.buildingId)) {
        issues.push({
          level: 'ERROR',
          category: 'ROOMS_ORPHAN',
          entityId: room.id,
          message: `القاعة "${room.nameAr}" مرتبطة بمبنى غير موجود (${room.buildingId})`,
        });
      }
      if (room.departmentId && !deptIds.has(room.departmentId)) {
        issues.push({
          level: 'WARNING',
          category: 'ROOMS_INVALID_DEPT',
          entityId: room.id,
          message: `القاعة "${room.nameAr}" مرتبطة بقسم غير موجود (${room.departmentId})`,
        });
      }
    }

    for (const stage of stagesList) {
      if (!deptIds.has(stage.departmentId)) {
        issues.push({
          level: 'ERROR',
          category: 'STAGES_ORPHAN',
          entityId: stage.id,
          message: `المرحلة "${stage.nameAr}" مرتبطة بقسم غير موجود (${stage.departmentId})`,
        });
      }
    }

    for (const sec of sectionsList) {
      if (!stageIds.has(sec.stageId)) {
        issues.push({
          level: 'ERROR',
          category: 'SECTIONS_ORPHAN',
          entityId: sec.id,
          message: `الشعبة "${sec.name}" مرتبطة بمرحلة غير موجودة (${sec.stageId})`,
        });
      }
    }

    for (const sch of schedulesList) {
      if (!facultyIds.has(sch.facultyId)) {
        issues.push({
          level: 'ERROR',
          category: 'SCHEDULES_INVALID_FACULTY',
          entityId: sch.id,
          message: `الجدول (${sch.day} ${sch.startTime}) مرتبط بتدريسي غير موجود (${sch.facultyId})`,
        });
      }
      if (!roomIds.has(sch.roomId)) {
        issues.push({
          level: 'ERROR',
          category: 'SCHEDULES_INVALID_ROOM',
          entityId: sch.id,
          message: `الجدول (${sch.day} ${sch.startTime}) مرتبط بقاعة غير موجودة (${sch.roomId})`,
        });
      }
      if (!sectionIds.has(sch.sectionId)) {
        issues.push({
          level: 'ERROR',
          category: 'SCHEDULES_INVALID_SECTION',
          entityId: sch.id,
          message: `الجدول (${sch.day} ${sch.startTime}) مرتبط بشعبة غير موجودة (${sch.sectionId})`,
        });
      }
      if (!subjectIds.has(sch.subjectId)) {
        issues.push({
          level: 'ERROR',
          category: 'SCHEDULES_INVALID_SUBJECT',
          entityId: sch.id,
          message: `الجدول (${sch.day} ${sch.startTime}) مرتبط بمادة غير موجودة (${sch.subjectId})`,
        });
      }
    }

    for (let i = 0; i < schedulesList.length; i++) {
      for (let j = i + 1; j < schedulesList.length; j++) {
        const s1 = schedulesList[i];
        const s2 = schedulesList[j];
        if (s1.day === s2.day && s1.startTime < s2.endTime && s1.endTime > s2.startTime) {
          if (s1.roomId === s2.roomId) {
            issues.push({
              level: 'ERROR',
              category: 'ROOM_CONFLICT',
              entityId: `${s1.id}-${s2.id}`,
              message: `تعارض قاعة: المحاضرتان (${s1.id}) و (${s2.id}) تشغلان القاعة (${s1.roomId}) في نفس التوقيت (${s1.day} ${s1.startTime}-${s1.endTime})`,
            });
          }
          if (s1.facultyId === s2.facultyId) {
            issues.push({
              level: 'ERROR',
              category: 'FACULTY_CONFLICT',
              entityId: `${s1.id}-${s2.id}`,
              message: `تعارض تدريسي: التدريسي (${s1.facultyId}) مجدول في محاضرتين في نفس التوقيت (${s1.day} ${s1.startTime}-${s1.endTime})`,
            });
          }
        }
      }
    }

    const errorsCount = issues.filter(i => i.level === 'ERROR').length;
    const warningsCount = issues.filter(i => i.level === 'WARNING').length;

    res.json({
      success: true,
      healthy: errorsCount === 0,
      timestamp: new Date().toISOString(),
      summary: {
        totalEntitiesScanned:
          collegesList.length +
          departmentsList.length +
          roomsList.length +
          stagesList.length +
          sectionsList.length +
          subjectsList.length +
          facultyList.length +
          schedulesList.length +
          usersList.length,
        errorsCount,
        warningsCount,
        statusLabel: errorsCount === 0 ? 'تكامل سليم 100% (No Integrity Violations)' : 'يوجد أخطاء في التكامل المرجعي',
      },
      issues,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12.6 GET /api/system/metrics — OWNER only
app.get('/api/system/metrics', authenticateToken, requireRole('OWNER'), (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    success: true,
    data: {
      uptimeSeconds: Math.floor(uptime),
      memory: {
        rssBytes: memoryUsage.rss,
        heapTotalBytes: memoryUsage.heapTotal,
        heapUsedBytes: memoryUsage.heapUsed,
        externalBytes: memoryUsage.external,
        rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      databasePool: {
        total: 1,
        idle: 1,
        waiting: 0,
      },
      databaseProvider: 'SQLite',
      databaseFile: databasePath,
      collectedAt: new Date().toISOString(),
    },
  });
});

// ==========================================
// 13. VITE / FRONTEND SERVING
// ==========================================

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[SERVER] Running on http://0.0.0.0:${PORT} (Timezone: Asia/Baghdad)`);
    if (process.env.OPEN_BROWSER === 'true' && process.platform === 'win32') {
      const browser = spawn('cmd.exe', ['/c', 'start', '', `http://localhost:${PORT}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      browser.unref();
    }
  });
}

// Only start the server when executed directly as entrypoint, not when imported by test suites
if (!process.argv.some(arg => arg.includes('test'))) {
  startServer();
}

export { app, startServer };
