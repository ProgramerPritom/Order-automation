const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'channels';");
  console.log(r.rows.map(x => x.column_name));
  await pool.end();
}
run().catch(console.error);
