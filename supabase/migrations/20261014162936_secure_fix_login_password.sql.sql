/*
# Security Fix Part 2: Fix verify_login + change_password + hash_password grants

## Summary
1. verify_login now creates and returns a real session token
2. change_password is DROPped and recreated with session-token-based auth
3. hash_password EXECUTE revoked from anon

## Functions Modified
- verify_login: now calls create_session() and returns a real token
- change_password: dropped and recreated — first param is now p_session_token (was p_user_id)
- hash_password: EXECUTE revoked from anon (was callable by anyone)
*/

-- ============================================================
-- 1. FIX VERIFY_LOGIN: return a real session token
-- ============================================================
CREATE OR REPLACE FUNCTION verify_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user record;
  v_session json;
  v_result json;
  v_computed_hash text;
BEGIN
  SELECT * INTO v_user FROM users WHERE lower(email) = lower(p_email) LIMIT 1;

  IF v_user IS NULL OR v_user.password_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'بيانات الاعتماد غير صحيحة');
  END IF;

  IF v_user.status = 'inactive' THEN
    RETURN json_build_object('success', false, 'error', 'تم تعطيل هذا الحساب من قبل الإدارة');
  END IF;

  IF v_user.account_status = 'suspended' THEN
    RETURN json_build_object('success', false, 'error', 'تم إيقاف هذا الحساب مؤقتاً. يرجى مراجعة الإدارة');
  END IF;

  IF v_user.account_status = 'pending_approval' THEN
    RETURN json_build_object('success', false, 'error', 'حسابك بانتظار موافقة الإدارة. يرجى الانتظار');
  END IF;

  IF v_user.account_status = 'pending_email' THEN
    RETURN json_build_object('success', false, 'error', 'لم يتم تأكيد البريد الإلكتروني بعد');
  END IF;

  IF v_user.account_status = 'rejected' THEN
    RETURN json_build_object('success', false, 'error', 'تم رفض طلب التسجيل. يرجى مراجعة الإدارة');
  END IF;

  v_computed_hash := extensions.crypt(p_password, v_user.password_hash);

  IF v_computed_hash != v_user.password_hash THEN
    RETURN json_build_object('success', false, 'error', 'بيانات الاعتماد غير صحيحة');
  END IF;

  v_session := create_session(v_user.id);

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    v_user.id, v_user.name, v_user.role, 'LOGIN', 'auth', v_user.id, 'تسجيل دخول ناجح'
  );

  v_result := json_build_object(
    'success', true,
    'token', (v_session->>'token'),
    'user', json_build_object(
      'id', v_user.id,
      'name', v_user.name,
      'email', v_user.email,
      'role', v_user.role,
      'roleTitleAr', v_user.role_title_ar,
      'assignedCollegeId', v_user.assigned_college_id,
      'assignedDepartmentId', v_user.assigned_department_id,
      'assignedFacultyId', v_user.assigned_faculty_id,
      'avatar', v_user.avatar,
      'status', v_user.status,
      'mustChangePassword', v_user.must_change_password,
      'accountStatus', v_user.account_status,
      'maxDevices', v_user.max_devices,
      'tokenVersion', v_user.token_version,
      'createdAt', v_user.created_at
    )
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 2. DROP AND RECREATE change_password with session-token auth
-- ============================================================
DROP FUNCTION IF EXISTS change_password(text, text, text);

CREATE FUNCTION change_password(
  p_session_token text,
  p_current text,
  p_new text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_session json;
  v_user record;
  v_computed_hash text;
  v_new_hash text;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  SELECT * INTO v_user FROM users WHERE id = (v_session->>'user_id') LIMIT 1;

  IF v_user IS NULL OR v_user.password_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  v_computed_hash := extensions.crypt(p_current, v_user.password_hash);
  IF v_computed_hash != v_user.password_hash THEN
    RETURN json_build_object('success', false, 'error', 'كلمة المرور الحالية غير صحيحة');
  END IF;

  IF length(p_new) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
  END IF;

  v_new_hash := extensions.crypt(p_new, extensions.gen_salt('bf'));

  UPDATE users SET password_hash = v_new_hash, must_change_password = false, updated_at = now()
  WHERE id = v_user.id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    v_user.id, v_user.name, v_user.role,
    'CHANGE_PASSWORD', 'users', v_user.id, 'تغيير كلمة المرور'
  );

  RETURN json_build_object('success', true, 'message', 'تم تغيير كلمة المرور بنجاح');
END;
$$;

REVOKE EXECUTE ON FUNCTION change_password(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION change_password(text, text, text) TO authenticated;

-- ============================================================
-- 3. REVOKE EXECUTE ON hash_password FROM ANON
-- ============================================================
REVOKE EXECUTE ON FUNCTION hash_password(text) FROM anon;
GRANT EXECUTE ON FUNCTION hash_password(text) TO authenticated;
