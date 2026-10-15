/*
# Security Fix Part 1: Session Tokens Table + Verify/Create/Revoke Session Functions

## Summary
Adds server-validated session tokens to replace the fake base64 token currently in use.
This is the foundation for all subsequent security fixes.

## New Tables
- session_tokens: stores hashed session tokens with user_id, expiry, and revocation

## New Functions
- verify_session(p_token): validates a session token, returns user info
- create_session(p_user_id): creates a new session token for a user
- revoke_session(p_token): revokes a session token (logout)

## Security
- session_tokens table has RLS enabled with deny-all policies (only accessible via SECURITY DEFINER functions)
- verify_session and create_session are SECURITY DEFINER, EXECUTE revoked from anon
- revoke_session is SECURITY DEFINER, EXECUTE revoked from anon
*/

-- ============================================================
-- 1. CREATE SESSION TOKENS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS session_tokens (
  id text PRIMARY KEY DEFAULT ('st-' || gen_random_uuid()::text),
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE session_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_tokens_no_direct_access" ON session_tokens;
CREATE POLICY "session_tokens_no_direct_access" ON session_tokens
  FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "session_tokens_no_insert" ON session_tokens;
CREATE POLICY "session_tokens_no_insert" ON session_tokens
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "session_tokens_no_update" ON session_tokens;
CREATE POLICY "session_tokens_no_update" ON session_tokens
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "session_tokens_no_delete" ON session_tokens;
CREATE POLICY "session_tokens_no_delete" ON session_tokens
  FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX IF NOT EXISTS session_tokens_hash_idx ON session_tokens (token_hash);
CREATE INDEX IF NOT EXISTS session_tokens_user_idx ON session_tokens (user_id);
CREATE INDEX IF NOT EXISTS session_tokens_expires_idx ON session_tokens (expires_at);

-- ============================================================
-- 2. VERIFY_SESSION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION verify_session(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_token_hash text;
  v_session record;
  v_user record;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN json_build_object('success', false, 'error', 'no_token');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_session
  FROM session_tokens
  WHERE token_hash = v_token_hash
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invalid_or_expired');
  END IF;

  SELECT * INTO v_user FROM users WHERE id = v_session.user_id LIMIT 1;

  IF v_user IS NULL OR v_user.status = 'inactive' THEN
    RETURN json_build_object('success', false, 'error', 'user_disabled');
  END IF;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user.id,
    'name', v_user.name,
    'email', v_user.email,
    'role', v_user.role,
    'status', v_user.status,
    'account_status', v_user.account_status,
    'assigned_college_id', v_user.assigned_college_id,
    'assigned_department_id', v_user.assigned_department_id,
    'assigned_faculty_id', v_user.assigned_faculty_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_session(text) FROM anon;
GRANT EXECUTE ON FUNCTION verify_session(text) TO authenticated;

-- ============================================================
-- 3. CREATE_SESSION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION create_session(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_token text;
  v_token_hash text;
  v_token_id text;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_token_id := 'st-' || gen_random_uuid()::text;

  INSERT INTO session_tokens (id, token_hash, user_id, expires_at)
  VALUES (v_token_id, v_token_hash, p_user_id, now() + interval '24 hours');

  RETURN json_build_object('success', true, 'token', v_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_session(text) FROM anon;
GRANT EXECUTE ON FUNCTION create_session(text) TO authenticated;

-- ============================================================
-- 4. REVOKE_SESSION FUNCTION (logout)
-- ============================================================
CREATE OR REPLACE FUNCTION revoke_session(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_token_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RETURN; END IF;
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  UPDATE session_tokens SET revoked_at = now() WHERE token_hash = v_token_hash AND revoked_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION revoke_session(text) FROM anon;
GRANT EXECUTE ON FUNCTION revoke_session(text) TO authenticated;

-- ============================================================
-- 5. ADD verification_code and code_sent_at columns to registration_requests
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registration_requests' AND column_name = 'verification_code') THEN
    ALTER TABLE registration_requests ADD COLUMN verification_code text;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registration_requests' AND column_name = 'code_sent_at') THEN
    ALTER TABLE registration_requests ADD COLUMN code_sent_at timestamptz;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
