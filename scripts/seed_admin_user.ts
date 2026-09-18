import { pool, query } from '../src/lib/db';
import { hashPassword, comparePassword } from '../src/lib/auth';
import * as dotenv from 'dotenv';

dotenv.config();

async function seedAdminUser() {
  console.log('🚀 Starting Super Admin Seeding...');

  const adminPhone = '01767026831';
  const rawPassword = 'admin123';
  const adminEmail = 'admin@automastore.ai';
  const adminName = 'System Super Admin';

  try {
    // 1. Ensure master admin tenant exists
    let adminTenantId: string;
    const tenantRes = await query(`SELECT id FROM tenants WHERE slug = 'platform-superadmin';`);
    if (tenantRes.rows.length === 0) {
      const newTenantRes = await query(`
        INSERT INTO tenants (name, slug, email, phone, plan, subscription_status, order_quota_monthly, max_channels)
        VALUES ('AutomaStore Master Admin', 'platform-superadmin', $1, $2, 'business', 'active', -1, 999)
        RETURNING id;
      `, [adminEmail, adminPhone]);
      adminTenantId = newTenantRes.rows[0].id;
      console.log('✅ Created master admin tenant:', adminTenantId);
    } else {
      adminTenantId = tenantRes.rows[0].id;
      console.log('✅ Master admin tenant exists:', adminTenantId);
    }

    // 2. Hash password
    const passwordHash = await hashPassword(rawPassword);

    // 3. Check if user with phone 01767026831 exists
    const cleanPhone = adminPhone.replace(/[\s\-()]/g, '').replace(/^(\+88|88)/, '');
    const userRes = await query(
      `SELECT id, name, email, phone, role FROM users WHERE phone = $1 OR email = $2;`,
      [cleanPhone, adminEmail]
    );

    let userId: string;
    if (userRes.rows.length > 0) {
      const existing = userRes.rows[0];
      await query(
        `UPDATE users 
         SET role = 'superadmin',
             password_hash = $1,
             phone = $2,
             tenant_id = $3
         WHERE id = $4;`,
        [passwordHash, cleanPhone, adminTenantId, existing.id]
      );
      userId = existing.id;
      console.log(`✅ Updated existing user (${existing.email || existing.phone}) to Super Admin.`);
    } else {
      const newUserRes = await query(
        `INSERT INTO users (tenant_id, name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'superadmin')
         RETURNING id;`,
        [adminTenantId, adminName, adminEmail, cleanPhone, passwordHash]
      );
      userId = newUserRes.rows[0].id;
      console.log('✅ Created brand new Super Admin user:', userId);
    }

    // 4. Verify password hashing works
    const checkUser = await query(`SELECT password_hash, role FROM users WHERE id = $1;`, [userId]);
    const isMatch = await comparePassword(rawPassword, checkUser.rows[0].password_hash);

    if (isMatch) {
      console.log(`
🎉 ========================================================
🎉 SUPER ADMIN CONFIGURATION SUCCESSFUL!
🎉 ========================================================
   Phone:    ${cleanPhone}
   Password: ${rawPassword}
   Role:     ${checkUser.rows[0].role}
   Tenant:   platform-superadmin (${adminTenantId})
========================================================
      `);
    } else {
      console.error('❌ Password verification failed!');
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during super admin seeding:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdminUser();
