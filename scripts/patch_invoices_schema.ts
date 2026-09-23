import { query, pool } from '../src/lib/db';

async function patch() {
  console.log('🚀 Patching invoices schema for MFS sender number and verification...');
  try {
    await query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS sender_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);
    console.log('✅ invoices table columns patched.');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

patch();
