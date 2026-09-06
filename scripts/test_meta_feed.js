const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const r = await pool.query("SELECT access_token FROM channels WHERE channel_identifier = '1374129259109200';");
  const token = r.rows[0]?.access_token;
  await pool.end();
  if (!token) {
    console.log('No token found');
    return;
  }

  console.log('Checking Permissions...');
  const permRes = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${token}`);
  const permData = await permRes.json();
  console.log('Permissions:', JSON.stringify(permData, null, 2));

  // Let's also debug token
  const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`);
  const debugData = await debugRes.json();
  console.log('Debug Token:', JSON.stringify(debugData, null, 2));
}

check().catch(console.error);
