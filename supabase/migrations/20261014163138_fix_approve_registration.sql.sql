/*
# Fix approve_registration: use session token auth
*/
DROP FUNCTION IF EXISTS approve_registration(text, text, text, text, text, text, text);

CREATE FUNCTION approve_registration(
  p_session_token text,
  p_request_id text,
  p_role text DEFAULT NULL,
  p_college_id text DEFAULT NULL,
  p_department_id text DEFAULT NULL,
  p_faculty_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session json;
  v_reviewer_id text;
  v_reviewer_name text;
  v_request record;
  v_user_id text;
  v_final_role text;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  IF (v_session->>'role') != 'OWNER' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: يتطلب صلاحية مالك النظام');
  END IF;

  v_reviewer_id := v_session->>'user_id';
  v_reviewer_name := v_session->>'name';

  SELECT * INTO v_request FROM registration_requests WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'طلب التسجيل غير موجود');
  END IF;

  IF v_request.status != 'pending_approval' THEN
    RETURN json_build_object('success', false, 'error', 'طلب التسجيل ليس في حالة قابلة للموافقة');
  END IF;

  v_final_role := COALESCE(p_role, v_request.requested_role);
  IF v_final_role NOT IN ('FACULTY', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR') THEN
    RETURN json_build_object('success', false, 'error', 'دور غير صالح');
  END IF;

  v_user_id := 'user-' || gen_random_uuid()::text;

  INSERT INTO users (
    id, name, email, role, role_title_ar,
    assigned_college_id, assigned_department_id, assigned_faculty_id,
    password_hash, account_status, status, must_change_password,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_request.name, v_request.email, v_final_role, v_final_role,
    COALESCE(p_college_id, v_request.college_id),
    COALESCE(p_department_id, v_request.department_id),
    COALESCE(p_faculty_id, v_request.faculty_id),
    v_request.password_hash, 'active', 'active', false, now(), now()
  );

  UPDATE registration_requests
  SET status = 'approved', reviewed_by = v_reviewer_id, reviewed_by_name = v_reviewer_name,
      reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason, new_value)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    v_reviewer_id, v_reviewer_name, 'OWNER',
    'APPROVE_REGISTRATION', 'registration_requests', p_request_id,
    'الموافقة على طلب تسجيل مستخدم جديد',
    json_build_object('new_user_id', v_user_id, 'name', v_request.name, 'email', v_request.email, 'role', v_final_role)::text
  );

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'message', 'تمت الموافقة على الحساب وتفعيله');
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_registration(text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION approve_registration(text, text, text, text, text, text) TO authenticated;
