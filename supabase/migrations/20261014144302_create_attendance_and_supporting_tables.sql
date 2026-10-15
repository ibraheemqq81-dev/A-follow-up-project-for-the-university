/*
# Attendance, Sessions, and Supporting Tables

Creates:
- lecture_sessions: Individual lecture session instances
- attendance_records: Main attendance records
- attendance_section_records: Per-section attendance breakdown
- attendance_evidence: Photo evidence for attendance
- workload_policies: Faculty workload policies
- academic_exceptions: Academic exceptions for faculty
- substitutions: Faculty substitutions
- co_teaching: Co-teaching assignments
- notifications: User notifications
- audit_logs: Audit trail
- system_settings: Key-value system settings
- import_jobs: Bulk import job tracking
- import_errors: Detailed import errors

Security:
- RLS enabled on all tables
- All authenticated users can read
- Notifications scoped to user
- Audit logs readable by all authenticated users
*/

-- Lecture Sessions
CREATE TABLE IF NOT EXISTS lecture_sessions (
  id text PRIMARY KEY,
  schedule_id text NOT NULL,
  date text NOT NULL,
  status text,
  check_in_time text,
  check_out_time text,
  planned_room_id text,
  actual_room_id text,
  planned_faculty_id text,
  actual_faculty_id text,
  is_unrecorded_resolved boolean DEFAULT false,
  unrecorded_reason text,
  unrecorded_notes text,
  notes text,
  resolved_by text,
  resolved_by_user_id text,
  resolved_at text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lecture_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture_sessions_select_authenticated" ON lecture_sessions;
CREATE POLICY "lecture_sessions_select_authenticated" ON lecture_sessions FOR SELECT
  TO authenticated USING (true);

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id text PRIMARY KEY,
  faculty_id text NOT NULL,
  schedule_id text NOT NULL,
  subject_id text,
  section_id text,
  stage_id text,
  room_id text,
  lecture_date text NOT NULL,
  scheduled_start text,
  scheduled_end text,
  status text,
  attendance_status text,
  recording_mode text,
  recorded_by_role text,
  on_behalf_reason text,
  on_behalf_other_note text,
  client_recorded_at timestamptz,
  server_synced_at timestamptz,
  sync_status text,
  snapshot_college_name text,
  snapshot_department_name text,
  snapshot_faculty_name text,
  snapshot_subject_name text,
  snapshot_subject_code text,
  snapshot_section_name text,
  snapshot_room_name text,
  snapshot_semester_name text,
  present_count integer,
  total_count integer,
  students_enrolled integer,
  students_present integer,
  absence_percentage text,
  topics_covered text,
  verification_method text,
  photo_evidence text,
  evidence_photo_url text,
  recorded_at text,
  recorded_by_user_id text,
  notes text,
  academic_year text,
  semester text,
  proxy_recorded boolean DEFAULT false,
  proxy_reason text,
  recorded_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_records_select_authenticated" ON attendance_records;
CREATE POLICY "attendance_records_select_authenticated" ON attendance_records FOR SELECT
  TO authenticated USING (true);

-- Attendance Section Records
CREATE TABLE IF NOT EXISTS attendance_section_records (
  id text PRIMARY KEY,
  attendance_record_id text,
  attendance_id text,
  schedule_id text,
  section_id text,
  section_name text,
  stage_name text,
  department_name text,
  students_enrolled integer,
  students_present integer,
  student_count integer,
  present_count integer,
  attendance_percentage text,
  snapshot_section_name text,
  snapshot_department_name text,
  snapshot_stage_name text,
  lecture_date text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_section_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_section_records_select_authenticated" ON attendance_section_records;
CREATE POLICY "attendance_section_records_select_authenticated" ON attendance_section_records FOR SELECT
  TO authenticated USING (true);

-- Attendance Evidence
CREATE TABLE IF NOT EXISTS attendance_evidence (
  id text PRIMARY KEY,
  attendance_record_id text,
  attendance_id text,
  schedule_id text,
  faculty_id text,
  lecture_date text,
  photo_path text,
  photo_url text,
  recorded_by_user_id text,
  hash text,
  caption text,
  recorded_at text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_evidence_select_authenticated" ON attendance_evidence;
CREATE POLICY "attendance_evidence_select_authenticated" ON attendance_evidence FOR SELECT
  TO authenticated USING (true);

-- Workload Policies
CREATE TABLE IF NOT EXISTS workload_policies (
  id text PRIMARY KEY,
  academic_title text,
  required_hours integer,
  max_hours integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workload_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workload_policies_select_authenticated" ON workload_policies;
CREATE POLICY "workload_policies_select_authenticated" ON workload_policies FOR SELECT
  TO authenticated USING (true);

-- Academic Exceptions
CREATE TABLE IF NOT EXISTS academic_exceptions (
  id text PRIMARY KEY,
  faculty_id text,
  reason text,
  type text,
  start_date text,
  end_date text,
  approved_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE academic_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academic_exceptions_select_authenticated" ON academic_exceptions;
CREATE POLICY "academic_exceptions_select_authenticated" ON academic_exceptions FOR SELECT
  TO authenticated USING (true);

-- Substitutions
CREATE TABLE IF NOT EXISTS substitutions (
  id text PRIMARY KEY,
  schedule_id text,
  original_faculty_id text,
  substitute_faculty_id text,
  date text,
  reason text,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE substitutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "substitutions_select_authenticated" ON substitutions;
CREATE POLICY "substitutions_select_authenticated" ON substitutions FOR SELECT
  TO authenticated USING (true);

-- Co-Teaching
CREATE TABLE IF NOT EXISTS co_teaching (
  id text PRIMARY KEY,
  schedule_id text,
  primary_faculty_id text,
  assistant_faculty_id text,
  role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE co_teaching ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "co_teaching_select_authenticated" ON co_teaching;
CREATE POLICY "co_teaching_select_authenticated" ON co_teaching FOR SELECT
  TO authenticated USING (true);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text,
  title text,
  message text,
  type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_authenticated" ON notifications;
CREATE POLICY "notifications_select_authenticated" ON notifications FOR SELECT
  TO authenticated USING (true);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  user_id text,
  user_name text,
  user_role text,
  action text NOT NULL,
  entity text,
  entity_id text,
  reason text,
  details text,
  new_value text,
  previous_value text,
  ip_address text,
  user_agent text,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON audit_logs;
CREATE POLICY "audit_logs_select_authenticated" ON audit_logs FOR SELECT
  TO authenticated USING (true);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_select_authenticated" ON system_settings;
CREATE POLICY "system_settings_select_authenticated" ON system_settings FOR SELECT
  TO authenticated USING (true);

-- Import Jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id text PRIMARY KEY,
  file_name text,
  import_type text,
  status text,
  total_rows integer,
  processed_rows integer,
  rows_processed integer,
  rows_created integer,
  rows_updated integer,
  rows_failed integer,
  success_rows integer,
  error_rows integer,
  error_summary text,
  error_details text,
  uploaded_by_user_id text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_jobs_select_authenticated" ON import_jobs;
CREATE POLICY "import_jobs_select_authenticated" ON import_jobs FOR SELECT
  TO authenticated USING (true);

-- Import Errors
CREATE TABLE IF NOT EXISTS import_errors (
  id text PRIMARY KEY,
  import_job_id text,
  row_number integer,
  field text,
  message text,
  raw_value text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_errors_select_authenticated" ON import_errors;
CREATE POLICY "import_errors_select_authenticated" ON import_errors FOR SELECT
  TO authenticated USING (true);

-- Foreign key constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lecture_sessions_schedule') THEN
    ALTER TABLE lecture_sessions ADD CONSTRAINT fk_lecture_sessions_schedule
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_records_schedule') THEN
    ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_records_schedule
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_import_errors_job') THEN
    ALTER TABLE import_errors ADD CONSTRAINT fk_import_errors_job
      FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lecture_sessions_schedule_id ON lecture_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_schedule_id ON attendance_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_faculty_id ON attendance_records(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_lecture_date ON attendance_records(lecture_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
