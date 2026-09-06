import { query, getClient } from '../src/lib/db';

async function seedRichOrders() {
  console.log('🔄 Seeding rich orders with products, phone, and courier info...');
  const tRes = await query(`SELECT id FROM tenants WHERE slug = 'demo-aarong-fashion';`);
  if (!tRes.rows.length) {
    console.error('Demo tenant not found');
    process.exit(1);
  }
  const tenantId = tRes.rows[0].id;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get channels
    const chanRes = await client.query(`SELECT id, platform FROM channels WHERE tenant_id = $1;`, [tenantId]);
    const fbChannel = chanRes.rows.find(c => c.platform === 'facebook')?.id || null;
    const waChannel = chanRes.rows.find(c => c.platform === 'whatsapp')?.id || null;
    const igChannel = chanRes.rows.find(c => c.platform === 'instagram')?.id || null;

    const mockOrders = [
      {
        order_number: 'AS-BFECA7CC',
        customer_name: 'মোনে দাস (mone das)',
        customer_phone: '01730619196',
        delivery_address: 'পিরোজপুর রাম কৃষ্ণ মিশন এর সামনে',
        district: 'পিরোজপুর',
        postal_code: '৪২০০',
        delivery_fee: 100,
        subtotal: 790,
        total_amount: 890,
        status: 'pending',
        notes: 'Order via Messenger - সাইজ চেক করবেন',
        courier_name: 'পাঠাও',
        courier_status: 'পেন্ডিং',
        fraud_score: 100,
        capi_fired: true,
        estimated_profit: 320,
        channel_id: fbChannel,
        items: [
          { title: 'Baby Hip Seat Carrier (PINK)', variant: 'Pink', price: 790, quantity: 1 }
        ]
      },
      {
        order_number: 'AS-5B218BB9',
        customer_name: 'আরিফুল ইসলাম (Ariful Islam)',
        customer_phone: '01646630611',
        delivery_address: 'বাড়ি ১৪, রোড ৩, মধ্য বাড্ডা, ঢাকা',
        district: 'ঢাকা',
        postal_code: '১২১২',
        delivery_fee: 80,
        subtotal: 510,
        total_amount: 590,
        status: 'shipped',
        notes: 'কল করে কনফার্ম করা হয়েছে',
        courier_name: 'পাঠাও',
        courier_status: 'পাঠানো হয়েছে',
        fraud_score: 100,
        capi_fired: true,
        estimated_profit: 240,
        channel_id: waChannel,
        items: [
          { title: 'রেডি হিজাব ও খিমার সেট', variant: 'ব্ল্যাক', price: 510, quantity: 1 }
        ]
      },
      {
        order_number: 'AS-C62FB4C4',
        customer_name: 'মো: আলমগীর (MD Alamgir)',
        customer_phone: '01997186948',
        delivery_address: 'হোল্ডিং ৪৫, জিইসি মোড়, চট্টগ্রাম',
        district: 'চট্টগ্রাম',
        postal_code: '৪০০০',
        delivery_fee: 130,
        subtotal: 570,
        total_amount: 700,
        status: 'delivered',
        notes: 'ক্যাশ অন ডেলিভারি সম্পন্ন',
        courier_name: 'স্টেডফাস্ট',
        courier_status: 'ডেলিভারড',
        fraud_score: 95,
        capi_fired: true,
        estimated_profit: 280,
        channel_id: fbChannel,
        items: [
          { title: 'প্রিমিয়াম কাতান ওড়না', variant: 'নেভি ব্লু', price: 570, quantity: 1 }
        ]
      },
      {
        order_number: 'AS-9AEE7E38',
        customer_name: 'মো: মামুন (MD Mamun)',
        customer_phone: '01762002567',
        delivery_address: 'মেইন রোড, কদমতলী, সিলেট',
        district: 'সিলেট',
        postal_code: '৩১০০',
        delivery_fee: 150,
        subtotal: 440,
        total_amount: 590,
        status: 'cancelled',
        notes: 'কাস্টমার ফোন রিসিভ করেনি',
        courier_name: 'রেডএক্স',
        courier_status: 'ফেরত এসেছে',
        fraud_score: 100,
        capi_fired: false,
        estimated_profit: 0,
        channel_id: igChannel,
        items: [
          { title: 'সফট কটন প্রিন্টেড কুর্তি', variant: 'L', price: 440, quantity: 1 }
        ]
      },
      {
        order_number: 'AS-ABB58CE8',
        customer_name: 'মো: আল আমিন (MD AL)',
        customer_phone: '01918510613',
        delivery_address: 'থানা রোড, শিবগঞ্জ, বগুড়া',
        district: 'বগুড়া',
        postal_code: '৫৮০০',
        delivery_fee: 130,
        subtotal: 570,
        total_amount: 700,
        status: 'delivered',
        notes: 'রেগুলার কাস্টমার',
        courier_name: 'পাঠাও',
        courier_status: 'ডেলিভারড',
        fraud_score: 96,
        capi_fired: true,
        estimated_profit: 290,
        channel_id: waChannel,
        items: [
          { title: 'প্রিমিয়াম ব্ল্যাক পাঞ্জাবি', variant: 'XL', price: 570, quantity: 1 }
        ]
      },
      {
        order_number: 'AS-85086586',
        customer_name: 'মো: শরিফুল (Md. Shariful)',
        customer_phone: '01715673744',
        delivery_address: 'হাউস ১২, সেক্টর ৯, উত্তরা, ঢাকা',
        district: 'ঢাকা',
        postal_code: '১২৩০',
        delivery_fee: 80,
        subtotal: 620,
        total_amount: 700,
        status: 'delivered',
        notes: 'ক্যাশ অন ডেলিভারি',
        courier_name: 'পাঠাও',
        courier_status: 'ডেলিভারড',
        fraud_score: 88,
        capi_fired: true,
        estimated_profit: 310,
        channel_id: fbChannel,
        items: [
          { title: 'প্রিমিয়াম লেডিস হ্যান্ডব্যাগ', variant: 'মেরুন', price: 620, quantity: 1 }
        ]
      }
    ];

    for (const ord of mockOrders) {
      // Check if exists
      const existing = await client.query(
        `SELECT id FROM orders WHERE order_number = $1 AND tenant_id = $2;`,
        [ord.order_number, tenantId]
      );

      let orderId = '';
      if (existing.rows.length > 0) {
        orderId = existing.rows[0].id;
        await client.query(
          `UPDATE orders 
           SET customer_name = $1, customer_phone = $2, delivery_address = $3,
               district = $4, postal_code = $5, delivery_fee = $6, subtotal = $7,
               total_amount = $8, status = $9, notes = $10, courier_name = $11,
               courier_status = $12, fraud_score = $13, capi_fired = $14,
               estimated_profit = $15, channel_id = $16
           WHERE id = $17;`,
          [
            ord.customer_name, ord.customer_phone, ord.delivery_address,
            ord.district, ord.postal_code, ord.delivery_fee, ord.subtotal,
            ord.total_amount, ord.status, ord.notes, ord.courier_name,
            ord.courier_status, ord.fraud_score, ord.capi_fired,
            ord.estimated_profit, ord.channel_id, orderId
          ]
        );
      } else {
        const insRes = await client.query(
          `INSERT INTO orders 
           (tenant_id, order_number, customer_name, customer_phone, delivery_address,
            district, postal_code, delivery_fee, subtotal, total_amount, status,
            notes, courier_name, courier_status, fraud_score, capi_fired, estimated_profit, channel_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           RETURNING id;`,
          [
            tenantId, ord.order_number, ord.customer_name, ord.customer_phone,
            ord.delivery_address, ord.district, ord.postal_code, ord.delivery_fee,
            ord.subtotal, ord.total_amount, ord.status, ord.notes, ord.courier_name,
            ord.courier_status, ord.fraud_score, ord.capi_fired, ord.estimated_profit, ord.channel_id
          ]
        );
        orderId = insRes.rows[0].id;
      }

      // Re-insert line items
      await client.query(`DELETE FROM order_items WHERE order_id = $1;`, [orderId]);
      for (const item of ord.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_title, variant_title, unit_price, quantity, total_price)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [orderId, item.title, item.variant, item.price, item.quantity, item.price * item.quantity]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ Rich demo orders seeded successfully.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedRichOrders();
