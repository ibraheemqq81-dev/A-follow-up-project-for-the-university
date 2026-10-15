/*
# Fix: Revoke EXECUTE from PUBLIC on all privileged SECURITY DEFINER functions
*/
REVOKE EXECUTE ON FUNCTION admin_create_user(text, text, text, text, text, text, text, text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_update_user(text, text, text, text, text, text, text, text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_disable_user(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_enable_user(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION approve_registration(text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reject_registration(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION approve_device(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION revoke_device(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION change_password(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION hash_password(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION revoke_session(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user(text, text, text, text, text, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_disable_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_enable_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_registration(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_registration(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION change_password(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_session(text) TO authenticated;
