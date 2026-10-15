/*
# Create backup & restore system tables

1. New Tables
- `system_backups` — stores backup metadata and full JSON data snapshot
  - id (text, primary key)
  - name (text, display name)
  - type (text: 'full' or 'partial')
  - status (text: creating, completed, failed, verifying, valid, invalid, restoring, restored, restore_failed)
  - format_version (text, backup format version)
  - size_bytes (bigint, approximate size of backup data)
  - total_records (integer, total row count across all tables)
  - tables_count (integer, number of tables included)
  - tables_included (text[], list of table names)
  - checksum (text, sha256 hash of backup data)
  - backup_data (jsonb, the full backup payload)
  - created_by (text, user id)
  - created_by_name (text, user name)
  - created_at (timestamptz)
  - verified_at (timestamptz, last verification time)
  - verified_by (text, user id who verified)
  - verification_result (jsonb, verification details)
  - restored_at (timestamptz, last restore time)
  - restored_by (text, user id who restored)
  - restore_result (jsonb, restore result details)
  - notes (text, optional description/notes)
- `backup_audit_log` — audit trail for all backup operations
  - id (text, primary key)
  - backup_id (text, reference to system_backups id)
  - backup_name (text, backup display name)
  - action (text: BACKUP_CREATED, BACKUP_DOWNLOADED, BACKUP_CREATION_FAILED, RESTORE_STARTED, RESTORE_SUCCEEDED, RESTORE_FAILED, BACKUP_VERIFIED, BACKUP_VERIFICATION_FAILED, BACKUP_UPLOADED)
  - user_id (text)
  - user_name (text)
  - user_role (text)
  - result (text: success or failed)
  - error_message (text, nullable)
  - details (jsonb, additional context)
  - created_at (timestamptz)

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD (the app uses anon key and enforces OWNER role in the frontend).
- SECURITY DEFINER functions handle the privileged restore operation.
*/

CREATE TABLE IF NOT EXISTS system_backups (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'creating',
  format_version text NOT NULL DEFAULT '2.0.0',
  size_bytes bigint DEFAULT 0,
  total_records integer DEFAULT 0,
  tables_count integer DEFAULT 0,
  tables_included text[] DEFAULT '{}',
  checksum text,
  backup_data jsonb,
  created_by text,
  created_by_name text,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  verified_by text,
  verification_result jsonb,
  restored_at timestamptz,
  restored_by text,
  restore_result jsonb,
  notes text
);

ALTER TABLE system_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_backups_select_all" ON system_backups;
CREATE POLICY "system_backups_select_all"
ON system_backups FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "system_backups_insert_all" ON system_backups;
CREATE POLICY "system_backups_insert_all"
ON system_backups FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "system_backups_update_all" ON system_backups;
CREATE POLICY "system_backups_update_all"
ON system_backups FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "system_backups_delete_all" ON system_backups;
CREATE POLICY "system_backups_delete_all"
ON system_backups FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS backup_audit_log (
  id text PRIMARY KEY,
  backup_id text,
  backup_name text,
  action text NOT NULL,
  user_id text,
  user_name text,
  user_role text,
  result text NOT NULL DEFAULT 'success',
  error_message text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE backup_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backup_audit_log_select_all" ON backup_audit_log;
CREATE POLICY "backup_audit_log_select_all"
ON backup_audit_log FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "backup_audit_log_insert_all" ON backup_audit_log;
CREATE POLICY "backup_audit_log_insert_all"
ON backup_audit_log FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "backup_audit_log_update_all" ON backup_audit_log;
CREATE POLICY "backup_audit_log_update_all"
ON backup_audit_log FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backup_audit_log_delete_all" ON backup_audit_log;
CREATE POLICY "backup_audit_log_delete_all"
ON backup_audit_log FOR DELETE
TO anon, authenticated USING (true);
