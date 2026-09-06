const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTenant() {
  const r = await pool.query("SELECT id, name, about_shop, delivery_inside_dhaka, delivery_outside_dhaka, support_phone FROM tenants WHERE id = '58818813-da76-4450-a8f9-494fb46ca3d7';");
  console.log('Tenant:', r.rows[0]);
  const p = await pool.query("SELECT title, price, stock FROM products WHERE tenant_id = '58818813-da76-4450-a8f9-494fb46ca3d7';");
  console.log('Products:', p.rows);
  await pool.end();
}

checkTenant().catch(console.error);
