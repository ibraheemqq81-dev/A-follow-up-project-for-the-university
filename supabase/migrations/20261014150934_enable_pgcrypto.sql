/*
# Enable pgcrypto extension

Required for crypt() and gen_salt() functions used in SECURITY DEFINER
auth functions to verify bcrypt password hashes server-side.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;
