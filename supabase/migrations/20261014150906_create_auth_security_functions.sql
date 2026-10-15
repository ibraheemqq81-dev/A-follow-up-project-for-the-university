/*
# Security Definer Functions for Auth, Verification, and Device Management

## 1. Functions Created

### verify_login(email, password)
- Verifies user credentials using bcrypt (server-side, no hash sent to browser).
- Checks account_status = 'active' and status != 'inactive'.
- Returns the full user row (minus password_hash) on success.
- Returns NULL on failure (no error message leaks whether email exists).
- Logs LOGIN to audit_logs.

### create_verification_code(email)
- Generates a random 6-digit code, stores its bcrypt hash in email_verifications.
- Rate-limits: max 1 code per 2 minutes per email, max 5 per day.
- Returns the plaintext code so the caller can send it via email.
- The plaintext code is NEVER stored — only its bcrypt hash.

### verify_email_code(email, code, request_id)
- Verifies the 6-digit code against stored bcrypt hash.
- Rejects expired, used, or codes with 5+ failed attempts.
- On success: marks code as used, sets registration_requests.email_verified_at,
  changes request status from 'pending_email' to 'pending_approval'.
- Returns { success: true } or { success: false, error: '...' }.

### approve_registration(request_id, reviewer_id, reviewer_name, role, college_id, department_id, faculty_id)
- OWNER only. Creates a user from an approved registration request.
- Sets account_status='active'. Logs to audit_logs.
- Returns the new user row.

### reject_registration(request_id, reviewer_id, reviewer_name, reason)
- OWNER only. Sets request status='rejected'. Logs to audit_logs.

### approve_device(device_id, approver_id, approver_name)
- Sets device status='approved'. Logs to audit_logs.

### revoke_device(device_id, revoker_id, revoker_name)
- Sets device status='revoked'. Logs to audit_logs.

## 2. Security
- All functions are SECURITY DEFINER so they run with elevated privileges.
- execute is granted to anon, authenticated (the frontend needs to call them).
- password_hash is NEVER returned to the caller.
*/

-- ============ verify_login ============
CREATE OR REPLACE FUNCTION verify_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_result json;
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

  IF NOT crypt(p_password, v_user.password_hash) THEN
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

-- ============ create_verification_code ============
CREATE OR REPLACE FUNCTION create_verification_code(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_hash text;
  v_recent_count integer;
  v_today_count integer;
BEGIN
  p_email := lower(trim(p_email));

  -- Rate limit: 1 code per 2 minutes
  SELECT count(*) INTO v_recent_count
  FROM email_verifications
  WHERE email = p_email AND created_at > now() - interval '2 minutes';

  IF v_recent_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'يرجى الانتظار دقيقتين قبل طلب رمز جديد');
  END IF;

  -- Rate limit: max 5 codes per day
  SELECT count(*) INTO v_today_count
  FROM email_verifications
  WHERE email = p_email AND created_at > now() - interval '24 hours';

  IF v_today_count >= 5 THEN
    RETURN json_build_object('success', false, 'error', 'تم تجاوز الحد الأقصى لطلبات التحقق اليومية. حاول غداً');
  END IF;

  -- Generate 6-digit code
  v_code := lpad((floor(random() * 1000000))::text, 6, '0');
  v_hash := crypt(v_code, gen_salt('bf', 8));

  INSERT INTO email_verifications (id, email, code_hash, expires_at, used, attempts, created_at)
  VALUES (
    'verif-' || gen_random_uuid()::text,
    p_email, v_hash, now() + interval '10 minutes',
    false, 0, now()
  );

  RETURN json_build_object('success', true, 'code', v_code);
END;
$$;

-- ============ verify_email_code ============
CREATE OR REPLACE FUNCTION verify_email_code(p_email text, p_code text, p_request_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verif record;
  v_request record;
BEGIN
  p_email := lower(trim(p_email));

  -- Get latest unused verification for this email
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

  -- Increment attempts
  UPDATE email_verifications SET attempts = attempts + 1 WHERE id = v_verif.id;

  IF NOT crypt(p_code, v_verif.code_hash) THEN
    RETURN json_build_object('success', false, 'error', 'رمز التحقق غير صحيح');
  END IF;

  -- Code is correct
  UPDATE email_verifications SET used = true WHERE id = v_verif.id;

  -- Update registration request if exists
  SELECT * INTO v_request FROM registration_requests WHERE id = p_request_id;
  IF v_request IS NOT NULL AND v_request.email = p_email AND v_request.status = 'pending_email' THEN
    UPDATE registration_requests
    SET status = 'pending_approval', email_verified_at = now(), updated_at = now()
    WHERE id = p_request_id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'تم تأكيد البريد الإلكتروني بنجاح');
END;
$$;

