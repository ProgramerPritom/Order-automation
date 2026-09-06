import { pool, query } from '../src/lib/db';

async function migrateSubscriptions() {
  console.log('--- Migrating Database for 14-Day Trial & Monthly Subscriptions ---');
  try {
    // 1. Add subscription columns to tenants table
    await query(`
      ALTER TABLE "tenants" 
      ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(50) DEFAULT 'trialing',
      ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
      ADD COLUMN IF NOT EXISTS "current_period_ends_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "order_quota_monthly" INT DEFAULT 500,
      ADD COLUMN IF NOT EXISTS "orders_count_current_month" INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "max_channels" INT DEFAULT 1;
    `);
    console.log('✅ Added subscription columns to tenants table');

    // 2. Set existing demo tenant to active 'pro' plan with 30 days validity
    await query(`
      UPDATE "tenants" 
      SET 
        "plan" = 'pro',
        "subscription_status" = 'active',
        "current_period_ends_at" = NOW() + INTERVAL '30 days',
        "order_quota_monthly" = -1,
        "max_channels" = 3
      WHERE "slug" = 'demo-aarong-fashion';
    `);
    console.log('✅ Updated demo tenant to Active Pro Plan (30 days validity)');

    // 3. Verify columns
    const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' 
      ORDER BY ordinal_position;
    `);
    console.log('Updated Tenants Columns:');
    res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

    console.log('--- Migration Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateSubscriptions();
