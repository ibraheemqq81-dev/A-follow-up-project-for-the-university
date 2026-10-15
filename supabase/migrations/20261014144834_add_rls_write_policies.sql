/*
# RLS Write Policies for All Tables

Adds INSERT, UPDATE, and DELETE policies for all application tables.
The app uses a custom auth system (bcrypt + JWT in the browser) rather than
Supabase Auth, so all policies are scoped to anon + authenticated roles.

This allows the frontend Supabase client (using the anon key) to perform
full CRUD operations on all tables after the user's JWT is verified
client-side.

1. Tables Updated
- users, colleges, departments, buildings, rooms
- academic_years, semesters, stages, sections, subjects
- faculties, schedules, schedule_sections
- lecture_sessions, attendance_records, attendance_section_records, attendance_evidence
- workload_policies, academic_exceptions, substitutions, co_teaching
- notifications, audit_logs, system_settings
- import_jobs, import_errors

2. Security
- All write policies use TO anon, authenticated
- SELECT policies already exist from previous migrations
*/

-- Users
DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "users_delete" ON users;
CREATE POLICY "users_delete" ON users FOR DELETE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all" ON users FOR SELECT TO anon, authenticated USING (true);

-- Colleges
DROP POLICY IF EXISTS "colleges_insert" ON colleges;
CREATE POLICY "colleges_insert" ON colleges FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "colleges_update" ON colleges;
CREATE POLICY "colleges_update" ON colleges FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "colleges_delete" ON colleges;
CREATE POLICY "colleges_delete" ON colleges FOR DELETE TO anon, authenticated USING (true);

-- Departments
DROP POLICY IF EXISTS "departments_insert" ON departments;
CREATE POLICY "departments_insert" ON departments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "departments_update" ON departments;
CREATE POLICY "departments_update" ON departments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "departments_delete" ON departments;
CREATE POLICY "departments_delete" ON departments FOR DELETE TO anon, authenticated USING (true);

-- Buildings
DROP POLICY IF EXISTS "buildings_insert" ON buildings;
CREATE POLICY "buildings_insert" ON buildings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "buildings_update" ON buildings;
CREATE POLICY "buildings_update" ON buildings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "buildings_delete" ON buildings;
CREATE POLICY "buildings_delete" ON buildings FOR DELETE TO anon, authenticated USING (true);

-- Rooms
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rooms_update" ON rooms;
CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rooms_delete" ON rooms;
CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO anon, authenticated USING (true);

-- Academic Years
DROP POLICY IF EXISTS "academic_years_insert" ON academic_years;
CREATE POLICY "academic_years_insert" ON academic_years FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "academic_years_update" ON academic_years;
CREATE POLICY "academic_years_update" ON academic_years FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "academic_years_delete" ON academic_years;
CREATE POLICY "academic_years_delete" ON academic_years FOR DELETE TO anon, authenticated USING (true);

-- Semesters
DROP POLICY IF EXISTS "semesters_insert" ON semesters;
CREATE POLICY "semesters_insert" ON semesters FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "semesters_update" ON semesters;
CREATE POLICY "semesters_update" ON semesters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "semesters_delete" ON semesters;
CREATE POLICY "semesters_delete" ON semesters FOR DELETE TO anon, authenticated USING (true);

-- Stages
DROP POLICY IF EXISTS "stages_insert" ON stages;
CREATE POLICY "stages_insert" ON stages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "stages_update" ON stages;
CREATE POLICY "stages_update" ON stages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stages_delete" ON stages;
CREATE POLICY "stages_delete" ON stages FOR DELETE TO anon, authenticated USING (true);

-- Sections
DROP POLICY IF EXISTS "sections_insert" ON sections;
CREATE POLICY "sections_insert" ON sections FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sections_update" ON sections;
CREATE POLICY "sections_update" ON sections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sections_delete" ON sections;
CREATE POLICY "sections_delete" ON sections FOR DELETE TO anon, authenticated USING (true);

-- Subjects
DROP POLICY IF EXISTS "subjects_insert" ON subjects;
CREATE POLICY "subjects_insert" ON subjects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "subjects_update" ON subjects;
CREATE POLICY "subjects_update" ON subjects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "subjects_delete" ON subjects;
CREATE POLICY "subjects_delete" ON subjects FOR DELETE TO anon, authenticated USING (true);

-- Faculties
DROP POLICY IF EXISTS "faculties_insert" ON faculties;
CREATE POLICY "faculties_insert" ON faculties FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "faculties_update" ON faculties;
CREATE POLICY "faculties_update" ON faculties FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "faculties_delete" ON faculties;
CREATE POLICY "faculties_delete" ON faculties FOR DELETE TO anon, authenticated USING (true);

