import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { db } from './src/db/index.ts';
import {
  users,
  colleges,
  departments,
  buildings,
  rooms,
  stages,
  sections,
  subjects,
  faculties,
  schedules,
  auditLogs,
} from './src/db/schema.ts';
import { eq, and, inArray } from 'drizzle-orm';
import { registerDepartmentPackageRoutes } from './departmentPackage.routes.ts';
import {
  authenticateToken,
  requireRole,
  applyScope,
  JWT_SECRET,
} from './server.ts';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

registerDepartmentPackageRoutes(app, {
  authenticateToken,
  requireRole: requireRole as any,
  applyScope,
  generateId,
  getCurrentTerm: async () => ({ academicYear: '2026-2027', semester: 'FIRST' }),
});

let server: http.Server;
let baseUrl = '';

function makeToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const ownerToken = makeToken({
  id: 'user-owner',
  email: 'owner@uomus.edu.iq',
  name: 'أحمد علي السعدي',
  role: 'OWNER',
  tokenVersion: 0,
});

const deptMonitorToken = makeToken({
  id: 'user-dept-cpe-monitor',
  email: 'cpe.monitor@uomus.edu.iq',
  name: 'م. سارة قاسم',
  role: 'DEPARTMENT_MONITOR',
  assignedCollegeId: 'col-eng',
  assignedDepartmentId: 'dept-cpe',
  tokenVersion: 0,
});

const facultyToken = makeToken({
  id: 'user-fac-1',
  email: 'faculty@uomus.edu.iq',
  name: 'د. علي حسين',
  role: 'FACULTY',
  assignedCollegeId: 'col-eng',
  assignedDepartmentId: 'dept-cpe',
  tokenVersion: 0,
});

async function apiRequest(
  method: string,
  urlPath: string,
  token?: string,
  body?: any
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: res.status, body: json };
}

