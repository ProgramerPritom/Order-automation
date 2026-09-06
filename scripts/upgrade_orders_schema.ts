import { query } from '../src/lib/db';

async function upgradeOrdersSchema() {
  console.log('🔄 Upgrading orders table schema...');
  try {
    await query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS district VARCHAR(100),
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100) DEFAULT 'পাঠাও',
      ADD COLUMN IF NOT EXISTS courier_status VARCHAR(100) DEFAULT 'পেন্ডিং',
      ADD COLUMN IF NOT EXISTS fraud_score INT DEFAULT 100,
      ADD COLUMN IF NOT EXISTS capi_fired BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS estimated_profit NUMERIC(10, 2) DEFAULT 350;
    `);

    console.log('✅ Orders table schema successfully upgraded with courier, fraud score, and notes fields.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Upgrade failed:', err);
    process.exit(1);
  }
}

upgradeOrdersSchema();