-- Schedules
DROP POLICY IF EXISTS "schedules_insert" ON schedules;
CREATE POLICY "schedules_insert" ON schedules FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "schedules_update" ON schedules;
CREATE POLICY "schedules_update" ON schedules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "schedules_delete" ON schedules;
CREATE POLICY "schedules_delete" ON schedules FOR DELETE TO anon, authenticated USING (true);

-- Schedule Sections
DROP POLICY IF EXISTS "schedule_sections_insert" ON schedule_sections;
CREATE POLICY "schedule_sections_insert" ON schedule_sections FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "schedule_sections_update" ON schedule_sections;
CREATE POLICY "schedule_sections_update" ON schedule_sections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "schedule_sections_delete" ON schedule_sections;
CREATE POLICY "schedule_sections_delete" ON schedule_sections FOR DELETE TO anon, authenticated USING (true);

-- Lecture Sessions
DROP POLICY IF EXISTS "lecture_sessions_insert" ON lecture_sessions;
CREATE POLICY "lecture_sessions_insert" ON lecture_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "lecture_sessions_update" ON lecture_sessions;
CREATE POLICY "lecture_sessions_update" ON lecture_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "lecture_sessions_delete" ON lecture_sessions;
CREATE POLICY "lecture_sessions_delete" ON lecture_sessions FOR DELETE TO anon, authenticated USING (true);

-- Attendance Records
DROP POLICY IF EXISTS "attendance_records_insert" ON attendance_records;
CREATE POLICY "attendance_records_insert" ON attendance_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "attendance_records_update" ON attendance_records;
CREATE POLICY "attendance_records_update" ON attendance_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "attendance_records_delete" ON attendance_records;
CREATE POLICY "attendance_records_delete" ON attendance_records FOR DELETE TO anon, authenticated USING (true);

-- Attendance Section Records
DROP POLICY IF EXISTS "attendance_section_records_insert" ON attendance_section_records;
CREATE POLICY "attendance_section_records_insert" ON attendance_section_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "attendance_section_records_update" ON attendance_section_records;
CREATE POLICY "attendance_section_records_update" ON attendance_section_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "attendance_section_records_delete" ON attendance_section_records;
CREATE POLICY "attendance_section_records_delete" ON attendance_section_records FOR DELETE TO anon, authenticated USING (true);

-- Attendance Evidence
DROP POLICY IF EXISTS "attendance_evidence_insert" ON attendance_evidence;
CREATE POLICY "attendance_evidence_insert" ON attendance_evidence FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "attendance_evidence_update" ON attendance_evidence;
CREATE POLICY "attendance_evidence_update" ON attendance_evidence FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "attendance_evidence_delete" ON attendance_evidence;
CREATE POLICY "attendance_evidence_delete" ON attendance_evidence FOR DELETE TO anon, authenticated USING (true);

-- Workload Policies
DROP POLICY IF EXISTS "workload_policies_insert" ON workload_policies;
CREATE POLICY "workload_policies_insert" ON workload_policies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workload_policies_update" ON workload_policies;
CREATE POLICY "workload_policies_update" ON workload_policies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workload_policies_delete" ON workload_policies;
CREATE POLICY "workload_policies_delete" ON workload_policies FOR DELETE TO anon, authenticated USING (true);

-- Academic Exceptions
DROP POLICY IF EXISTS "academic_exceptions_insert" ON academic_exceptions;
CREATE POLICY "academic_exceptions_insert" ON academic_exceptions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "academic_exceptions_update" ON academic_exceptions;
CREATE POLICY "academic_exceptions_update" ON academic_exceptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "academic_exceptions_delete" ON academic_exceptions;
CREATE POLICY "academic_exceptions_delete" ON academic_exceptions FOR DELETE TO anon, authenticated USING (true);

-- Substitutions
DROP POLICY IF EXISTS "substitutions_insert" ON substitutions;
CREATE POLICY "substitutions_insert" ON substitutions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "substitutions_update" ON substitutions;
CREATE POLICY "substitutions_update" ON substitutions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "substitutions_delete" ON substitutions;
CREATE POLICY "substitutions_delete" ON substitutions FOR DELETE TO anon, authenticated USING (true);

-- Co-Teaching
DROP POLICY IF EXISTS "co_teaching_insert" ON co_teaching;
CREATE POLICY "co_teaching_insert" ON co_teaching FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "co_teaching_update" ON co_teaching;
CREATE POLICY "co_teaching_update" ON co_teaching FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "co_teaching_delete" ON co_teaching;
CREATE POLICY "co_teaching_delete" ON co_teaching FOR DELETE TO anon, authenticated USING (true);

-- Notifications
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO anon, authenticated USING (true);

