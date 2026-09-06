import { pool, query, getClient } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function setupSuperAdminAndShopAbout() {
  console.log('--- Setting up Super Admin & Shop About Field ---');

  // 1. Add about_shop column to tenants
  await query(`
    ALTER TABLE "tenants" 
    ADD COLUMN IF NOT EXISTS "about_shop" TEXT;
  `);
  console.log('✅ Added about_shop column to tenants');

  // 2. Ensure superadmin tenant exists
  let adminTenantId = '';
  const tenantRes = await query(`SELECT id FROM tenants WHERE slug = 'platform-superadmin';`);
  if (tenantRes.rows.length === 0) {
    const t = await query(`
      INSERT INTO tenants (name, slug, email, phone, plan, subscription_status, max_channels)
      VALUES ('AutomaStore Master Admin', 'platform-superadmin', 'admin@automastore.ai', '01999999999', 'business', 'active', 999)
      RETURNING id;
    `);
    adminTenantId = t.rows[0].id;
    console.log('✅ Created platform master tenant');
  } else {
    adminTenantId = tenantRes.rows[0].id;
  }

  // 3. Create or update Super Admin User
  const adminPassword = 'AdminMaster2026!';
  const passHash = await hashPassword(adminPassword);
  const existingAdmin = await query(`SELECT id FROM users WHERE email = 'admin@automastore.ai' OR phone = '01999999999';`);

  if (existingAdmin.rows.length === 0) {
    await query(`
      INSERT INTO users (tenant_id, name, email, phone, password_hash, role)
      VALUES ($1, 'Master Administrator', 'admin@automastore.ai', '01999999999', $2, 'superadmin');
    `, [adminTenantId, passHash]);
    console.log('✅ Created new Super Admin user');
  } else {
    await query(`
      UPDATE users 
      SET role = 'superadmin', password_hash = $1, tenant_id = $2
      WHERE id = $3;
    `, [passHash, adminTenantId, existingAdmin.rows[0].id]);
    console.log('✅ Updated existing user to Super Admin');
  }

  console.log(`
==================================================
👑 SUPER ADMIN CREDENTIALS:
- Phone: 01999999999
- Email: admin@automastore.ai
- Password: ${adminPassword}
- Role: superadmin
==================================================
  `);

  process.exit(0);
}

setupSuperAdminAndShopAbout().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
