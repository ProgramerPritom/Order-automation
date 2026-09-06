import { pool, query, getClient } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function seedDemoUser() {
  console.log('--- Seeding Guaranteed Demo Store & User ---');
  const demoPhone = '01700000000';
  const demoEmail = 'demo@automa.store';
  const demoPassword = 'PritomSecure2026!';
  const demoStoreName = 'Aarong Fashion BD';

  try {
    const existing = await query(
      `SELECT id FROM users WHERE phone = $1 OR email = $2;`,
      [demoPhone, demoEmail]
    );

    const passwordHash = await hashPassword(demoPassword);

    if (existing.rows.length > 0) {
      await query(
        `UPDATE users 
         SET password_hash = $1, phone = $2, email = $3 
         WHERE id = $4;`,
        [passwordHash, demoPhone, demoEmail, existing.rows[0].id]
      );
      console.log('✅ Updated existing demo user password and phone');
    } else {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const tenantRes = await client.query(
          `INSERT INTO tenants (name, slug, email, phone, plan)
           VALUES ($1, 'demo-aarong-fashion', $2, $3, 'pro')
           RETURNING id, name;`,
          [demoStoreName, demoEmail, demoPhone]
        );
        const tenant = tenantRes.rows[0];

        await client.query(
          `INSERT INTO users (tenant_id, name, email, phone, password_hash, role)
           VALUES ($1, 'সাকিব আহমেদ', $2, $3, $4, 'admin');`,
          [tenant.id, demoEmail, demoPhone, passwordHash]
        );

        await client.query('COMMIT');
        console.log('✅ Created demo tenant and user successfully');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    console.log(`Demo Credentials:
- Phone: ${demoPhone}
- Email: ${demoEmail}
- Password: ${demoPassword}`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding demo user failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDemoUser();
