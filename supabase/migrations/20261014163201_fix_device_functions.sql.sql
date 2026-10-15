/*
# Fix approve_device and revoke_device: use session token auth
*/
DROP FUNCTION IF EXISTS approve_device(text, text, text);

CREATE FUNCTION approve_device(
  p_session_token text,
  p_device_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session json;
  v_approver_id text;
  v_approver_name text;
  v_device record;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  v_approver_id := v_session->>'user_id';
  v_approver_name := v_session->>'name';

  SELECT * INTO v_device FROM user_devices WHERE id = p_device_id;
  IF v_device IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'الجهاز غير موجود');
  END IF;

  UPDATE user_devices
  SET status = 'approved', approved_by = v_approver_id, approved_by_name = v_approver_name,
      approved_at = now()
  WHERE id = p_device_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    v_approver_id, v_approver_name, (v_session->>'role'),
    'APPROVE_DEVICE', 'user_devices', p_device_id,
    'اعتماد جهاز جديد للمستخدم ' || v_device.user_id
  );

  RETURN json_build_object('success', true, 'message', 'تم اعتماد الجهاز');
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_device(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION approve_device(text, text) TO authenticated;

DROP FUNCTION IF EXISTS revoke_device(text, text, text);

CREATE FUNCTION revoke_device(
  p_session_token text,
  p_device_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session json;
  v_revoker_id text;
  v_revoker_name text;
  v_device record;
BEGIN
  v_session := verify_session(p_session_token);
  IF (v_session->>'success') != 'true' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح: جلسة غير صالحة');
  END IF;

  v_revoker_id := v_session->>'user_id';
  v_revoker_name := v_session->>'name';

  SELECT * INTO v_device FROM user_devices WHERE id = p_device_id;
  IF v_device IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'الجهاز غير موجود');
  END IF;

  UPDATE user_devices SET status = 'revoked' WHERE id = p_device_id;

  INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, reason)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    v_revoker_id, v_revoker_name, (v_session->>'role'),
    'REVOKE_DEVICE', 'user_devices', p_device_id,
    'إلغاء اعتماد جهاز للمستخدم ' || v_device.user_id
  );

  RETURN json_build_object('success', true, 'message', 'تم إلغاء اعتماد الجهاز');
END;
$$;

REVOKE EXECUTE ON FUNCTION revoke_device(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION revoke_device(text, text) TO authenticated;
