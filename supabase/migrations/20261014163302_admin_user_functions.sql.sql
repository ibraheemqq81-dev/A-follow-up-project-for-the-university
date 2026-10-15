/*
# Admin User Management Functions

## Summary
Since direct INSERT/UPDATE on users table is now restricted, these SECURITY DEFINER functions
allow OWNER to create, update, and disable users through validated server-side operations.

## New Functions
- admin_create_user: OWNER creates a new user with hashed password
- admin_update_user: OWNER updates user details (name, role, college, department, etc.)
- admin_disable_user: OWNER disables a user (sets status to inactive)
- admin_enable_user: OWNER re-enables a user
*/

CREATE OR REPLACE FUNCTION admin_create_user(
  p_session_token text,
  p_name text,
  p_email text,
  p_role text,
  p_password text,
  p_college_id text DEFAULT NULL,
  p_department_id text DEFAULT NULL,
  p_faculty_id text DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_max_devices integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_session json;
  v_user_id text;
  v_hash text;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  IF (v_session->>'role') != 'OWNER' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: يتطلب صلاحية مالك النظام');
  END IF;

  IF p_role NOT IN ('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY') THEN
    RETURN json_build_object('success', false, 'error', 'دور غير صالح');
  END IF;

  IF length(p_password) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  END IF;

  v_user_id := 'user-' || gen_random_uuid()::text;
  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO users (
    id, name, email, role, role_title_ar,
    assigned_college_id, assigned_department_id, assigned_faculty_id,
    employee_id, password_hash, account_status, status,
    max_devices, must_change_password, created_at, updated_at
  ) VALUES (
    v_user_id, p_name, lower(p_email), p_role, p_role,
    p_college_id, p_department_id, p_faculty_id,
    p_employee_id, v_hash, 'active', 'active',
    p_max_devices, true, now(), now()
  );

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    (v_session->>'user_id'), (v_session->>'name'), 'OWNER',
    'CREATE_USER', 'users', v_user_id,
    'إنشاء مستخدم جديد: ' || p_name || ' (' || p_role || ')'
  );

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'message', 'تم إنشاء المستخدم بنجاح');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_create_user(text, text, text, text, text, text, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, text, text, text, text, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION admin_update_user(
  p_session_token text,
  p_user_id text,
  p_name text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_college_id text DEFAULT NULL,
  p_department_id text DEFAULT NULL,
  p_faculty_id text DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_max_devices integer DEFAULT NULL,
  p_password text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_session json;
  v_hash text;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  IF (v_session->>'role') != 'OWNER' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: يتطلب صلاحية مالك النظام');
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY') THEN
    RETURN json_build_object('success', false, 'error', 'دور غير صالح');
  END IF;

  IF p_name IS NOT NULL THEN
    UPDATE users SET name = p_name, updated_at = now() WHERE id = p_user_id;
  END IF;
  IF p_role IS NOT NULL THEN
    UPDATE users SET role = p_role, role_title_ar = p_role, updated_at = now() WHERE id = p_user_id;
  END IF;
  IF p_college_id IS NOT NULL THEN
    UPDATE users SET assigned_college_id = p_college_id, updated_at = now() WHERE id = p_user_id;
  END IF;
  IF p_department_id IS NOT NULL THEN
    UPDATE users SET assigned_department_id = p_department_id, updated_at = now() WHERE id = p_user_id;
  END IF;
  IF p_faculty_id IS NOT NULL THEN
    UPDATE users SET assigned_faculty_id = p_faculty_id, updated_at = now() WHERE id = p_user_id;
  END IF;
  IF p_employee_id IS NOT NULL THEN
    UPDATE users SET employee_id = p_employee_id, updated_at = now() WHERE id = p_user_id;
  END IF;
  IF p_max_devices IS NOT NULL THEN
    UPDATE users SET max_devices = p_max_devices, updated_at = now() WHERE id = p_user_id;
  END IF;
  IF p_password IS NOT NULL AND length(p_password) >= 8 THEN
    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
    UPDATE users SET password_hash = v_hash, must_change_password = true, updated_at = now() WHERE id = p_user_id;
  END IF;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    (v_session->>'user_id'), (v_session->>'name'), 'OWNER',
    'UPDATE_USER', 'users', p_user_id,
    'تعديل بيانات مستخدم'
  );

  RETURN json_build_object('success', true, 'message', 'تم تحديث المستخدم بنجاح');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_user(text, text, text, text, text, text, text, text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_user(text, text, text, text, text, text, text, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_disable_user(
  p_session_token text,
  p_user_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session json;
  v_target record;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  IF (v_session->>'role') != 'OWNER' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: يتطلب صلاحية مالك النظام');
  END IF;

  SELECT * INTO v_target FROM users WHERE id = p_user_id;
  IF v_target IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  IF v_target.role = 'OWNER' THEN
    RETURN json_build_object('success', false, 'error', 'لا يمكن تعطيل مالك النظام');
  END IF;

  UPDATE users SET status = 'inactive', account_status = 'suspended', updated_at = now() WHERE id = p_user_id;

  -- Revoke all sessions for this user
  UPDATE session_tokens SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    (v_session->>'user_id'), (v_session->>'name'), 'OWNER',
    'DISABLE_USER', 'users', p_user_id,
    'تعطيل المستخدم: ' || v_target.name
  );

  RETURN json_build_object('success', true, 'message', 'تم تعطيل المستخدم');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_disable_user(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_disable_user(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_enable_user(
  p_session_token text,
  p_user_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session json;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  IF (v_session->>'role') != 'OWNER' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: يتطلب صلاحية مالك النظام');
  END IF;

  UPDATE users SET status = 'active', account_status = 'active', updated_at = now() WHERE id = p_user_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    (v_session->>'user_id'), (v_session->>'name'), 'OWNER',
    'ENABLE_USER', 'users', p_user_id,
    'إعادة تفعيل المستخدم'
  );

  RETURN json_build_object('success', true, 'message', 'تم إعادة تفعيل المستخدم');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_enable_user(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_enable_user(text, text) TO authenticated;
