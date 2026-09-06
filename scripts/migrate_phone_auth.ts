import { pool, query } from '../src/lib/db';

async function migrate() {
  console.log('--- Migrating Database for Phone Number Auth ---');
  try {
    // 1. Add phone column to users table
    await query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
    `);
    console.log('✅ Added phone column to users table');

    // 2. Add phone column to tenants table
    await query(`
      ALTER TABLE "tenants" 
      ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
    `);
    console.log('✅ Added phone column to tenants table');

    // 3. Create unique partial index on phone for users
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_idx" 
      ON "users"("phone") 
      WHERE "phone" IS NOT NULL;
    `);
    console.log('✅ Created unique index on users(phone)');

    // 4. Update demo user with a standard BD phone number
    await query(`
      UPDATE "users" 
      SET "phone" = '01700000000' 
      WHERE "email" = 'owner@fashionhub.com' AND ("phone" IS NULL OR "phone" = '');
    `);
    console.log('✅ Updated demo user phone');

    // 5. Verify users table columns
    const columnsRes = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users';
    `);
    console.log('Users Table Columns:');
    columnsRes.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

    console.log('--- Migration Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
