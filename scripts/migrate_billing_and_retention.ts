import { query, pool } from '../src/lib/db';

async function migrate() {
  console.log('🚀 Running Billing, Invoices & Data Retention Migration...');

  try {
    // 1. Create Invoices Table
    await query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        plan VARCHAR(50) NOT NULL,
        status VARCHAR(30) DEFAULT 'unpaid',
        gateway VARCHAR(50) DEFAULT 'manual',
        transaction_id VARCHAR(100),
        payment_method VARCHAR(50),
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        due_date TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ invoices table created or verified.');

    // 2. Add Billing & Lifecycle Columns to Tenants Table
    await query(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS billing_gateway VARCHAR(50) DEFAULT 'aamarpay',
      ADD COLUMN IF NOT EXISTS customer_billing_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_billing_phone VARCHAR(50);
    `);
    console.log('✅ tenants table billing columns added.');

    // 3. Create Data Retention & Audit Log Table
    await query(`
      CREATE TABLE IF NOT EXISTS data_retention_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        retention_policy_days INT NOT NULL,
        messages_purged INT DEFAULT 0,
        conversations_purged INT DEFAULT 0,
        logs_purged INT DEFAULT 0,
        status VARCHAR(30) DEFAULT 'completed',
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ data_retention_logs table created or verified.');

    // 4. Create indexes for fast lookup and invoice queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
    `);
    console.log('✅ Performance indexes created.');

    console.log('🎉 Migration finished successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
