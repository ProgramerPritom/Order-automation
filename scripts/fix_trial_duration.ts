import dotenv from 'dotenv';
dotenv.config();

import { query } from '../src/lib/db';

async function main() {
  console.log('🔄 Updating database to 7-day trial policy...');
  
  // Set default to 7 days
  await query(`ALTER TABLE tenants ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '7 days');`);
  
  // Update all existing trialing tenants to have at most 7 days from now
  await query(`UPDATE tenants SET trial_ends_at = NOW() + INTERVAL '7 days' WHERE subscription_status = 'trialing';`);
  
  const res = await query(`SELECT id, name, subscription_status, trial_ends_at FROM tenants;`);
  console.log('✅ Updated Tenants:', res.rows);
  process.exit(0);
}

main().catch(err => {
  console.error('Error fixing trial:', err);
  process.exit(1);
});
