import { pool, query } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrateAdminUsers() {
  console.log('🚀 Starting Admin Users Table Migration & Isolation...');

  try {
    // 1. Create dedicated admin_users table and detach refresh_tokens user_id foreign key constraint
    await query(`
      CREATE TABLE IF NOT EXISTS "admin_users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(20) UNIQUE NOT NULL,
        "email" VARCHAR(255) UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "role" VARCHAR(50) DEFAULT 'superadmin',
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_fkey";
    `);
    console.log('✅ Created or verified table "admin_users" and enabled refresh_tokens for admin users');

    // 2. Hash admin password
    const adminPhone = '01767026831';
    const adminPass = 'admin123';
    const passHash = await hashPassword(adminPass);

    // 3. Upsert super admin in admin_users
    await query(`
      INSERT INTO admin_users (name, phone, email, password_hash, role)
      VALUES ('System Super Admin', $1, 'admin@automastore.ai', $2, 'superadmin')
      ON CONFLICT (phone) DO UPDATE 
      SET password_hash = $2, role = 'superadmin', updated_at = NOW();
    `, [adminPhone, passHash]);
    console.log('✅ Super Admin registered in "admin_users" (Phone: 01767026831, Pass: admin123)');

    // 4. Free up 01767026831 and badruzzamanpritom@gmail.com from the merchant "users" table
    // Delete the previous superadmin entries from users table
    const deleteRes = await query(`
      DELETE FROM users 
      WHERE role = 'superadmin' OR phone = $1 OR email = 'badruzzamanpritom@gmail.com';
    `, [adminPhone]);
    console.log(`✅ Removed ${deleteRes.rowCount} previous superadmin records from regular merchant "users" table.`);
    console.log('🎉 Phone 01767026831 and email badruzzamanpritom@gmail.com are now 100% FREE for merchant store registration!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateAdminUsers();
