/*
# Add password hashing and change_password functions

## Functions
### hash_password(plaintext) → text
- Returns a pgcrypto bcrypt hash ($2a$ format) for the given password.
- Used when creating users or changing passwords so all hashes are
  compatible with verify_login().

### change_password(p_user_id, p_current, p_new) → json
- Verifies the current password against the stored hash.
- Updates the password_hash and increments token_version.
- Logs to audit_logs.
*/

CREATE OR REPLACE FUNCTION hash_password(p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN extensions.crypt(p_password, extensions.gen_salt('bf', 10));
END;
$$;

CREATE OR REPLACE FUNCTION change_password(p_user_id text, p_current text, p_new text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user record;
  v_computed text;
BEGIN
  SELECT password_hash, name, role INTO v_user FROM users WHERE id = p_user_id;

  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'تعذر العثور على المستخدم');
  END IF;

  v_computed := extensions.crypt(p_current, v_user.password_hash);
  IF v_computed != v_user.password_hash THEN
    RETURN json_build_object('success', false, 'error', 'كلمة المرور الحالية غير صحيحة');
  END IF;

  UPDATE users
  SET password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
      must_change_password = false,
      token_version = token_version + 1,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    p_user_id, v_user.name, v_user.role,
    'PASSWORD_CHANGE', 'users', p_user_id, 'تغيير كلمة المرور'
  );

  RETURN json_build_object('success', true, 'message', 'تم تغيير كلمة المرور');
END;
$$;

GRANT EXECUTE ON FUNCTION hash_password TO anon, authenticated;
GRANT EXECUTE ON FUNCTION change_password TO anon, authenticated;
