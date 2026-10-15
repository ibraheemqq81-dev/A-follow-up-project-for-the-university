/*
# Fix reject_registration: use session token auth
*/
DROP FUNCTION IF EXISTS reject_registration(text, text, text, text);

CREATE FUNCTION reject_registration(
  p_session_token text,
  p_request_id text,
  p_reason text
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

  UPDATE registration_requests
  SET status = 'rejected', rejection_reason = p_reason,
      reviewed_by = v_reviewer_id, reviewed_by_name = v_reviewer_name,
      reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    v_reviewer_id, v_reviewer_name, 'OWNER',
    'REJECT_REGISTRATION', 'registration_requests', p_request_id,
    'رفض طلب تسجيل: ' || COALESCE(p_reason, 'بدون سبب محدد')
  );

  RETURN json_build_object('success', true, 'message', 'تم رفض الطلب');
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_registration(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION reject_registration(text, text, text) TO authenticated;
