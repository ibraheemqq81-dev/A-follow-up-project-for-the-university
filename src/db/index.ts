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
      room_type TEXT,
      photo_path TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_current INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
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
      start_date TEXT,
      end_date TEXT,
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
      notes TEXT,
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
      attendance_status TEXT,
      snapshot_department_name TEXT,
      snapshot_faculty_name TEXT,
      snapshot_subject_name TEXT,
      snapshot_subject_code TEXT,
      snapshot_room_name TEXT,
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
      rows_processed INTEGER,
      rows_created INTEGER,
      rows_updated INTEGER,
      rows_failed INTEGER,
      success_rows INTEGER,
      error_rows INTEGER,
      error_summary TEXT,
      error_details TEXT,
      uploaded_by_user_id TEXT,
      completed_at TEXT,
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

  // Run column migrations for SQLite tables
  const columnMigrations: Array<{ table: string; column: string; type: string }> = [
    // colleges
    { table: 'colleges', column: 'dean_name', type: 'TEXT' },
    { table: 'colleges', column: 'monitor_name', type: 'TEXT' },
    { table: 'colleges', column: 'monitor_user_id', type: 'TEXT' },
    { table: 'colleges', column: 'phone', type: 'TEXT' },
    { table: 'colleges', column: 'email', type: 'TEXT' },
    { table: 'colleges', column: 'status', type: 'TEXT' },
    // departments
    { table: 'departments', column: 'head_name', type: 'TEXT' },
    { table: 'departments', column: 'monitor_name', type: 'TEXT' },
    { table: 'departments', column: 'monitor_user_id', type: 'TEXT' },
    { table: 'departments', column: 'phone', type: 'TEXT' },
    { table: 'departments', column: 'email', type: 'TEXT' },
    { table: 'departments', column: 'status', type: 'TEXT' },
    // buildings
    { table: 'buildings', column: 'floors_count', type: 'INTEGER' },
    { table: 'buildings', column: 'latitude', type: 'REAL' },
    { table: 'buildings', column: 'longitude', type: 'REAL' },
    { table: 'buildings', column: 'location_description', type: 'TEXT' },
    { table: 'buildings', column: 'status', type: 'TEXT' },
    // rooms
    { table: 'rooms', column: 'floor', type: 'INTEGER' },
    { table: 'rooms', column: 'location_description', type: 'TEXT' },
    { table: 'rooms', column: 'status', type: 'TEXT' },
    { table: 'rooms', column: 'room_type', type: 'TEXT' },
    // subjects & stages & sections
    { table: 'subjects', column: 'status', type: 'TEXT' },
    { table: 'stages', column: 'status', type: 'TEXT' },
    { table: 'sections', column: 'status', type: 'TEXT' },
    { table: 'faculties', column: 'status', type: 'TEXT' },
    { table: 'schedules', column: 'status', type: 'TEXT' },
    // academic years & semesters
    { table: 'academic_years', column: 'start_date', type: 'TEXT' },
    { table: 'academic_years', column: 'end_date', type: 'TEXT' },
    { table: 'semesters', column: 'start_date', type: 'TEXT' },
    { table: 'semesters', column: 'end_date', type: 'TEXT' },
    // lecture sessions
    { table: 'lecture_sessions', column: 'planned_room_id', type: 'TEXT' },
    { table: 'lecture_sessions', column: 'actual_room_id', type: 'TEXT' },
    { table: 'lecture_sessions', column: 'planned_faculty_id', type: 'TEXT' },
    { table: 'lecture_sessions', column: 'actual_faculty_id', type: 'TEXT' },
    { table: 'lecture_sessions', column: 'is_unrecorded_resolved', type: 'INTEGER DEFAULT 0' },
    { table: 'lecture_sessions', column: 'unrecorded_reason', type: 'TEXT' },
    { table: 'lecture_sessions', column: 'unrecorded_notes', type: 'TEXT' },
    { table: 'lecture_sessions', column: 'resolved_by_user_id', type: 'TEXT' },
    { table: 'lecture_sessions', column: 'notes', type: 'TEXT' },
    // attendance records
    { table: 'attendance_records', column: 'attendance_status', type: 'TEXT' },
    { table: 'attendance_records', column: 'recording_mode', type: 'TEXT' },
    { table: 'attendance_records', column: 'recorded_by_role', type: 'TEXT' },
    { table: 'attendance_records', column: 'on_behalf_reason', type: 'TEXT' },
    { table: 'attendance_records', column: 'on_behalf_other_note', type: 'TEXT' },
    { table: 'attendance_records', column: 'client_recorded_at', type: 'TEXT' },
    { table: 'attendance_records', column: 'server_synced_at', type: 'TEXT' },
    { table: 'attendance_records', column: 'sync_status', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_college_name', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_department_name', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_faculty_name', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_subject_name', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_subject_code', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_section_name', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_room_name', type: 'TEXT' },
    { table: 'attendance_records', column: 'snapshot_semester_name', type: 'TEXT' },
    { table: 'attendance_records', column: 'students_enrolled', type: 'INTEGER' },
    { table: 'attendance_records', column: 'students_present', type: 'INTEGER' },
    { table: 'attendance_records', column: 'evidence_photo_url', type: 'TEXT' },
    { table: 'attendance_records', column: 'recorded_by_user_id', type: 'TEXT' },
    { table: 'attendance_records', column: 'notes', type: 'TEXT' },
    // attendance section records
    { table: 'attendance_section_records', column: 'attendance_id', type: 'TEXT' },
    { table: 'attendance_section_records', column: 'schedule_id', type: 'TEXT' },
    { table: 'attendance_section_records', column: 'students_enrolled', type: 'INTEGER' },
    { table: 'attendance_section_records', column: 'students_present', type: 'INTEGER' },
    { table: 'attendance_section_records', column: 'attendance_percentage', type: 'TEXT' },
    { table: 'attendance_section_records', column: 'snapshot_section_name', type: 'TEXT' },
    { table: 'attendance_section_records', column: 'snapshot_department_name', type: 'TEXT' },
    { table: 'attendance_section_records', column: 'snapshot_stage_name', type: 'TEXT' },
    // attendance evidence
    { table: 'attendance_evidence', column: 'attendance_id', type: 'TEXT' },
    { table: 'attendance_evidence', column: 'schedule_id', type: 'TEXT' },
    { table: 'attendance_evidence', column: 'faculty_id', type: 'TEXT' },
    { table: 'attendance_evidence', column: 'photo_url', type: 'TEXT' },
    { table: 'attendance_evidence', column: 'recorded_by_user_id', type: 'TEXT' },
    // import jobs
    { table: 'import_jobs', column: 'uploaded_by_user_id', type: 'TEXT' },
    { table: 'import_jobs', column: 'rows_processed', type: 'INTEGER' },
    { table: 'import_jobs', column: 'rows_created', type: 'INTEGER' },
    { table: 'import_jobs', column: 'rows_updated', type: 'INTEGER' },
    { table: 'import_jobs', column: 'rows_failed', type: 'INTEGER' },
    { table: 'import_jobs', column: 'error_summary', type: 'TEXT' },
    { table: 'import_jobs', column: 'error_details', type: 'TEXT' },
    { table: 'import_jobs', column: 'completed_at', type: 'TEXT' },
  ];

  for (const mig of columnMigrations) {
    try {
      const cols = sqlite.prepare(`PRAGMA table_info(${mig.table})`).all() as any[];
      if (cols.length > 0 && !cols.some((c) => c.name === mig.column)) {
        sqlite.exec(`ALTER TABLE ${mig.table} ADD COLUMN ${mig.column} ${mig.type};`);
      }
    } catch {
      // ignore
    }
  }

  const now = new Date().toISOString();

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
    ).run('setting-academic', 'academicSettings', defaultSettings, 'إعدادات السنة والفصل الأكاديمي', now);
  }

  // Seed academic year and semester if none exist
  const ayCount = (sqlite.prepare('SELECT COUNT(*) as count FROM academic_years').get() as any)?.count || 0;
  if (ayCount === 0) {
    sqlite.prepare(
      'INSERT INTO academic_years (id, name, is_current, start_date, end_date, startDate, endDate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('ay-2025-2026', '2025-2026', 1, '2025-09-01', '2026-06-30', '2025-09-01', '2026-06-30', now, now);

    sqlite.prepare(
      'INSERT INTO semesters (id, academic_year_id, name_ar, name_en, semester_number, is_current, start_date, end_date, startDate, endDate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('sem-first-2025', 'ay-2025-2026', 'الفصل الأول', 'First Semester', 1, 1, '2025-09-01', '2026-01-31', '2025-09-01', '2026-01-31', now, now);
  }

  // Seed colleges and departments if none exist
  const collegesCount = (sqlite.prepare('SELECT COUNT(*) as count FROM colleges').get() as any)?.count || 0;
  if (collegesCount === 0) {
    const colEng = 'col-eng-01';
    const colPharm = 'col-pharm-01';
    const colNurs = 'col-nurs-01';
    const colLaw = 'col-law-01';

    sqlite.prepare('INSERT INTO colleges (id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(colEng, 'ENG', 'كلية الهندسة والتقنيات الهندسية', 'College of Engineering & Technology', now, now);
    sqlite.prepare('INSERT INTO colleges (id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(colPharm, 'PHARM', 'كلية الصيدلة', 'College of Pharmacy', now, now);
    sqlite.prepare('INSERT INTO colleges (id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(colNurs, 'NURS', 'كلية التمريض', 'College of Nursing', now, now);
    sqlite.prepare('INSERT INTO colleges (id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(colLaw, 'LAW', 'كلية القانون', 'College of Law', now, now);

    // Departments
    const depCse = 'dep-cse-01';
    const depBme = 'dep-bme-01';
    const depPharm = 'dep-pharm-01';
    const depNurs = 'dep-nurs-01';

    sqlite.prepare('INSERT INTO departments (id, college_id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
      .run(depCse, colEng, 'CSE', 'قسم هندسة تقنيات الحاسوب', 'Computer Techniques Engineering', now, now);
    sqlite.prepare('INSERT INTO departments (id, college_id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
      .run(depBme, colEng, 'BME', 'قسم هندسة تقنيات الأجهزة الطبية', 'Medical Instrumentation Engineering', now, now);
    sqlite.prepare('INSERT INTO departments (id, college_id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
      .run(depPharm, colPharm, 'CPHARM', 'قسم الصيدلة السريرية', 'Clinical Pharmacy', now, now);
    sqlite.prepare('INSERT INTO departments (id, college_id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
      .run(depNurs, colNurs, 'NSC', 'قسم العلوم التمريضية', 'Nursing Sciences', now, now);

    // Buildings & Rooms
    const bld1 = 'bld-eng-01';
    const bld2 = 'bld-hall-01';
    sqlite.prepare('INSERT INTO buildings (id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(bld1, 'BLD-A', 'مبنى كلية الهندسة المركزي', 'Engineering Central Building', now, now);
    sqlite.prepare('INSERT INTO buildings (id, code, name_ar, name_en, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(bld2, 'BLD-B', 'مجمع القاعات والمختبرات المركزية', 'Central Halls & Laboratories', now, now);

    const rm1 = 'rm-khawarizmi';
    const rm2 = 'rm-kindi';
    const rm3 = 'rm-lab-net';
    sqlite.prepare('INSERT INTO rooms (id, building_id, college_id, department_id, code, name_ar, name_en, capacity, type, room_type, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(rm1, bld1, colEng, depCse, 'HALL-101', 'قاعة الخوارزمي', 'Al-Khawarizmi Hall', 90, 'HALL', 'HALL', now, now);
    sqlite.prepare('INSERT INTO rooms (id, building_id, college_id, department_id, code, name_ar, name_en, capacity, type, room_type, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(rm2, bld1, colEng, depCse, 'HALL-102', 'قاعة الكندي', 'Al-Kindi Hall', 75, 'HALL', 'HALL', now, now);
    sqlite.prepare('INSERT INTO rooms (id, building_id, college_id, department_id, code, name_ar, name_en, capacity, type, room_type, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(rm3, bld2, colEng, depCse, 'LAB-201', 'مختبر الشبكات والمعالجات الرقمية', 'Digital & Network Lab', 40, 'LAB', 'LAB', now, now);

    // Stages
    const stg3 = 'stg-cse-3';
    const stg4 = 'stg-cse-4';
    sqlite.prepare('INSERT INTO stages (id, department_id, name_ar, name_en, year_number, status, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(stg3, depCse, 'المرحلة الثالثة', 'Third Year', 3, 'ACTIVE', now, now);
    sqlite.prepare('INSERT INTO stages (id, department_id, name_ar, name_en, year_number, status, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(stg4, depCse, 'المرحلة الرابعة', 'Fourth Year', 4, 'ACTIVE', now, now);

    // Sections
    const secA = 'sec-cse-3a';
    const secB = 'sec-cse-3b';
    sqlite.prepare('INSERT INTO sections (id, department_id, stage_id, name, student_count, status, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(secA, depCse, stg3, 'الشعبة (أ)', 45, 'ACTIVE', now, now);
    sqlite.prepare('INSERT INTO sections (id, department_id, stage_id, name, student_count, status, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(secB, depCse, stg3, 'الشعبة (ب)', 40, 'ACTIVE', now, now);

    // Subjects
    const subNet = 'sub-net-301';
    const subDs = 'sub-ds-302';
    const subSe = 'sub-se-303';
    sqlite.prepare('INSERT INTO subjects (id, department_id, stage_id, code, name_ar, name_en, type, theoretical_hours, practical_hours, credit_units, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(subNet, depCse, stg3, 'CSE301', 'شبكات الحاسوب والاتصالات', 'Computer Networks', 'THEORETICAL_PRACTICAL', 3, 2, 4, now, now);
    sqlite.prepare('INSERT INTO subjects (id, department_id, stage_id, code, name_ar, name_en, type, theoretical_hours, practical_hours, credit_units, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(subDs, depCse, stg3, 'CSE302', 'أنظمة التشغيل والمعالجة المتزامنة', 'Operating Systems', 'THEORETICAL', 3, 0, 3, now, now);
    sqlite.prepare('INSERT INTO subjects (id, department_id, stage_id, code, name_ar, name_en, type, theoretical_hours, practical_hours, credit_units, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(subSe, depCse, stg3, 'CSE303', 'هندسة البرمجيات وإدارة المشاريع', 'Software Engineering', 'THEORETICAL_PRACTICAL', 3, 2, 4, now, now);

    // Faculties
    const fac1 = 'fac-ibraheem';
    const fac2 = 'fac-zainab';
    const fac3 = 'fac-haider';
    sqlite.prepare('INSERT INTO faculties (id, college_id, department_id, employee_id, name_ar, name_en, academic_title, specialization, email, phone, status, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(fac1, colEng, depCse, 'UOMUS-101', 'أ.د. إبراهيم محمد حسن', 'Prof. Dr. Ibraheem M. Hassan', 'أستاذ', 'شبكات الحاسوب والذكاء الاصطناعي', 'faculty.ibraheem@uomus.edu.iq', '07801234567', 'ACTIVE', now, now);
    sqlite.prepare('INSERT INTO faculties (id, college_id, department_id, employee_id, name_ar, name_en, academic_title, specialization, email, phone, status, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(fac2, colEng, depCse, 'UOMUS-102', 'د. زينب أحمد علي', 'Dr. Zainab Ahmed Ali', 'أستاذ مساعد', 'هندسة البرمجيات وقواعد البيانات', 'faculty.zainab@uomus.edu.iq', '07802345678', 'ACTIVE', now, now);
    sqlite.prepare('INSERT INTO faculties (id, college_id, department_id, employee_id, name_ar, name_en, academic_title, specialization, email, phone, status, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(fac3, colEng, depCse, 'UOMUS-103', 'م.د. حيدر جاسم كاظم', 'Dr. Haider Jasim Kadhim', 'مدرس', 'أنظمة التشغيل والمعالجات', 'faculty.haider@uomus.edu.iq', '07803456789', 'ACTIVE', now, now);

    // Schedules
    const sch1 = 'sch-sun-01';
    const sch2 = 'sch-mon-02';
    const sch3 = 'sch-tue-03';
    sqlite.prepare(`
      INSERT INTO schedules (
        id, college_id, department_id, stage_id, subject_id, faculty_id, section_id, room_id,
        day, start_time, end_time, lecture_type, academic_year, semester, status, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(sch1, colEng, depCse, stg3, subNet, fac1, secA, rm1, 'Sunday', '08:30', '10:30', 'THEORETICAL', '2025-2026', 'FIRST', 'ACTIVE', now, now);

    sqlite.prepare(`
      INSERT INTO schedules (
        id, college_id, department_id, stage_id, subject_id, faculty_id, section_id, room_id,
        day, start_time, end_time, lecture_type, academic_year, semester, status, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(sch2, colEng, depCse, stg3, subDs, fac3, secA, rm2, 'Monday', '10:30', '12:30', 'THEORETICAL', '2025-2026', 'FIRST', 'ACTIVE', now, now);

    sqlite.prepare(`
      INSERT INTO schedules (
        id, college_id, department_id, stage_id, subject_id, faculty_id, section_id, room_id,
        day, start_time, end_time, lecture_type, academic_year, semester, status, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(sch3, colEng, depCse, stg3, subSe, fac2, secB, rm3, 'Tuesday', '12:30', '14:30', 'PRACTICAL', '2025-2026', 'FIRST', 'ACTIVE', now, now);

    // Attendance sample for sch1
    const todayStr = new Date().toISOString().split('T')[0];
    sqlite.prepare(`
      INSERT INTO attendance_records (
        id, faculty_id, schedule_id, subject_id, section_id, stage_id, room_id,
        lecture_date, scheduled_start, scheduled_end, status, attendance_status,
        snapshot_department_name, snapshot_faculty_name, snapshot_subject_name, snapshot_subject_code, snapshot_room_name,
        present_count, total_count, absence_percentage, topics_covered, verification_method, recorded_at, academic_year, semester, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'att-rec-01', fac1, sch1, subNet, secA, stg3, rm1,
      todayStr, '08:30', '10:30', 'PRESENT', 'PRESENT',
      'قسم هندسة تقنيات الحاسوب', 'أ.د. إبراهيم محمد حسن', 'شبكات الحاسوب والاتصالات', 'CSE301', 'قاعة الخوارزمي',
      42, 45, '6.6%', 'مقدمة في بروتوكول TCP/IP والتوجيه الشبكي', 'MANUAL_VERIFIED', now, '2025-2026', 'FIRST', now, now
    );
  }

  // Ensure a single OWNER account exists (for first-run setup only)
  const ownerEmail = process.env.UOMUS_OWNER_EMAIL || 'admin@uomus.edu.iq';
  const ownerPassword = process.env.UOMUS_OWNER_PASSWORD || 'Admin@12345678';
  const ownerExists = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(ownerEmail);
  if (!ownerExists) {
    const ownerHash = bcrypt.hashSync(ownerPassword, 10);
    sqlite.prepare(`
      INSERT INTO users (
        id, uid, name, email, role, role_title_ar,
        assigned_college_id, assigned_department_id, assigned_faculty_id,
        must_change_password, status, token_version, password_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 1, 'active', 0, ?, ?, ?)
    `).run(
      'user-owner-default',
      'uid-owner-default',
      'مدير النظام (الجامعة)',
      ownerEmail,
      'OWNER',
      'مالك النظام ومسؤول الجامعة (OWNER)',
      ownerHash,
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
