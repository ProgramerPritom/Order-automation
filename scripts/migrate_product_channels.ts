import { pool, query } from '../src/lib/db';

async function migrateProductChannels() {
  console.log('🔄 Adding channel_id to products table for multi-page isolation...');
  try {
    // 1. Add channel_id column if not exists
    await query(`
      ALTER TABLE "products" 
      ADD COLUMN IF NOT EXISTS "channel_id" UUID REFERENCES "channels"("id") ON DELETE SET NULL;
    `);

    // 2. Add performance indexes for tenant and channel scoping
    await query(`
      CREATE INDEX IF NOT EXISTS idx_products_channel ON "products"("channel_id");
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_products_tenant_channel ON "products"("tenant_id", "channel_id");
    `);

    console.log('✅ products table successfully updated with channel_id column and indexes!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateProductChannels();
