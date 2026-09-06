const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query("ALTER TABLE public.refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;");
  console.log('Added revoked_at column successfully.');
  await pool.end();
}

run().catch(console.error);
