/*
# Fix crypt comparison logic

crypt(password, hash) returns a new hash string. To verify, compare
the returned hash with the stored hash using = operator, not as boolean.
*/

CREATE OR REPLACE FUNCTION verify_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user record;
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

  -- Login successful
  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    v_user.id, v_user.name, v_user.role, 'LOGIN', 'auth', v_user.id, 'تسجيل دخول ناجح'
  );

  v_result := json_build_object(
    'success', true,
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

CREATE OR REPLACE FUNCTION verify_email_code(p_email text, p_code text, p_request_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_verif record;
  v_request record;
  v_computed_hash text;
BEGIN
  p_email := lower(trim(p_email));

  SELECT * INTO v_verif
  FROM email_verifications
  WHERE email = p_email AND used = false
  ORDER BY created_at DESC LIMIT 1;

  IF v_verif IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'لا يوجد رمز تحقق صالح. يرجى طلب رمز جديد');
  END IF;

  IF v_verif.expires_at < now() THEN
    UPDATE email_verifications SET used = true WHERE id = v_verif.id;
    RETURN json_build_object('success', false, 'error', 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد');
  END IF;

  IF v_verif.attempts >= 5 THEN
    UPDATE email_verifications SET used = true WHERE id = v_verif.id;
    RETURN json_build_object('success', false, 'error', 'تم تجاوز الحد الأقصى لمحاولات التحقق. يرجى طلب رمز جديد');
  END IF;

  UPDATE email_verifications SET attempts = attempts + 1 WHERE id = v_verif.id;

  v_computed_hash := extensions.crypt(p_code, v_verif.code_hash);

  IF v_computed_hash != v_verif.code_hash THEN
    RETURN json_build_object('success', false, 'error', 'رمز التحقق غير صحيح');
  END IF;

  UPDATE email_verifications SET used = true WHERE id = v_verif.id;

  SELECT * INTO v_request FROM registration_requests WHERE id = p_request_id;
  IF v_request IS NOT NULL AND v_request.email = p_email AND v_request.status = 'pending_email' THEN
    UPDATE registration_requests
    SET status = 'pending_approval', email_verified_at = now(), updated_at = now()
    WHERE id = p_request_id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'تم تأكيد البريد الإلكتروني بنجاح');
END;
$$;

GRANT EXECUTE ON FUNCTION verify_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_email_code TO anon, authenticated;
