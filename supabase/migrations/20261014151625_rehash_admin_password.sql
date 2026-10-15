/*
# Re-hash existing user passwords to pgcrypto-compatible bcrypt ($2a$)

The existing password_hash values were created by bcryptjs in the browser,
which produces $2b$ format. Postgres pgcrypto's crypt() function only
supports $2a$ format. This migration re-hashes the known admin password
to $2a$ format so verify_login() works server-side.

Note: We cannot re-hash unknown passwords. Only the default admin account
is re-hashed here. Any other existing users will need their password reset
by an admin.
*/

-- Re-hash the admin password using pgcrypto's gen_salt
UPDATE users
SET password_hash = extensions.crypt('Admin@12345678', extensions.gen_salt('bf', 10))
WHERE email = 'admin@uomus.edu.iq';
