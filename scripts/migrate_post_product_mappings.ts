import { pool, query } from '../src/lib/db';
import * as dotenv from 'dotenv';

dotenv.config();

async function migratePostProductMappings() {
  console.log('🔄 Provisioning post_product_mappings table...');
  try {
    // 1. Create post_product_mappings table
    await query(`
      CREATE TABLE IF NOT EXISTS "post_product_mappings" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "post_id" VARCHAR(255) NOT NULL,
        "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "is_primary" BOOLEAN DEFAULT TRUE,
        "confidence_score" NUMERIC(4, 2) DEFAULT 1.00,
        "mapping_source" VARCHAR(50) DEFAULT 'manual',
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_tenant_post_mapping UNIQUE ("tenant_id", "post_id")
      );
    `);

    // 2. Indexes for high-speed lookup during webhooks and queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_post_product_mappings_tenant_post 
        ON "post_product_mappings"("tenant_id", "post_id");
      CREATE INDEX IF NOT EXISTS idx_post_product_mappings_product 
        ON "post_product_mappings"("product_id");
    `);

    console.log('✅ post_product_mappings table and indexes successfully provisioned!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migratePostProductMappings();
