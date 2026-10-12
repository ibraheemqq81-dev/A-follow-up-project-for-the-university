import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'node:fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const databasePath = process.env.UOMUS_DB_PATH
  ? path.resolve(process.env.UOMUS_DB_PATH)
  : path.resolve(__dirname, '../../data/app.db');

const dbDir = path.dirname(databasePath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

export const sqlite = new DatabaseSync(databasePath);

// Enable WAL mode and Foreign Keys
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

// Create tables if they do not exist
function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      uid TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      employee_id TEXT,
      role TEXT NOT NULL,
      role_title_ar TEXT,
      assigned_college_id TEXT,
      assigned_department_id TEXT,
      assigned_faculty_id TEXT,
      avatar TEXT,
      must_change_password INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      token_version INTEGER DEFAULT 0,
      password_hash TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS colleges (
      id TEXT PRIMARY KEY,
      code TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      logo_path TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      code TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      logo_path TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      code TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      photo_path TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      building_id TEXT,
      college_id TEXT,
      department_id TEXT,
      code TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      capacity INTEGER,
      type TEXT,
      photo_path TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_current INTEGER DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      academic_year_id TEXT,
      name_ar TEXT,
      name_en TEXT,
      semester_number INTEGER,
      is_current INTEGER DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stages (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      year_number INTEGER,
      status TEXT DEFAULT 'ACTIVE',
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      name TEXT NOT NULL,
      student_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      stage_id TEXT,
      code TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      type TEXT,
      theoretical_hours INTEGER DEFAULT 0,
      practical_hours INTEGER DEFAULT 0,
      credit_units INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS faculties (
      id TEXT PRIMARY KEY,
      college_id TEXT,
      department_id TEXT,
      employee_id TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      academic_title TEXT,
      specialization TEXT,
      email TEXT,
      phone TEXT,
      photo_path TEXT,
      status TEXT DEFAULT 'ACTIVE',
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      college_id TEXT,
      department_id TEXT,
      stage_id TEXT,
      subject_id TEXT,
      faculty_id TEXT,
      section_id TEXT,
      room_id TEXT,
      day TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      lecture_type TEXT,
      academic_year TEXT,
      semester TEXT,
      status TEXT DEFAULT 'ACTIVE',
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS schedule_sections (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lecture_sessions (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT,
      check_in_time TEXT,
      check_out_time TEXT,
      is_unrecorded_resolved INTEGER DEFAULT 0,
      unrecorded_reason TEXT,
      unrecorded_notes TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      schedule_id TEXT NOT NULL,
      subject_id TEXT,
      section_id TEXT,
      stage_id TEXT,
      room_id TEXT,
      lecture_date TEXT NOT NULL,
      scheduled_start TEXT,
      scheduled_end TEXT,
      status TEXT,
      present_count INTEGER,
      total_count INTEGER,
      absence_percentage TEXT,
      topics_covered TEXT,
      verification_method TEXT,
      photo_evidence TEXT,
      recorded_at TEXT,
      academic_year TEXT,
      semester TEXT,
      proxy_recorded INTEGER DEFAULT 0,
      proxy_reason TEXT,
      recorded_by TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_section_records (
      id TEXT PRIMARY KEY,
      attendance_record_id TEXT,
      section_id TEXT,
      section_name TEXT,
      stage_name TEXT,
      department_name TEXT,
      student_count INTEGER,
      present_count INTEGER,
      lecture_date TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_evidence (
      id TEXT PRIMARY KEY,
      attendance_record_id TEXT,
      lecture_date TEXT,
      photo_path TEXT,
      hash TEXT,
      caption TEXT,
      recorded_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workload_policies (
      id TEXT PRIMARY KEY,
      academic_title TEXT,
      required_hours INTEGER,
      max_hours INTEGER,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS academic_exceptions (
      id TEXT PRIMARY KEY,
      faculty_id TEXT,
      reason TEXT,
      type TEXT,
      start_date TEXT,
      end_date TEXT,
      approved_by TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS substitutions (
      id TEXT PRIMARY KEY,
      schedule_id TEXT,
      original_faculty_id TEXT,
      substitute_faculty_id TEXT,
      date TEXT,
      reason TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS co_teaching (
      id TEXT PRIMARY KEY,
      schedule_id TEXT,
      primary_faculty_id TEXT,
      assistant_faculty_id TEXT,
      role TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      message TEXT,
      type TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      reason TEXT,
      details TEXT,
      new_value TEXT,
      previous_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      file_name TEXT,
      import_type TEXT,
      status TEXT,
      total_rows INTEGER,
      processed_rows INTEGER,
      success_rows INTEGER,
      error_rows INTEGER,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS import_errors (
      id TEXT PRIMARY KEY,
      import_job_id TEXT,
      row_number INTEGER,
      field TEXT,
      message TEXT,
      raw_value TEXT,
      created_at TEXT
    );
  `);

  // Seed default academic settings if not set
  const settingCheck = sqlite.prepare("SELECT id FROM system_settings WHERE key = 'academicSettings'").get();
  if (!settingCheck) {
    const defaultSettings = JSON.stringify({
      academicStructure: {
        currentAcademicYear: '2025-2026',
        currentSemester: 'FIRST',
      },
      university: {
        nameAr: 'جامعة المستقبل',
        nameEn: 'Al-Mustaqbal University',
      },
    });
    sqlite.prepare(
      'INSERT INTO system_settings (id, key, value, description, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run('setting-academic', 'academicSettings', defaultSettings, 'إعدادات السنة والفصل الأكاديمي', new Date().toISOString());
  }

  // Seed default OWNER user if none exists
  const usersCount = (sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
  if (usersCount === 0) {
    const hash = bcrypt.hashSync('Admin@12345678', 10);
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO users (
        id, uid, name, email, role, role_title_ar,
        must_change_password, status, token_version, password_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'user-owner-default',
      'uid-owner-default',
      'مدير النظام (الجامعة)',
      'admin@uomus.edu.iq',
      'OWNER',
      'مالك النظام ومسؤول الجامعة (OWNER)',
      0,
      'active',
      0,
      hash,
      now,
      now
    );
  }
}

initDatabase();

export const db = drizzle(async (sqlQuery, params, method) => {
  const stmt = sqlite.prepare(sqlQuery);
  const normalizedParams = params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
  if (method === 'all' || method === 'values') {
    const rows = stmt.all(...normalizedParams);
    return { rows: rows.map((r: any) => Object.values(r)) };
  } else if (method === 'get') {
    const row = stmt.get(...normalizedParams);
    return { rows: row ? Object.values(row) : [] };
  } else {
    stmt.run(...normalizedParams);
    return { rows: [] };
  }
});
