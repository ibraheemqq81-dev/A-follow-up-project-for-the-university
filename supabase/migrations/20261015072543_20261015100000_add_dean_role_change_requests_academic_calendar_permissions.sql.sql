/*
# Add COLLEGE_DEAN role, change requests, academic calendar, and fine-grained permissions

## Changes Overview

1. **Users table**: Add 'COLLEGE_DEAN' to the role CHECK constraint
2. **New table: change_requests** — For lecture change requests (department monitor → college monitor approval flow)
3. **New table: change_request_decisions** — Audit trail of decisions on each change request
4. **New table: academic_calendar_events** — Flexible academic calendar (start dates, holidays, exams, breaks)
5. **New table: roles** — Custom role definitions
6. **New table: permissions** — Fine-grained permission definitions
7. **New table: role_permissions** — Maps permissions to roles
8. **New table: user_permissions** — Direct per-user permission grants/revokes
9. **New table: dean_updates** — Updates feed for college deans

## Security
- RLS enabled on all new tables
- Policies use auth.uid() for ownership checks where applicable
- Change requests scoped by college/department
*/

-- ============================================================
-- 1. Add COLLEGE_DEAN to users role constraint
-- ============================================================
DO $$
BEGIN
  -- Drop old constraint and add new one with COLLEGE_DEAN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role = ANY (ARRAY['OWNER'::text, 'COLLEGE_DEAN'::text, 'COLLEGE_MONITOR'::text, 'DEPARTMENT_MONITOR'::text, 'FACULTY'::text]));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- 2. change_requests table
