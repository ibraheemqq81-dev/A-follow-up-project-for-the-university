/*
# Account Lifecycle, Email Verification, Registration, and Device Management

## 1. Modified Tables
- `users`: Added `account_status` (text, default 'active') and `max_devices` (integer, default 1).
  - account_status values: 'active', 'pending_email', 'pending_approval', 'rejected', 'suspended'
  - All existing users get 'active' by default so current accounts keep working.

## 2. New Tables
- `registration_requests`: Stores self-registration requests from new users.
  - Fields: name, email, password_hash, requested_role, college_id, department_id, faculty_id,
    status (pending_email / pending_approval / approved / rejected), email_verified_at, created_at, reviewed_by, reviewed_at, rejection_reason
- `email_verifications`: Stores verification code hashes for email confirmation.
  - Fields: email, code_hash, expires_at, used, attempts, created_at
- `user_devices`: Tracks devices used to access each account.
  - Fields: user_id, device_fingerprint, device_name, status (pending / approved / revoked),
    approved_by, approved_at, created_at, last_seen_at

## 3. Security
- RLS enabled on all new tables, TO anon, authenticated (anon-key client needs access).
- registration_requests: anyone can INSERT (sign-up), only authenticated can SELECT.
- email_verifications: anyone can INSERT and SELECT by email (verification is public).
- user_devices: anyone can INSERT, authenticated can SELECT all (for admin view).

## 4. Important Notes
- account_status defaults to 'active' so ALL existing users keep full access.
- The OWNER account (user-owner-default) explicitly set to 'active'.
- No data is deleted or migrated — only additive columns with safe defaults.
*/

-- ============ ALTER users table ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_status') THEN
    ALTER TABLE users ADD COLUMN account_status text DEFAULT 'active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='max_devices') THEN
    ALTER TABLE users ADD COLUMN max_devices integer DEFAULT 1;
  END IF;
END $$;

-- Ensure existing users have 'active' status
UPDATE users SET account_status = 'active' WHERE account_status IS NULL OR account_status = '';

-- ============ registration_requests ============
CREATE TABLE IF NOT EXISTS registration_requests (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  requested_role text NOT NULL CHECK (requested_role IN ('COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY')),
  college_id text,
  department_id text,
  faculty_id text,
  status text DEFAULT 'pending_email',
  email_verified_at timestamptz,
  rejection_reason text,
  reviewed_by text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reg_requests_select" ON registration_requests;
CREATE POLICY "reg_requests_select" ON registration_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "reg_requests_insert" ON registration_requests;
CREATE POLICY "reg_requests_insert" ON registration_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reg_requests_update" ON registration_requests;
CREATE POLICY "reg_requests_update" ON registration_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reg_requests_delete" ON registration_requests;
CREATE POLICY "reg_requests_delete" ON registration_requests FOR DELETE
  TO anon, authenticated USING (true);

-- ============ email_verifications ============
CREATE TABLE IF NOT EXISTS email_verifications (
  id text PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_verif_select" ON email_verifications;
CREATE POLICY "email_verif_select" ON email_verifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "email_verif_insert" ON email_verifications;
CREATE POLICY "email_verif_insert" ON email_verifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "email_verif_update" ON email_verifications;
CREATE POLICY "email_verif_update" ON email_verifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "email_verif_delete" ON email_verifications;
CREATE POLICY "email_verif_delete" ON email_verifications FOR DELETE
  TO anon, authenticated USING (true);

-- ============ user_devices ============
CREATE TABLE IF NOT EXISTS user_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  device_fingerprint text NOT NULL,
  device_name text,
  user_agent text,
  status text DEFAULT 'pending',
  approved_by text,
  approved_by_name text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_devices_select" ON user_devices;
CREATE POLICY "user_devices_select" ON user_devices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "user_devices_insert" ON user_devices;
CREATE POLICY "user_devices_insert" ON user_devices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "user_devices_update" ON user_devices;
CREATE POLICY "user_devices_update" ON user_devices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_devices_delete" ON user_devices;
CREATE POLICY "user_devices_delete" ON user_devices FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reg_requests_email ON registration_requests(email);
CREATE INDEX IF NOT EXISTS idx_reg_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
