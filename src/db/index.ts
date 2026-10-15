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

    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      department_id TEXT,
      room_id TEXT,
      building_id TEXT,
      code TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'OPERATIONAL',
      serial_number TEXT,
      specifications TEXT,
      purchase_date TEXT,
      photo_path TEXT,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id TEXT PRIMARY KEY,
      ticket_number TEXT UNIQUE NOT NULL,
      equipment_id TEXT,
      college_id TEXT NOT NULL,
      department_id TEXT,
      room_id TEXT,
      building_id TEXT,
      reported_by_user_id TEXT NOT NULL,
      reported_by_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'MEDIUM',
      impact_on_lectures TEXT DEFAULT 'NONE',
      status TEXT DEFAULT 'NEW',
      assigned_team TEXT,
      action_taken TEXT,
      resolution_notes TEXT,
      resolution_date TEXT,
      photo_url TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS change_requests (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      faculty_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      change_type TEXT NOT NULL,
      reason_type TEXT,
      reason TEXT NOT NULL,
      proposed_date TEXT,
      proposed_day TEXT,
      proposed_start_time TEXT,
      proposed_end_time TEXT,
      proposed_room_id TEXT,
      status TEXT DEFAULT 'pending',
      requested_by_user_id TEXT NOT NULL,
      requested_by_name TEXT NOT NULL,
      reviewed_by_user_id TEXT,
      reviewed_by_name TEXT,
      reviewed_at TEXT,
      review_notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT,
      browser TEXT,
      os TEXT,
      ip_address TEXT,
      status TEXT DEFAULT 'APPROVED',
      is_trusted INTEGER DEFAULT 1,
      last_used_at TEXT,
      approved_by TEXT,
      approved_at TEXT,
      revoked_by TEXT,
      revoked_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS registration_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      employee_id TEXT,
      phone TEXT,
      college_id TEXT,
      department_id TEXT,
      requested_role TEXT DEFAULT 'FACULTY',
      assigned_role TEXT,
      is_email_verified INTEGER DEFAULT 0,
      email_verified_at TEXT,
      status TEXT DEFAULT 'PENDING_VERIFICATION',
      approval_notes TEXT,
      reviewed_by_user_id TEXT,
      reviewed_by_name TEXT,
      reviewed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      request_id TEXT,
      code TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      is_used INTEGER DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS academic_calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      academic_year TEXT,
      semester TEXT,
      college_id TEXT,
      created_by_user_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dean_updates (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 1,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      granted INTEGER DEFAULT 1,
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
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 'active', 0, ?, ?, ?)
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

  // Seed default roles if empty
  const rolesCount = (sqlite.prepare('SELECT COUNT(*) as count FROM roles').get() as any)?.count || 0;
  if (rolesCount === 0) {
    const rolesList = [
      { id: 'role-owner', name: 'OWNER', nameAr: 'مالك النظام ومسؤول الجامعة', desc: 'صلاحيات كاملة وغير مقيدة على مستوى الجامعة' },
      { id: 'role-dean', name: 'COLLEGE_DEAN', nameAr: 'عميد الكلية', desc: 'إشراف واطلاع ومتابعة على مستوى الكلية' },
      { id: 'role-col-mon', name: 'COLLEGE_MONITOR', nameAr: 'مسؤول متابعة الكلية', desc: 'متابعة الجداول والحضور وطلبات التأجيل في الكلية' },
      { id: 'role-dept-mon', name: 'DEPARTMENT_MONITOR', nameAr: 'مسؤول متابعة القسم', desc: 'متابعة وتوثيق الحضور بالنيابة وصيانة القسم' },
      { id: 'role-faculty', name: 'FACULTY', nameAr: 'عضو هيئة تدريسية', desc: 'توثيق المحاضرات والغيابات وتقديم طلبات التأجيل' },
    ];
    for (const r of rolesList) {
      sqlite.prepare('INSERT INTO roles (id, name, name_ar, description, is_system, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(r.id, r.name, r.nameAr, r.desc, now);
    }

    const permsList = [
      { id: 'perm-att-rec', code: 'ATTENDANCE_RECORD', nameAr: 'توثيق الحضور وإثبات المحاضرة', cat: 'الحضور' },
      { id: 'perm-att-proxy', code: 'ATTENDANCE_PROXY', nameAr: 'تسجيل الحضور بالنيابة مع الضوابط', cat: 'الحضور' },
      { id: 'perm-att-view', code: 'ATTENDANCE_VIEW', nameAr: 'عرض سجلات وإحصائيات الحضور', cat: 'الحضور' },
      { id: 'perm-sched-manage', code: 'SCHEDULE_MANAGE', nameAr: 'إدارة وتعديل الجداول الأكاديمية', cat: 'الجداول' },
      { id: 'perm-cr-create', code: 'CHANGE_REQUEST_CREATE', nameAr: 'تقديم طلبات تأجيل وتغيير المواعيد', cat: 'الطلبات' },
      { id: 'perm-cr-review', code: 'CHANGE_REQUEST_REVIEW', nameAr: 'الموافقة أو الرفض على طلبات التأجيل', cat: 'الطلبات' },
      { id: 'perm-equip-view', code: 'EQUIPMENT_VIEW', nameAr: 'الاطلاع على سجل المعدات والأجهزة', cat: 'المعدات والصيانة' },
      { id: 'perm-equip-manage', code: 'EQUIPMENT_MANAGE', nameAr: 'إضافة وتعديل بيانات الأجهزة والمختبرات', cat: 'المعدات والصيانة' },
      { id: 'perm-maint-rep', code: 'MAINTENANCE_REPORT', nameAr: 'تسجيل بلاغات الأعطال والصيانة', cat: 'المعدات والصيانة' },
      { id: 'perm-maint-manage', code: 'MAINTENANCE_MANAGE', nameAr: 'إدارة دورة الصيانة وإغلاق البلاغات', cat: 'المعدات والصيانة' },
      { id: 'perm-rep-view', code: 'REPORTS_VIEW', nameAr: 'عرض التقارير والموقف اليومي', cat: 'التقارير' },
      { id: 'perm-users-manage', code: 'USERS_MANAGE', nameAr: 'إدارة المستخدمين والحسابات', cat: 'المستخدمون' },
      { id: 'perm-sys-settings', code: 'SYSTEM_SETTINGS', nameAr: 'إدارة إعدادات النظام وسياسات الأمان', cat: 'النظام' },
    ];
    for (const p of permsList) {
      sqlite.prepare('INSERT INTO permissions (id, code, name_ar, category) VALUES (?, ?, ?, ?)').run(p.id, p.code, p.nameAr, p.cat);
    }
  }

  // Seed default equipment if empty
  const equipCount = (sqlite.prepare('SELECT COUNT(*) as count FROM equipment').get() as any)?.count || 0;
  if (equipCount === 0) {
    const colEng = 'col-eng-01';
    const depCse = 'dep-cse-01';
    const bld1 = 'bld-eng-01';
    const bld2 = 'bld-hall-01';
    const rm1 = 'rm-khawarizmi';
    const rm3 = 'rm-lab-net';

    sqlite.prepare(`
      INSERT INTO equipment (
        id, college_id, department_id, room_id, building_id, code, name_ar, name_en,
        type, status, serial_number, specifications, purchase_date, notes, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      'eq-proj-khawarizmi', colEng, depCse, rm1, bld1, 'EQ-PRJ-101', 'عارض بيانات ليزري 4K (Data Projector)', 'Epson 4K Laser Projector',
      'PROJECTOR', 'OPERATIONAL', 'SN-EP4K-88219', 'شدة إضاءة 5000 شمعة، مدخل HDMI وWireless Casting', '2024-01-15', 'مثبت في سقف قاعة الخوارزمي بحالة ممتازة', now, now
    );

    sqlite.prepare(`
      INSERT INTO equipment (
        id, college_id, department_id, room_id, building_id, code, name_ar, name_en,
        type, status, serial_number, specifications, purchase_date, notes, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      'eq-ac-khawarizmi', colEng, depCse, rm1, bld1, 'EQ-AC-102', 'مكيف عمودي سبليت 2 طن (Inverter AC)', 'TOSHIBA 2-Ton Inverter AC',
      'AIR_CONDITIONER', 'NEEDS_MAINTENANCE', 'SN-TOSH-99120', 'غاز R410A موفر للطاقة بتقنية Inverter', '2023-08-10', 'ضعف في التبريد بحاجة لفحص الفلاتر وشحن الغاز', now, now
    );

    sqlite.prepare(`
      INSERT INTO equipment (
        id, college_id, department_id, room_id, building_id, code, name_ar, name_en,
        type, status, serial_number, specifications, purchase_date, notes, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      'eq-switch-netlab', colEng, depCse, rm3, bld2, 'EQ-SW-201', 'موزع شبكات رئيسي 48 منفذ (Managed Gigabit Switch)', 'Cisco Catalyst 48-Port PoE',
      'NETWORK', 'OPERATIONAL', 'SN-CS48-11029', 'PoE+ مع دعم VLAN و Layer 3 Routing', '2024-02-01', 'موجود في كابينة الشبكات الخاصة بمختبر الشبكات', now, now
    );

    sqlite.prepare(`
      INSERT INTO equipment (
        id, college_id, department_id, room_id, building_id, code, name_ar, name_en,
        type, status, serial_number, specifications, purchase_date, notes, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      'eq-pc-netlab-01', colEng, depCse, rm3, bld2, 'EQ-PC-202', 'محطة عمل هندسية ومحاكاة شبكات (Workstation PC)', 'Dell Precision 3660 Core i7',
      'COMPUTER', 'OPERATIONAL', 'SN-DELL-55210', 'Core i7 13th Gen, 32GB RAM, RTX 3060, 1TB NVMe', '2024-03-10', 'جهاز رقم 1 في المختبر', now, now
    );

    // Sample maintenance ticket for the AC
    sqlite.prepare(`
      INSERT INTO maintenance_tickets (
        id, ticket_number, equipment_id, college_id, department_id, room_id, building_id,
        reported_by_user_id, reported_by_name, title, description, priority, impact_on_lectures,
        status, assigned_team, action_taken, resolution_notes, resolution_date, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      'ticket-001', 'TKT-2025-001', 'eq-ac-khawarizmi', colEng, depCse, rm1, bld1,
      'user-owner-default', 'د. زينب أحمد علي', 'ضعف كفاءة تبريد المكيف العمودي بقاعة الخوارزمي',
      'تراكم الأتربة على الفلاتر وضعف التبريد أثناء محاضرات الصباح في قاعة الخوارزمي مما يؤثر على تركيز الطلبة.',
      'HIGH', 'PARTIAL', 'IN_PROGRESS', 'شعبة الصيانة والخدمات العامة', 'تم فحص الوحدة الخارجية والفلاتر وجاري استبدال المكثف',
      null, null, now, now
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
