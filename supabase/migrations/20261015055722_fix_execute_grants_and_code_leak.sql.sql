/*
# Fix EXECUTE grants + stop verification code leak

## Problem
1. `hash_password` and `verify_session` were revoked from anon/PUBLIC, but the
   frontend (anon key, no Supabase Auth session) needs to call them:
   - `hash_password` is called during registration (before login)
   - `verify_session` is called in `getMe()` to validate the stored session token
2. `create_verification_code` returns the plaintext code in its JSON response.
   The API layer no longer uses it, but the function itself still leaks the code
   to any caller. The edge function should generate the code and send it — the
   DB function should only store the hashed code.

## Changes
1. GRANT EXECUTE on `hash_password(text)` and `verify_session(text)` to anon.
   - `hash_password` is safe: it only hashes an input string, reads no tables.
   - `verify_session` is safe: it validates a token hash and returns user info
     (no password_hash, no sensitive data). The token hash is unguessable.
2. Drop and recreate `create_verification_code` without returning the code.
   Instead, it generates the code, hashes it, stores the hash, and returns only
   `{ success: true }`. The edge function will generate the code itself and
   call a new function `store_verification_code` to store the hash.
   
   Actually, simpler approach: keep `create_verification_code` generating the
   code internally but stop returning it. The edge function needs the code to
   send via email. So we split responsibilities:
   - `create_verification_code(p_email)` → generates, stores hash, returns `{success, email}` (no code)
   - Edge function generates its own code, calls `store_verification_code(p_email, p_code_hash)` 
   
   But the edge function can't hash the code (no bcrypt in Deno without a dep).
   Simplest secure approach: `create_verification_code` generates the code and
   stores its hash. The edge function calls the RPC, but since the edge function
   needs the actual code to email it, we need a different approach.

   Best approach: Move code generation to the edge function. The edge function
   generates a random 6-digit code, calls `store_verification_code(p_email, p_code_hash)`
   which stores the hash. The edge function already has the code to send via SMTP.
   The DB function hashes using crypt() which is available in plpgsql.

   So: create `store_verification_code(p_email text, p_code text)` that:
   - Applies rate limiting (same as before)
   - Hashes the code with crypt()
   - Stores it
   - Returns {success: true} or {success: false, error: ...}

3. Revoke EXECUTE on `create_verification_code` from anon (no longer needed by frontend).
   Grant EXECUTE on `store_verification_code` to anon (edge function calls it with anon key).
*/

-- 1. Grant EXECUTE to anon on hash_password and verify_session
GRANT EXECUTE ON FUNCTION hash_password(text) TO anon;
GRANT EXECUTE ON FUNCTION verify_session(text) TO anon;

-- 2. Create store_verification_code: edge function provides the code, DB hashes and stores it
CREATE OR REPLACE FUNCTION public.store_verification_code(p_email text, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text;
  v_recent_count integer;
  v_today_count integer;
BEGIN
  p_email := lower(trim(p_email));

  -- Rate limit: no more than 1 code per 2 minutes
  SELECT count(*) INTO v_recent_count
  FROM email_verifications
  WHERE email = p_email AND created_at > now() - interval '2 minutes';

  IF v_recent_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'يرجى الانتظار دقيقتين قبل طلب رمز جديد');
  END IF;

  -- Rate limit: max 5 codes per 24 hours
  SELECT count(*) INTO v_today_count
  FROM email_verifications
  WHERE email = p_email AND created_at > now() - interval '24 hours';

  IF v_today_count >= 5 THEN
    RETURN json_build_object('success', false, 'error', 'تم تجاوز الحد الأقصى لطلبات التحقق اليومية. حاول غداً');
  END IF;

  -- Hash the code with bcrypt
  v_hash := extensions.crypt(p_code, extensions.gen_salt('bf', 8));

  INSERT INTO email_verifications (id, email, code_hash, expires_at, used, attempts, created_at)
  VALUES (
    'verif-' || gen_random_uuid()::text,
    p_email, v_hash, now() + interval '10 minutes',
    false, 0, now()
  );

  RETURN json_build_object('success', true);
END;
$$;

-- 3. Revoke EXECUTE on create_verification_code from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION create_verification_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_verification_code(text) FROM anon;

-- 4. Grant EXECUTE on store_verification_code to anon (edge function calls it)
GRANT EXECUTE ON FUNCTION store_verification_code(text, text) TO anon;
