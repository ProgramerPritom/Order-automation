import { pool, query } from '../src/lib/db';

async function checkDetails() {
  console.log('=== ORDERS ===');
  const orders = await query(`SELECT id, order_number, customer_name, customer_phone, total_amount, created_at FROM orders;`);
  console.log(orders.rows);

  console.log('\n=== PRODUCTS ===');
  const products = await query(`SELECT id, title, price, channel_id, created_at FROM products;`);
  console.log(products.rows);

  console.log('\n=== POST PRODUCT MAPPINGS ===');
  const mappings = await query(`SELECT * FROM post_product_mappings;`);
  console.log(mappings.rows);

  console.log('\n=== FACEBOOK POSTS (DUMMY VS REAL) ===');
  const dummyPosts = await query(`SELECT id, post_id, message FROM facebook_posts WHERE post_id NOT LIKE '1374129259109200%';`);
  console.log('Non-Facebook API synced posts count:', dummyPosts.rows.length);
  console.log(dummyPosts.rows);

  console.log('\n=== CONVERSATIONS ===');
  const convos = await query(`SELECT id, customer_name, customer_identifier, channel_id FROM conversations;`);
  console.log(convos.rows);

  await pool.end();
}

checkDetails().catch(console.error);
