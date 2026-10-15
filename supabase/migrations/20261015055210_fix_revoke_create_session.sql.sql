/*
# Fix: Revoke EXECUTE on create_session from all roles

## Problem
create_session(p_user_id) was still callable by anon despite a previous REVOKE.
This is because Supabase's role hierarchy grants anon access through inherited roles.
Since create_session is only called internally by verify_login (SECURITY DEFINER),
it does not need EXECUTE grants on any role — SECURITY DEFINER functions run as their owner.

## Fix
Revoke EXECUTE from anon, authenticated, and PUBLIC to fully lock down create_session.
Only the function owner (postgres) can call it, which is what SECURITY DEFINER uses.
*/
REVOKE EXECUTE ON FUNCTION create_session(text) FROM anon;
REVOKE EXECUTE ON FUNCTION create_session(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION create_session(text) FROM PUBLIC;

-- Also ensure verify_session is not directly exploitable — it's safe since it only
-- returns user info for a valid token, but let's tighten it too
REVOKE EXECUTE ON FUNCTION verify_session(text) FROM anon;
REVOKE EXECUTE ON FUNCTION verify_session(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION verify_session(text) FROM PUBLIC;

-- verify_session is called internally by other SECURITY DEFINER functions,
-- so it doesn't need direct EXECUTE grants either.
