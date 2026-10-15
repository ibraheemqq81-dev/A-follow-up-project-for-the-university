/*
# Security Fix Part 4: RLS Policies + Column Privileges + Attendance Unique Constraint

## Summary
1. Locks down sensitive tables: users, registration_requests, user_devices, audit_logs
2. Adds column-level UPDATE privileges on users to prevent role/password escalation
3. Adds unique constraint on attendance_records (schedule_id, lecture_date) for duplicate prevention
4. Keeps reference data tables readable for the anon-key frontend
*/

-- ============================================================
-- USERS TABLE: column-level privileges
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Revoke broad UPDATE, grant only safe columns
REVOKE UPDATE ON users FROM anon, authenticated;
GRANT UPDATE (name, avatar, must_change_password, updated_at) ON users TO anon, authenticated;

-- No direct INSERT (only via approve_registration SECURITY DEFINER)
REVOKE INSERT ON users FROM anon, authenticated;

-- No direct DELETE
REVOKE DELETE ON users FROM anon, authenticated;

-- ============================================================
-- REGISTRATION_REQUESTS: restrict update/delete to functions only
-- ============================================================
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE ON registration_requests FROM anon, authenticated;
REVOKE DELETE ON registration_requests FROM anon, authenticated;

-- ============================================================
-- USER_DEVICES: restrict update/delete to functions only
-- ============================================================
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE ON user_devices FROM anon, authenticated;
REVOKE DELETE ON user_devices FROM anon, authenticated;

-- ============================================================
-- AUDIT_LOGS: no update/delete ever
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE ON audit_logs FROM anon, authenticated;
REVOKE DELETE ON audit_logs FROM anon, authenticated;

-- ============================================================
-- ATTENDANCE RECORDS: unique constraint for duplicate prevention
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_schedule_date_unique
  ON attendance_records (schedule_id, lecture_date)
  WHERE schedule_id IS NOT NULL AND lecture_date IS NOT NULL;
