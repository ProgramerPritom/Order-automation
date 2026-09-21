import { pool, query } from '../src/lib/db';

async function cleanupDummyData() {
  console.log('🧹 Starting cleanup of dummy data for production...');

  // 1. Check & delete dummy comments associated with dummy posts
  const dummyComments = await query(`
    DELETE FROM facebook_comments 
    WHERE post_id LIKE 'post_%' OR comment_id LIKE 'test_%' OR comment_id LIKE 'comm_%'
    RETURNING id, comment_id;
  `);
  console.log(`✅ Deleted ${dummyComments.rowCount} dummy comments.`);

  // 2. Delete dummy facebook posts
  const dummyPosts = await query(`
    DELETE FROM facebook_posts 
    WHERE post_id LIKE 'post_%'
    RETURNING id, post_id;
  `);
  console.log(`✅ Deleted ${dummyPosts.rowCount} dummy posts.`);

  // 3. Delete dummy orders and order_items
  const dummyOrderItems = await query(`
    DELETE FROM order_items 
    WHERE order_id IN (
      SELECT id FROM orders WHERE order_number LIKE 'KS-%' OR customer_name = 'তানভীর হাসান'
    )
    RETURNING id;
  `);
  console.log(`✅ Deleted ${dummyOrderItems.rowCount} dummy order items.`);

  const dummyOrders = await query(`
    DELETE FROM orders 
    WHERE order_number LIKE 'KS-%' OR customer_name = 'তানভীর হাসান'
    RETURNING id, order_number;
  `);
  console.log(`✅ Deleted ${dummyOrders.rowCount} dummy orders.`);

  // 4. Delete dummy products
  const dummyProducts = await query(`
    DELETE FROM products 
    WHERE title LIKE 'Montessori Sensory Puzzle 17899%'
    RETURNING id, title;
  `);
  console.log(`✅ Deleted ${dummyProducts.rowCount} dummy products.`);

  // 5. Delete test conversations & messages
  const dummyMessages = await query(`
    DELETE FROM messages 
    WHERE conversation_id IN (
      SELECT id FROM conversations 
      WHERE customer_identifier LIKE 'fb_customer_17899%' OR customer_name = 'তানভীর হাসান'
    )
    RETURNING id;
  `);
  console.log(`✅ Deleted ${dummyMessages.rowCount} dummy messages.`);

  const dummyConversations = await query(`
    DELETE FROM conversations 
    WHERE customer_identifier LIKE 'fb_customer_17899%' OR customer_name = 'তানভীর হাসান'
    RETURNING id, customer_identifier;
  `);
  console.log(`✅ Deleted ${dummyConversations.rowCount} dummy conversations.`);

  // Final summary verification
  console.log('\n--- VERIFICATION AFTER CLEANUP ---');
  const counts = {
    products: (await query('SELECT count(*) FROM products')).rows[0].count,
    orders: (await query('SELECT count(*) FROM orders')).rows[0].count,
    facebook_posts: (await query('SELECT count(*) FROM facebook_posts')).rows[0].count,
    facebook_comments: (await query('SELECT count(*) FROM facebook_comments')).rows[0].count,
    channels: (await query('SELECT count(*) FROM channels')).rows[0].count,
    tenants: (await query('SELECT count(*) FROM tenants')).rows[0].count,
  };
  console.log(counts);

  await pool.end();
}

cleanupDummyData().catch(console.error);
