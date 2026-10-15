/*
# Fix: Grant EXECUTE to anon on session-protected functions

## Problem
The frontend uses the anon key (persistSession: false, custom auth), so all RPC
calls run as the anon role. Previous REVOKE FROM PUBLIC blocked the frontend
from calling session-protected functions like change_password, approve_registration, etc.

## Solution
Grant EXECUTE to anon on all functions that validate the caller via verify_session().
The security is enforced INSIDE each function by checking the session token —
not by the EXECUTE privilege. Functions without session validation (hash_password)
stay revoked from anon.

## Functions re-granted to anon (all validate session internally):
- admin_create_user, admin_update_user, admin_disable_user, admin_enable_user
- approve_registration, reject_registration
- approve_device, revoke_device
- change_password
- revoke_session

## Functions still revoked from anon (no session validation, internal only):
- create_session (called by verify_login internally)
- verify_session (called by other functions internally)
- hash_password (was callable by anyone — now locked down)
*/
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, text, text, text, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_user(text, text, text, text, text, text, text, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_disable_user(text, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_enable_user(text, text) TO anon;
GRANT EXECUTE ON FUNCTION approve_registration(text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION reject_registration(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION approve_device(text, text) TO anon;
GRANT EXECUTE ON FUNCTION revoke_device(text, text) TO anon;
GRANT EXECUTE ON FUNCTION change_password(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION revoke_session(text) TO anon;