describe('Department Package Import Suite (15 Test Cases)', () => {
  let sampleFixture: any;

  before(async () => {
    // Read sample_sheets.json
    const fixturePath = path.join(process.cwd(), 'fixtures', 'sample_sheets.json');
    sampleFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    // Start HTTP server and wait for listening
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Seed baseline entities in test database
    await db.delete(schedules).where(eq(schedules.departmentId, 'dept-cpe'));
    await db.delete(subjects).where(eq(subjects.departmentId, 'dept-cpe'));
    await db.delete(sections).where(eq(sections.departmentId, 'dept-cpe'));
    await db.delete(faculties).where(eq(faculties.departmentId, 'dept-cpe'));

    await db.delete(schedules).where(eq(schedules.departmentId, 'dept-civil'));
    await db.delete(subjects).where(eq(subjects.departmentId, 'dept-civil'));
    await db.delete(sections).where(eq(sections.departmentId, 'dept-civil'));
    await db.delete(faculties).where(eq(faculties.departmentId, 'dept-civil'));

    await db.delete(faculties).where(inArray(faculties.email, [
      'haider.abbas@uomus.edu.iq',
      'zainab.mehdi@uomus.edu.iq',
      'mustafa.hameed@uomus.edu.iq',
      'khaled.civil@uomus.edu.iq',
    ]));

    await db.insert(colleges).values({
      id: 'col-eng',
      code: 'ENG',
      nameAr: 'كلية الهندسة',
      nameEn: 'Engineering College',
      deanName: 'أ.د. عميد الهندسة',
      monitorName: 'مسؤول الهندسة',
      phone: '+964780000000',
      email: 'eng@uomus.edu.iq',
    } as any).onConflictDoNothing();

    await db.insert(departments).values({
      id: 'dept-cpe',
      collegeId: 'col-eng',
      code: 'CPE',
      nameAr: 'قسم هندسة تقنيات الحاسوب',
      nameEn: 'Computer Engineering Department',
      headName: 'د. رئيس القسم',
      monitorName: 'مسؤول المتابعة',
      phone: '+964780000001',
      email: 'cpe@uomus.edu.iq',
    } as any).onConflictDoNothing();

    // Test identities must exist in the isolated database; authentication must not be bypassed.
    await db.insert(users).values({
      id: 'user-owner',
      uid: 'uid-owner-package-test',
      email: 'owner@uomus.edu.iq',
      name: 'أحمد علي السعدي',
      role: 'OWNER',
      roleTitleAr: 'مالك النظام',
      tokenVersion: 0,
      mustChangePassword: false,
      passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      status: 'active',
    } as any).onConflictDoUpdate({
      target: users.id,
      set: { tokenVersion: 0, mustChangePassword: false, status: 'active', role: 'OWNER' },
    });
    await db.insert(users).values({
      id: 'user-dept-cpe-monitor',
      uid: 'uid-dept-cpe-monitor-package',
      email: 'cpe.monitor@uomus.edu.iq',
      name: 'م. سارة قاسم',
      role: 'DEPARTMENT_MONITOR',
      roleTitleAr: 'مسؤول متابعة القسم',
      assignedCollegeId: 'col-eng',
      assignedDepartmentId: 'dept-cpe',
      tokenVersion: 0,
      mustChangePassword: false,
      passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      status: 'active',
    } as any).onConflictDoUpdate({ target: users.id, set: { assignedCollegeId: 'col-eng', assignedDepartmentId: 'dept-cpe', role: 'DEPARTMENT_MONITOR', status: 'active', tokenVersion: 0, mustChangePassword: false, passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' } });

    await db.insert(users).values({
      id: 'user-fac-1',
      uid: 'uid-fac-1-package',
      email: 'faculty@uomus.edu.iq',
      name: 'د. علي حسين',
      role: 'FACULTY',
      roleTitleAr: 'تدريسي',
      assignedCollegeId: 'col-eng',
      assignedDepartmentId: 'dept-cpe',
      tokenVersion: 0,
      mustChangePassword: false,
      passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      status: 'active',
    } as any).onConflictDoUpdate({ target: users.id, set: { role: 'FACULTY', assignedCollegeId: 'col-eng', assignedDepartmentId: 'dept-cpe', status: 'active', tokenVersion: 0, mustChangePassword: false, passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' } });

    await db.insert(departments).values({
      id: 'dept-civil',
      collegeId: 'col-eng',
      code: 'CIVIL',
      nameAr: 'قسم الهندسة المدنية',
      nameEn: 'Civil Engineering Department',
      headName: 'د. رئيس المدني',
      monitorName: 'مسؤول المدني',
      phone: '+964780000002',
      email: 'civil@uomus.edu.iq',
    } as any).onConflictDoNothing();

    await db.insert(stages).values({
      id: 'stage-cpe-1',
      departmentId: 'dept-cpe',
      nameAr: 'المرحلة الأولى',
      nameEn: 'Stage 1',
      yearNumber: 1,
    } as any).onConflictDoNothing();

    await db.insert(stages).values({
      id: 'stage-civil-1',
      departmentId: 'dept-civil',
      nameAr: 'المرحلة الأولى - مدني',
      nameEn: 'Civil Stage 1',
      yearNumber: 1,
    } as any).onConflictDoNothing();

    await db.insert(buildings).values({
      id: 'bld-eng-1',
      code: 'BLD-ENG-1',
      nameAr: 'بناية الهندسة الرئيسية',
      nameEn: 'Engineering Main Building',
      floorsCount: 4,
    } as any).onConflictDoNothing();

    await db.insert(rooms).values({
      id: 'room-hall101',
      buildingId: 'bld-eng-1',
      collegeId: 'col-eng',
      code: 'HALL-101',
      nameAr: 'قاعة 101 المركزية',
      roomType: 'classroom',
      capacity: 100,
    } as any).onConflictDoNothing();

    await db.insert(rooms).values({
      id: 'room-lab201',
      buildingId: 'bld-eng-1',
      collegeId: 'col-eng',
      code: 'LAB-201',
      nameAr: 'مختبر الشبكات 201',
      roomType: 'lab',
      capacity: 40,
    } as any).onConflictDoNothing();

    await db.insert(rooms).values({
      id: 'room-hall102',
      buildingId: 'bld-eng-1',
      collegeId: 'col-eng',
      code: 'HALL-102',
      nameAr: 'قاعة 102 الثانوية',
      roomType: 'classroom',
      capacity: 80,
    } as any).onConflictDoNothing();
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  it('1. Rejects request missing departmentId with HTTP 400 Bad Request', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      subjects: [],
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('2. Rejects request from unauthorized role FACULTY with HTTP 403 Forbidden', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', facultyToken, {
      departmentId: 'dept-cpe',
    });
    console.log(`Test 2 response: status=${res.status}, code=${res.body?.error?.code || 'none'}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it('3. Rejects DEPARTMENT_MONITOR importing for another department with HTTP 403', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', deptMonitorToken, {
      departmentId: 'dept-civil',
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it('4. Dry Run mode (dryRun: true) previews 6 lectures, 3 faculty, 2 sections, 3 subjects without DB writes', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: true,
      ...sampleFixture,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.dryRun, true);
    assert.equal(res.body.summary.subjectsCount, 3);
    assert.equal(res.body.summary.sectionsCount, 2);
    assert.equal(res.body.summary.facultyCount, 3);
    assert.equal(res.body.summary.schedulesCount, 6);
  });

  it('5. First actual import (dryRun: false) creates 6 lectures, 3 faculty, 2 sections, 3 subjects with status 201', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: false,
      ...sampleFixture,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.created.subjects, 3);
    assert.equal(res.body.created.sections, 2);
    assert.equal(res.body.created.faculty, 3);
    assert.equal(res.body.created.schedules, 6);
  });

  it('6. Second import with identical data creates 0 duplicate entities (idempotency)', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: false,
      ...sampleFixture,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.created.subjects, 0);
    assert.equal(res.body.created.sections, 0);
    assert.equal(res.body.created.faculty, 0);
  });

  it('7. Rejects non-existent departmentId with HTTP 404 Not Found', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      departmentId: 'dept-unknown-999',
      subjects: [],
    });
    assert.equal(res.status, 404);
  });

  it('8. Detects conflict when another department reserves same room at overlapping time', async () => {
    // Seed conflicting schedule for Civil Department in HALL-101 on Sunday 08:30-10:30
    await db.insert(subjects).values({
      id: 'subj-civil-1',
      departmentId: 'dept-civil',
      stageId: 'stage-civil-1',
      code: 'CIV101',
      nameAr: 'ميكانيك الهندسة المدنية',
      nameEn: 'Civil Mechanics',
    }).onConflictDoNothing();

    await db.insert(sections).values({
      id: 'sec-civil-1',
      stageId: 'stage-civil-1',
      departmentId: 'dept-civil',
      name: 'أ',
    }).onConflictDoNothing();

    await db.insert(faculties).values({
      id: 'fac-civil-1',
      employeeId: 'EMP-CIV-1',
      collegeId: 'col-eng',
      departmentId: 'dept-civil',
      nameAr: 'د. خالد المدني',
      nameEn: 'Dr. Khaled',
      academicTitle: 'أستاذ',
      specialization: 'مدني',
      email: 'khaled.civil@uomus.edu.iq',
      phone: '+9647809998877',
    }).onConflictDoNothing();

    await db.insert(schedules).values([{
      id: 'sch-conflict-civil-1',
      departmentId: 'dept-civil',
      stageId: 'stage-civil-1',
      sectionId: 'sec-civil-1',
      subjectId: 'subj-civil-1',
      facultyId: 'fac-civil-1',
      roomId: 'room-hall101', // Conflicting room HALL-101
      day: 'Sunday',
      startTime: '08:30',
      endTime: '10:30',
      lectureType: 'theoretical',
      academicYear: '2026-2027',
      semester: 'FIRST',
    }]).onConflictDoNothing();

    // Now dryRun import package for CPE department
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: true,
      ...sampleFixture,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.conflicts.length > 0);
    const roomConflict = res.body.conflicts.find((c: any) => c.type === 'ROOM_CONFLICT');
    assert.ok(roomConflict);
    assert.equal(roomConflict.conflictingDepartmentId, 'dept-civil');
    assert.equal(roomConflict.conflictingDepartmentName, 'قسم الهندسة المدنية');
  });

  it('9. Reject saving conflicts without confirmConflicts returning HTTP 409 Conflict', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: false,
      confirmConflicts: false,
      ...sampleFixture,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.ok(res.body.conflicts.length > 0);
  });

  it('10. Reject override with confirmConflicts: true but empty overrideReason returning HTTP 400 Bad Request', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: false,
      confirmConflicts: true,
      overrideReason: '',
      ...sampleFixture,
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('11. Successful conflict override with confirmConflicts: true and valid overrideReason returning status 201', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: false,
      confirmConflicts: true,
      overrideReason: 'موافقة رئيس القسم والعميد على الاستثناء بالقاعة المشتركة',
      ...sampleFixture,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
  });

  it('12. Audit log recorded for department package import', async () => {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entity, 'department_package'));
    assert.ok(logs.length > 0);
  });

  it('13. Accepts payload wrapped in packageData object', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: true,
      packageData: sampleFixture,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('14. Validates invalid time range startTime >= endTime with conflict notification', async () => {
    const invalidFixture = JSON.parse(JSON.stringify(sampleFixture));
    invalidFixture.schedules[0].startTime = '10:30';
    invalidFixture.schedules[0].endTime = '08:30'; // Invalid!

    const res = await apiRequest('POST', '/api/import/department-package', ownerToken, {
      dryRun: true,
      ...invalidFixture,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.conflicts.some((c: any) => c.message.includes('قبل وقت النهاية')));
  });

  it('15. Department Monitor successfully imports package for assigned department', async () => {
    const res = await apiRequest('POST', '/api/import/department-package', deptMonitorToken, {
      dryRun: true,
      ...sampleFixture,
    });
    console.log(`Test 15 response: status=${res.status}, code=${res.body?.error?.code || 'none'}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
