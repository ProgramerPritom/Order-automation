import { pool, query } from '../src/lib/db';

async function inspectData() {
  console.log('🔍 Inspecting database data...');
  const tables = ['tenants', 'users', 'channels', 'products', 'orders', 'order_items', 'facebook_posts', 'facebook_comments', 'conversations', 'messages', 'post_product_mappings'];

  for (const t of tables) {
    try {
      const res = await query(`SELECT count(*) FROM "${t}";`);
      console.log(` - ${t}: ${res.rows[0].count} rows`);
    } catch (e: any) {
      console.log(` - ${t}: (error: ${e.message})`);
    }
  }

  // Let's see some details
  const orders = await query(`SELECT id, order_number, customer_name, total_amount FROM orders LIMIT 10;`);
  console.log('\nOrders Sample:', orders.rows);

  const posts = await query(`SELECT id, post_id, message FROM facebook_posts LIMIT 10;`);
  console.log('\nPosts Sample:', posts.rows);

  const products = await query(`SELECT id, title, price FROM products LIMIT 10;`);
  console.log('\nProducts Sample:', products.rows);

  const channels = await query(`SELECT id, platform, channel_name, channel_identifier FROM channels;`);
  console.log('\nChannels Sample:', channels.rows);

  await pool.end();
}

inspectData().catch(console.error);