-- Audit Logs
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
CREATE POLICY "audit_logs_update" ON audit_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE TO anon, authenticated USING (true);

-- System Settings
DROP POLICY IF EXISTS "system_settings_insert" ON system_settings;
CREATE POLICY "system_settings_insert" ON system_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "system_settings_update" ON system_settings;
CREATE POLICY "system_settings_update" ON system_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "system_settings_delete" ON system_settings;
CREATE POLICY "system_settings_delete" ON system_settings FOR DELETE TO anon, authenticated USING (true);

-- Import Jobs
DROP POLICY IF EXISTS "import_jobs_insert" ON import_jobs;
CREATE POLICY "import_jobs_insert" ON import_jobs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "import_jobs_update" ON import_jobs;
CREATE POLICY "import_jobs_update" ON import_jobs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "import_jobs_delete" ON import_jobs;
CREATE POLICY "import_jobs_delete" ON import_jobs FOR DELETE TO anon, authenticated USING (true);

-- Import Errors
DROP POLICY IF EXISTS "import_errors_insert" ON import_errors;
CREATE POLICY "import_errors_insert" ON import_errors FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "import_errors_update" ON import_errors;
CREATE POLICY "import_errors_update" ON import_errors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "import_errors_delete" ON import_errors;
CREATE POLICY "import_errors_delete" ON import_errors FOR DELETE TO anon, authenticated USING (true);

-- Update SELECT policies to include anon role (so the anon-key frontend can read)
DROP POLICY IF EXISTS "colleges_select_authenticated" ON colleges;
CREATE POLICY "colleges_select_authenticated" ON colleges FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "departments_select_authenticated" ON departments;
CREATE POLICY "departments_select_authenticated" ON departments FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "buildings_select_authenticated" ON buildings;
CREATE POLICY "buildings_select_authenticated" ON buildings FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "rooms_select_authenticated" ON rooms;
CREATE POLICY "rooms_select_authenticated" ON rooms FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "academic_years_select_authenticated" ON academic_years;
CREATE POLICY "academic_years_select_authenticated" ON academic_years FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "semesters_select_authenticated" ON semesters;
CREATE POLICY "semesters_select_authenticated" ON semesters FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "stages_select_authenticated" ON stages;
CREATE POLICY "stages_select_authenticated" ON stages FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "sections_select_authenticated" ON sections;
CREATE POLICY "sections_select_authenticated" ON sections FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "subjects_select_authenticated" ON subjects;
CREATE POLICY "subjects_select_authenticated" ON subjects FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "faculties_select_authenticated" ON faculties;
CREATE POLICY "faculties_select_authenticated" ON faculties FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "schedules_select_authenticated" ON schedules;
CREATE POLICY "schedules_select_authenticated" ON schedules FOR SELECT
  TO anon, authenticated USING (is_deleted = false);

DROP POLICY IF EXISTS "schedule_sections_select_authenticated" ON schedule_sections;
CREATE POLICY "schedule_sections_select_authenticated" ON schedule_sections FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "lecture_sessions_select_authenticated" ON lecture_sessions;
CREATE POLICY "lecture_sessions_select_authenticated" ON lecture_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "attendance_records_select_authenticated" ON attendance_records;
CREATE POLICY "attendance_records_select_authenticated" ON attendance_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "attendance_section_records_select_authenticated" ON attendance_section_records;
CREATE POLICY "attendance_section_records_select_authenticated" ON attendance_section_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "attendance_evidence_select_authenticated" ON attendance_evidence;
CREATE POLICY "attendance_evidence_select_authenticated" ON attendance_evidence FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "workload_policies_select_authenticated" ON workload_policies;
CREATE POLICY "workload_policies_select_authenticated" ON workload_policies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "academic_exceptions_select_authenticated" ON academic_exceptions;
CREATE POLICY "academic_exceptions_select_authenticated" ON academic_exceptions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "substitutions_select_authenticated" ON substitutions;
CREATE POLICY "substitutions_select_authenticated" ON substitutions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "co_teaching_select_authenticated" ON co_teaching;
CREATE POLICY "co_teaching_select_authenticated" ON co_teaching FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "notifications_select_authenticated" ON notifications;
CREATE POLICY "notifications_select_authenticated" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON audit_logs;
CREATE POLICY "audit_logs_select_authenticated" ON audit_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "system_settings_select_authenticated" ON system_settings;
CREATE POLICY "system_settings_select_authenticated" ON system_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "import_jobs_select_authenticated" ON import_jobs;
CREATE POLICY "import_jobs_select_authenticated" ON import_jobs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "import_errors_select_authenticated" ON import_errors;
CREATE POLICY "import_errors_select_authenticated" ON import_errors FOR SELECT
  TO anon, authenticated USING (true);