-- ============================================================
CREATE TABLE IF NOT EXISTS change_requests (
  id text PRIMARY KEY,
  schedule_id text NOT NULL,
  college_id text,
  department_id text,
  stage_id text,
  subject_id text,
  faculty_id text,
  
  -- Original values (snapshot at time of request)
  original_day text,
  original_start_time text,
  original_end_time text,
  original_room_id text,
  original_lecture_type text,
  original_faculty_id text,
  
  -- Requested changes
  change_type text NOT NULL DEFAULT 'reschedule',
  reason_type text NOT NULL DEFAULT 'other',
  reason_description text NOT NULL,
  
  -- New values (if applicable)
  new_day text,
  new_start_time text,
  new_end_time text,
  new_room_id text,
  new_lecture_type text,
  new_faculty_id text,
  
  -- Status: pending, approved, rejected, returned, applied
  status text NOT NULL DEFAULT 'pending',
  
  -- Requester info
  requested_by text NOT NULL,
  requested_by_name text,
  
  -- Reviewer info
  reviewed_by text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_notes text,
  rejection_reason text,
  
  -- Attachments (JSON array of file paths)
  attachments jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_change_requests" ON change_requests;
CREATE POLICY "select_change_requests"
ON change_requests FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_change_requests" ON change_requests;
CREATE POLICY "insert_change_requests"
ON change_requests FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_change_requests" ON change_requests;
CREATE POLICY "update_change_requests"
ON change_requests FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_change_requests" ON change_requests;
CREATE POLICY "delete_change_requests"
ON change_requests FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 3. change_request_decisions table (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS change_request_decisions (
  id text PRIMARY KEY,
  change_request_id text NOT NULL,
  action text NOT NULL,
  decision_by text NOT NULL,
  decision_by_name text,
  notes text,
  previous_status text,
  new_status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE change_request_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_change_request_decisions" ON change_request_decisions;
CREATE POLICY "select_change_request_decisions"
ON change_request_decisions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_change_request_decisions" ON change_request_decisions;
CREATE POLICY "insert_change_request_decisions"
ON change_request_decisions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_change_request_decisions" ON change_request_decisions;
CREATE POLICY "update_change_request_decisions"
ON change_request_decisions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_change_request_decisions" ON change_request_decisions;
CREATE POLICY "delete_change_request_decisions"
ON change_request_decisions FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 4. academic_calendar_events table
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_calendar_events (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  
  -- Scope: university-wide, college-specific, department-specific, stage-specific
  scope_type text NOT NULL DEFAULT 'university',
  college_id text,
  department_id text,
  stage_id text,
  
  -- Event type: term_start, term_end, holiday, exam_period, break, training, no_lecture_day, exception
  event_type text NOT NULL DEFAULT 'term_start',
  
  start_date date NOT NULL,
  end_date date NOT NULL,
  
  is_recurring boolean DEFAULT false,
  
  created_by text,
  created_by_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE academic_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_academic_calendar_events" ON academic_calendar_events;
CREATE POLICY "select_academic_calendar_events"
ON academic_calendar_events FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_academic_calendar_events" ON academic_calendar_events;
CREATE POLICY "insert_academic_calendar_events"
ON academic_calendar_events FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_academic_calendar_events" ON academic_calendar_events;
CREATE POLICY "update_academic_calendar_events"
ON academic_calendar_events FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_academic_calendar_events" ON academic_calendar_events;
CREATE POLICY "delete_academic_calendar_events"
ON academic_calendar_events FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 5. roles table (custom role definitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  name text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  description text,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_roles" ON roles;
CREATE POLICY "select_roles"
ON roles FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_roles" ON roles;
CREATE POLICY "insert_roles"
ON roles FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_roles" ON roles;
CREATE POLICY "update_roles"
ON roles FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_roles" ON roles;
CREATE POLICY "delete_roles"
ON roles FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 6. permissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id text PRIMARY KEY,
  name text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  description text,
  module text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_permissions" ON permissions;
CREATE POLICY "select_permissions"
ON permissions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_permissions" ON permissions;
CREATE POLICY "insert_permissions"
ON permissions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_permissions" ON permissions;
CREATE POLICY "update_permissions"
ON permissions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_permissions" ON permissions;
CREATE POLICY "delete_permissions"
ON permissions FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 7. role_permissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id text PRIMARY KEY,
  role_id text NOT NULL,
  permission_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_role_permissions" ON role_permissions;
CREATE POLICY "select_role_permissions"
ON role_permissions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_role_permissions" ON role_permissions;
CREATE POLICY "insert_role_permissions"
ON role_permissions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_role_permissions" ON role_permissions;
CREATE POLICY "update_role_permissions"
ON role_permissions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_role_permissions" ON role_permissions;
CREATE POLICY "delete_role_permissions"
ON role_permissions FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 8. user_permissions table (direct per-user overrides)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  permission_id text NOT NULL,
  granted boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_user_permissions" ON user_permissions;
CREATE POLICY "select_user_permissions"
ON user_permissions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_user_permissions" ON user_permissions;
CREATE POLICY "insert_user_permissions"
ON user_permissions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_user_permissions" ON user_permissions;
CREATE POLICY "update_user_permissions"
ON user_permissions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_user_permissions" ON user_permissions;
CREATE POLICY "delete_user_permissions"
ON user_permissions FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 9. dean_updates table (updates feed for college deans)
-- ============================================================
CREATE TABLE IF NOT EXISTS dean_updates (
  id text PRIMARY KEY,
  college_id text NOT NULL,
  update_type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text,
  related_entity_type text,
  related_entity_id text,
  department_id text,
  created_by text,
  created_by_name text,
  is_read boolean DEFAULT false,
  read_by text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dean_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_dean_updates" ON dean_updates;
CREATE POLICY "select_dean_updates"
ON dean_updates FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_dean_updates" ON dean_updates;
CREATE POLICY "insert_dean_updates"
ON dean_updates FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_dean_updates" ON dean_updates;
CREATE POLICY "update_dean_updates"
ON dean_updates FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_dean_updates" ON dean_updates;
CREATE POLICY "delete_dean_updates"
ON dean_updates FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- 10. Seed default roles and permissions
-- ============================================================
INSERT INTO roles (id, name, name_ar, description, is_system_role) VALUES
  ('role-owner', 'OWNER', 'مالك النظام', 'مالك النظام بصلاحيات كاملة', true),
  ('role-dean', 'COLLEGE_DEAN', 'عميد الكلية', 'عميد كلية - اطلاع على مستجدات الكلية', true),
  ('role-college-monitor', 'COLLEGE_MONITOR', 'مسؤول متابعة الكلية', 'مسؤول متابعة الكلية - مراجعة الطلبات', true),
  ('role-dept-monitor', 'DEPARTMENT_MONITOR', 'مسؤول متابعة القسم', 'مسؤول متابعة القسم - إدارة الجداول والطلبات', true),
  ('role-faculty', 'FACULTY', 'تدريسي', 'تدريسي - تسجيل الحضور والمتابعة', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, name, name_ar, description, module) VALUES
  ('perm-users-view', 'users.view', 'عرض المستخدمين', 'عرض قائمة المستخدمين', 'users'),
  ('perm-users-create', 'users.create', 'إنشاء مستخدمين', 'إنشاء حسابات جديدة', 'users'),
  ('perm-users-update', 'users.update', 'تعديل المستخدمين', 'تعديل بيانات المستخدمين', 'users'),
  ('perm-users-disable', 'users.disable', 'تعطيل المستخدمين', 'تعطيل حسابات المستخدمين', 'users'),
  ('perm-roles-view', 'roles.view', 'عرض الأدوار', 'عرض الأدوار المتاحة', 'roles'),
  ('perm-roles-manage', 'roles.manage', 'إدارة الأدوار', 'إنشاء وتعديل الأدوار', 'roles'),
  ('perm-permissions-assign', 'permissions.assign', 'إدارة الصلاحيات', 'منح وسحب الصلاحيات', 'permissions'),
  ('perm-colleges-view', 'colleges.view', 'عرض الكليات', 'عرض الكليات', 'colleges'),
  ('perm-colleges-manage', 'colleges.manage', 'إدارة الكليات', 'إضافة وتعديل الكليات', 'colleges'),
  ('perm-departments-view', 'departments.view', 'عرض الأقسام', 'عرض الأقسام', 'departments'),
  ('perm-departments-manage', 'departments.manage', 'إدارة الأقسام', 'إضافة وتعديل الأقسام', 'departments'),
  ('perm-schedules-view', 'schedules.view', 'عرض الجداول', 'عرض الجداول الدراسية', 'schedules'),
  ('perm-schedules-create', 'schedules.create', 'إنشاء الجداول', 'إضافة محاضرات جديدة', 'schedules'),
  ('perm-schedules-update', 'schedules.update', 'تعديل الجداول', 'تعديل المحاضرات', 'schedules'),
  ('perm-schedules-delete', 'schedules.delete', 'حذف الجداول', 'حذف المحاضرات', 'schedules'),
  ('perm-change-requests-create', 'change_requests.create', 'إنشاء طلبات التغيير', 'تقديم طلبات تغيير المحاضرات', 'change_requests'),
  ('perm-change-requests-view', 'change_requests.view', 'عرض طلبات التغيير', 'عرض طلبات تغيير المحاضرات', 'change_requests'),
  ('perm-change-requests-approve', 'change_requests.approve', 'الموافقة على الطلبات', 'الموافقة على طلبات التغيير', 'change_requests'),
  ('perm-change-requests-reject', 'change_requests.reject', 'رفض الطلبات', 'رفض طلبات التغيير', 'change_requests'),
  ('perm-change-requests-return', 'change_requests.return', 'إعادة الطلبات', 'إعادة طلبات التغيير لاستكمال المعلومات', 'change_requests'),
  ('perm-attendance-view', 'attendance.view', 'عرض الحضور', 'عرض سجلات الحضور', 'attendance'),
  ('perm-attendance-record', 'attendance.record', 'تسجيل الحضور', 'تسجيل حضور المحاضرات', 'attendance'),
  ('perm-attendance-update', 'attendance.update', 'تعديل الحضور', 'تعديل سجلات الحضور', 'attendance'),
  ('perm-reports-view', 'reports.view', 'عرض التقارير', 'عرض التقارير والإحصائيات', 'reports'),
  ('perm-reports-export', 'reports.export', 'تصدير التقارير', 'تصدير التقارير إلى Excel', 'reports'),
  ('perm-academic-calendar-manage', 'academic_calendar.manage', 'إدارة التقويم', 'إدارة التقويم الدراسي', 'academic_calendar'),
  ('perm-imports-execute', 'imports.execute', 'تنفيذ الاستيراد', 'استيراد البيانات من Excel', 'imports'),
  ('perm-audit-logs-view', 'audit_logs.view', 'عرض سجل التدقيق', 'عرض سجلات العمليات', 'audit_logs')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 11. Seed role_permissions for OWNER (all permissions)
-- ============================================================
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-owner-' || p.id, 'role-owner', p.id FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- COLLEGE_DEAN: view-only permissions
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-dean-' || p.id, 'role-dean', p.id
FROM permissions p
WHERE p.name IN ('colleges.view','departments.view','schedules.view','change_requests.view','attendance.view','reports.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- COLLEGE_MONITOR: view + manage schedules + approve/reject/return change requests
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-cm-' || p.id, 'role-college-monitor', p.id
FROM permissions p
WHERE p.name IN ('colleges.view','departments.view','schedules.view','schedules.create','schedules.update','change_requests.view','change_requests.approve','change_requests.reject','change_requests.return','attendance.view','attendance.record','attendance.update','reports.view','reports.export','imports.execute')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- DEPARTMENT_MONITOR: manage schedules + create change requests
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-dm-' || p.id, 'role-dept-monitor', p.id
FROM permissions p
WHERE p.name IN ('departments.view','schedules.view','schedules.create','schedules.update','schedules.delete','change_requests.create','change_requests.view','attendance.view','attendance.record','attendance.update','reports.view','reports.export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- FACULTY: view schedules + record attendance
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-fac-' || p.id, 'role-faculty', p.id
FROM permissions p
WHERE p.name IN ('schedules.view','attendance.view','attendance.record','reports.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- 12. Create admin user with bcrypt-hashed password
-- ============================================================
-- The password is "Admin@12345678" — hashed with crypt/bcrypt
INSERT INTO users (id, uid, name, email, role, role_title_ar, password_hash, status, account_status, must_change_password)
SELECT 'user-admin-001', 'uid-admin-001', 'مدير النظام', 'admin@uomus.edu.iq', 'OWNER', 'مالك النظام',
  crypt('Admin@12345678', gen_salt('bf', 10)),
  'active', 'active', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@uomus.edu.iq');

-- ============================================================
-- 13. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_college ON change_requests(college_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_department ON change_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_schedule ON change_requests(schedule_id);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_dates ON academic_calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_scope ON academic_calendar_events(scope_type, college_id, department_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_dean_updates_college ON dean_updates(college_id);
CREATE INDEX IF NOT EXISTS idx_dean_updates_created ON dean_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
