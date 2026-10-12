import bcrypt from 'bcryptjs';
import { sqlite } from '../src/db/index.ts';

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@uomus.edu.iq';
  const name = process.env.ADMIN_NAME || 'مدير النظام (الجامعة)';
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345678';

  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    console.log(`[ADMIN] User with email ${email} already exists.`);
    return;
  }

  sqlite.prepare(`
    INSERT INTO users (
      id, uid, name, email, role, role_title_ar,
      must_change_password, status, token_version, password_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `user-admin-${Date.now()}`,
    `uid-admin-${Date.now()}`,
    name,
    email,
    'OWNER',
    'مالك النظام ومسؤول الجامعة (OWNER)',
    0,
    'active',
    0,
    hash,
    now,
    now
  );

  console.log(`[ADMIN] Successfully created OWNER account: ${email}`);
}

createAdmin().catch(console.error);
