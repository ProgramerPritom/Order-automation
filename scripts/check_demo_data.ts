import { pool, query, getClient } from '../src/lib/db';

async function checkAndSeed() {
  const tRes = await query(`SELECT id, name FROM tenants WHERE slug = 'demo-aarong-fashion';`);
  if (!tRes.rows.length) {
    console.log('No demo tenant found');
    process.exit(0);
  }
  const tenantId = tRes.rows[0].id;
  console.log('Demo Tenant ID:', tenantId);

  const prodCount = await query(`SELECT count(*) FROM products WHERE tenant_id = $1;`, [tenantId]);
  const orderCount = await query(`SELECT count(*) FROM orders WHERE tenant_id = $1;`, [tenantId]);
  const chanCount = await query(`SELECT count(*) FROM channels WHERE tenant_id = $1;`, [tenantId]);

  console.log(`Current Demo Data:
  - Products: ${prodCount.rows[0].count}
  - Orders: ${orderCount.rows[0].count}
  - Channels: ${chanCount.rows[0].count}`);

  if (parseInt(prodCount.rows[0].count) === 0) {
    console.log('Seeding demo products, variants, orders, and channels...');
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Channels
      await client.query(`
        INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, ai_active, webhook_verified)
        VALUES 
          ($1, 'facebook', 'fb_aarong_01', 'Aarong Fashion FB Page', true, true),
          ($1, 'whatsapp', 'wa_aarong_01', 'Aarong WhatsApp Business (+8801700000000)', true, true),
          ($1, 'instagram', 'ig_aarong_01', '@aarong_fashion_bd', false, true)
        ON CONFLICT ("platform", "channel_identifier") DO NOTHING;
      `, [tenantId]);

      // Products
      const p1 = await client.query(`
        INSERT INTO products (tenant_id, title, description, price, stock, category, is_active)
        VALUES ($1, 'প্রিমিয়াম ব্ল্যাক পাঞ্জাবি', '১০০% পিওর কটন ফ্যাব্রিক ও আধুনিক এমব্রয়ডারি ওয়ার্ক', 2150.00, 45, 'Panjabi', true)
        RETURNING id;
      `, [tenantId]);

      const p2 = await client.query(`
        INSERT INTO products (tenant_id, title, description, price, stock, category, is_active)
        VALUES ($1, 'এক্সক্লুসিভ জর্জেট কুর্তি', 'আরামদায়ক সামার কালেকশন ডিজিটাল প্রিন্ট', 1500.00, 28, 'Kurti', true)
        RETURNING id;
      `, [tenantId]);

      const p3 = await client.query(`
        INSERT INTO products (tenant_id, title, description, price, stock, category, is_active)
        VALUES ($1, 'ক্যাজুয়াল পোলো টি-শার্ট', 'কম্বড কটন ব্রিদেবল ফেব্রিক ব্লু কালার', 850.00, 60, 'Polo', true)
        RETURNING id;
      `, [tenantId]);

      // Variants
      await client.query(`
        INSERT INTO product_variants (product_id, tenant_id, name, sku, price_override, stock)
        VALUES 
          ($1, $4, 'Black / M', 'PANJABI-BLK-M', 2150.00, 15),
          ($1, $4, 'Black / L', 'PANJABI-BLK-L', 2150.00, 20),
          ($1, $4, 'Black / XL', 'PANJABI-BLK-XL', 2150.00, 10),
          ($2, $4, 'Printed / M', 'KURTI-GEO-M', 1500.00, 14),
          ($2, $4, 'Printed / L', 'KURTI-GEO-L', 1500.00, 14),
          ($3, $4, 'Navy Blue / L', 'POLO-BLU-L', 850.00, 30),
          ($3, $4, 'Navy Blue / XL', 'POLO-BLU-XL', 850.00, 30);
      `, [p1.rows[0].id, p2.rows[0].id, p3.rows[0].id, tenantId]);

      // Demo Orders
      await client.query(`
        INSERT INTO orders (tenant_id, order_number, customer_name, customer_phone, delivery_address, subtotal, delivery_fee, total_amount, status)
        VALUES 
          ($1, 'AS-8942', 'সোহেল রানা', '01712-345678', 'ধানমন্ডি, ঢাকা', 2150.00, 80.00, 2230.00, 'confirmed'),
          ($1, 'AS-8941', 'তানজিনা আক্তার', '01819-887766', 'জিইসি মোড়, চট্টগ্রাম', 1500.00, 150.00, 1650.00, 'pending'),
          ($1, 'AS-8940', 'রাকিবুল ইসলাম', '01922-334455', 'উত্তরা সেক্টর ৪, ঢাকা', 1700.00, 80.00, 1780.00, 'shipped'),
          ($1, 'AS-8939', 'নাজমুল করিম', '01755-112233', 'মিরপুর ১০, ঢাকা', 2150.00, 80.00, 2230.00, 'delivered');
      `, [tenantId]);

      await client.query('COMMIT');
      console.log('✅ Demo products, variants, channels, and orders seeded successfully!');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error seeding demo data:', e);
    } finally {
      client.release();
    }
  }

  process.exit(0);
}

checkAndSeed().catch(console.error);