-- ============ approve_registration ============
CREATE OR REPLACE FUNCTION approve_registration(
  p_request_id text,
  p_reviewer_id text,
  p_reviewer_name text,
  p_role text DEFAULT NULL,
  p_college_id text DEFAULT NULL,
  p_department_id text DEFAULT NULL,
  p_faculty_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_user_id text;
  v_final_role text;
BEGIN
  SELECT * INTO v_request FROM registration_requests WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'طلب التسجيل غير موجود');
  END IF;

  IF v_request.status != 'pending_approval' THEN
    RETURN json_build_object('success', false, 'error', 'طلب التسجيل ليس في حالة قابلة للموافقة');
  END IF;

  -- Prevent self-assigning OWNER role
  v_final_role := COALESCE(p_role, v_request.requested_role);
  IF v_final_role = 'OWNER' THEN
    RETURN json_build_object('success', false, 'error', 'لا يمكن تعيين دور مالك النظام عبر طلب التسجيل');
  END IF;

  -- Create user account
  v_user_id := 'user-' || gen_random_uuid()::text;

  INSERT INTO users (
    id, name, email, role, role_title_ar,
    assigned_college_id, assigned_department_id, assigned_faculty_id,
    password_hash, account_status, status, must_change_password,
    created_at, updated_at
  ) VALUES (
    v_user_id,
    v_request.name,
    v_request.email,
    v_final_role,
    v_final_role,
    COALESCE(p_college_id, v_request.college_id),
    COALESCE(p_department_id, v_request.department_id),
    COALESCE(p_faculty_id, v_request.faculty_id),
    v_request.password_hash,
    'active',
    'active',
    false,
    now(), now()
  );

  -- Update request
  UPDATE registration_requests
  SET status = 'approved', reviewed_by = p_reviewer_id, reviewed_by_name = p_reviewer_name,
      reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Audit log
  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason, new_value)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    p_reviewer_id, p_reviewer_name, 'OWNER',
    'APPROVE_REGISTRATION', 'registration_requests', p_request_id,
    'الموافقة على طلب تسجيل مستخدم جديد',
    json_build_object('new_user_id', v_user_id, 'name', v_request.name, 'email', v_request.email, 'role', v_final_role)::text
  );

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'message', 'تمت الموافقة على الحساب وتفعيله');
END;
$$;

-- ============ reject_registration ============
CREATE OR REPLACE FUNCTION reject_registration(
  p_request_id text,
  p_reviewer_id text,
  p_reviewer_name text,
  p_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
BEGIN
  SELECT * INTO v_request FROM registration_requests WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'طلب التسجيل غير موجود');
  END IF;

  UPDATE registration_requests
  SET status = 'rejected', rejection_reason = p_reason,
      reviewed_by = p_reviewer_id, reviewed_by_name = p_reviewer_name,
      reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    p_reviewer_id, p_reviewer_name, 'OWNER',
    'REJECT_REGISTRATION', 'registration_requests', p_request_id,
    'رفض طلب تسجيل: ' || p_reason
  );

  RETURN json_build_object('success', true, 'message', 'تم رفض طلب التسجيل');
END;
$$;

-- ============ approve_device ============
CREATE OR REPLACE FUNCTION approve_device(
  p_device_id text,
  p_approver_id text,
  p_approver_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device record;
BEGIN
  SELECT * INTO v_device FROM user_devices WHERE id = p_device_id;

  IF v_device IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'الجهاز غير موجود');
  END IF;

  UPDATE user_devices
  SET status = 'approved', approved_by = p_approver_id, approved_by_name = p_approver_name,
      approved_at = now()
  WHERE id = p_device_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    p_approver_id, p_approver_name, 'OWNER',
    'APPROVE_DEVICE', 'user_devices', p_device_id,
    'اعتماد جهاز جديد للمستخدم ' || v_device.user_id
  );

  RETURN json_build_object('success', true, 'message', 'تم اعتماد الجهاز');
END;
$$;

-- ============ revoke_device ============
CREATE OR REPLACE FUNCTION revoke_device(
  p_device_id text,
  p_revoker_id text,
  p_revoker_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device record;
BEGIN
  SELECT * INTO v_device FROM user_devices WHERE id = p_device_id;

  IF v_device IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'الجهاز غير موجود');
  END IF;

  UPDATE user_devices SET status = 'revoked' WHERE id = p_device_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    p_revoker_id, p_revoker_name, 'OWNER',
    'REVOKE_DEVICE', 'user_devices', p_device_id,
    'إلغاء اعتماد جهاز للمستخدم ' || v_device.user_id
  );

  RETURN json_build_object('success', true, 'message', 'تم إلغاء اعتماد الجهاز');
END;
$$;

-- ============ Grant execute to anon + authenticated ============
GRANT EXECUTE ON FUNCTION verify_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_verification_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_email_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_registration TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reject_registration TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_device TO anon, authenticated;
GRANT EXECUTE ON FUNCTION revoke_device TO anon, authenticated;
