import { query, getClient } from '../db';
import { saasRedis } from '../redis';

export interface SkillResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Skill: Lookup order by order number or customer phone
 */
export async function lookupOrderSkill(tenantId: string, searchKey: string): Promise<SkillResult> {
  const cleanKey = searchKey.replace(/#/g, '').trim();

  // Try matching order_number (e.g. KS-123456 or 123456)
  let orderRes = await query(
    `SELECT o.*, 
            json_agg(json_build_object('product_title', oi.product_title, 'quantity', oi.quantity, 'unit_price', oi.unit_price)) as items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.tenant_id = $1 AND (o.order_number ILIKE $2 OR o.order_number ILIKE $3 OR o.customer_phone = $4)
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 1;`,
    [tenantId, `%${cleanKey}%`, `KS-${cleanKey}%`, cleanKey]
  );

  if (orderRes.rows.length === 0) {
    return {
      success: false,
      message: `⚠️ "${cleanKey}" দিয়ে কোনো অর্ডার খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক অর্ডার নম্বর (#KS-XXXXXX) বা ফোন নম্বর চেক করুন।`,
    };
  }

  const o = orderRes.rows[0];
  const itemsText = (o.items || [])
    .filter((it: any) => it && it.product_title)
    .map((it: any) => `• ${it.product_title} × ${it.quantity} (৳${it.unit_price})`)
    .join('\n');

  let text = `📦 *অর্ডার বিবরণ — #${o.order_number}*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👤 গ্রাহক: *${o.customer_name}*\n`;
  text += `📞 মোবাইল: *${o.customer_phone}*\n`;
  text += `📍 ঠিকানা: ${o.delivery_address} (${o.delivery_city || 'ঢাকা'})\n`;
  text += `💰 মোট বিল: *৳${o.total_amount}* (ডেলিভারি চার্জ: ৳${o.delivery_fee})\n`;
  text += `📊 বর্তমান স্ট্যাটাস: *${o.status.toUpperCase()}*\n`;
  text += `🚚 কুরিয়ার: ${o.courier_name || 'Steadfast'} (${o.courier_status || 'Pending'})\n`;
  if (itemsText) {
    text += `\n🛒 *পণ্য তালিকা:*\n${itemsText}\n`;
  }
  text += `\n💡 _অর্ডারটি পরিচালনা করতে লিখুন:_ \n• "*কনফার্ম #${o.order_number}*"\n• "*কুরিয়ার #${o.order_number}*"\n• "*বাতিল #${o.order_number}*"`;

  return {
    success: true,
    message: text,
    data: o,
  };
}

/**
 * Skill: Confirm a pending order
 */
export async function confirmOrderSkill(tenantId: string, orderNumber: string): Promise<SkillResult> {
  const cleanOrderNo = orderNumber.replace(/#/g, '').trim();

  const updateRes = await query(
    `UPDATE orders 
     SET status = 'confirmed', updated_at = NOW()
     WHERE tenant_id = $1 AND (order_number ILIKE $2 OR order_number ILIKE $3)
     RETURNING id, order_number, customer_name, customer_phone, total_amount, status;`,
    [tenantId, `%${cleanOrderNo}%`, `KS-${cleanOrderNo}%`]
  );

  if (updateRes.rows.length === 0) {
    return {
      success: false,
      message: `⚠️ #${cleanOrderNo} নম্বরের কোনো অর্ডার পাওয়া যায়নি।`,
    };
  }

  const o = updateRes.rows[0];
  return {
    success: true,
    message: `✅ *অর্ডার সফলভাবে কনফার্ম করা হয়েছে!*\n━━━━━━━━━━━━━━━━━━━━\n📦 অর্ডার নম্বর: *#${o.order_number}*\n👤 গ্রাহক: *${o.customer_name}* (${o.customer_phone})\n💰 মোট বিল: *৳${o.total_amount}*\n📊 নতুন স্ট্যাটাস: *CONFIRMED*\n\n💡 পণ্যটি কুরিয়ারে বুকিং দিতে লিখুন: "*কুরিয়ার #${o.order_number}*"`,
    data: o,
  };
}

/**
 * Skill: Mark order as shipped to courier
 */
export async function shipOrderSkill(tenantId: string, orderNumber: string, courier = 'Steadfast Courier'): Promise<SkillResult> {
  const cleanOrderNo = orderNumber.replace(/#/g, '').trim();

  const updateRes = await query(
    `UPDATE orders 
     SET status = 'shipped', courier_name = $1, courier_status = 'in_transit', updated_at = NOW()
     WHERE tenant_id = $2 AND (order_number ILIKE $3 OR order_number ILIKE $4)
     RETURNING id, order_number, customer_name, customer_phone, total_amount, courier_name, status;`,
    [courier, tenantId, `%${cleanOrderNo}%`, `KS-${cleanOrderNo}%`]
  );

  if (updateRes.rows.length === 0) {
    return {
      success: false,
      message: `⚠️ #${cleanOrderNo} নম্বরের কোনো অর্ডার পাওয়া যায়নি।`,
    };
  }

  const o = updateRes.rows[0];
  return {
    success: true,
    message: `🚚 *অর্ডারটি কুরিয়ারে পাঠানো হয়েছে!*\n━━━━━━━━━━━━━━━━━━━━\n📦 অর্ডার নম্বর: *#${o.order_number}*\n👤 গ্রাহক: *${o.customer_name}*\n🏢 কুরিয়ার: *${o.courier_name}*\n📊 নতুন স্ট্যাটাস: *SHIPPED (In-Transit)*\n\n💡 ডেলিভারি সম্পন্ন হলে লিখুন: "*ডেলিভারড #${o.order_number}*"`,
    data: o,
  };
}

/**
 * Skill: Mark order as delivered
 */
export async function deliverOrderSkill(tenantId: string, orderNumber: string): Promise<SkillResult> {
  const cleanOrderNo = orderNumber.replace(/#/g, '').trim();

  const updateRes = await query(
    `UPDATE orders 
     SET status = 'delivered', courier_status = 'delivered', updated_at = NOW()
     WHERE tenant_id = $1 AND (order_number ILIKE $2 OR order_number ILIKE $3)
     RETURNING id, order_number, customer_name, total_amount, estimated_profit;`,
    [tenantId, `%${cleanOrderNo}%`, `KS-${cleanOrderNo}%`]
  );

  if (updateRes.rows.length === 0) {
    return {
      success: false,
      message: `⚠️ #${cleanOrderNo} নম্বরের কোনো অর্ডার পাওয়া যায়নি।`,
    };
  }

  const o = updateRes.rows[0];
  return {
    success: true,
    message: `🎉 *অর্ডার ডেলিভারি সম্পন্ন হয়েছে!*\n━━━━━━━━━━━━━━━━━━━━\n📦 অর্ডার নম্বর: *#${o.order_number}*\n👤 গ্রাহক: *${o.customer_name}*\n💰 সংগৃহীত ক্যাশ: *৳${o.total_amount}*\n💎 অর্জিত প্রফিট: *৳${o.estimated_profit || 0}*\n📊 নতুন স্ট্যাটাস: *DELIVERED*`,
    data: o,
  };
}

/**
 * Skill: Cancel an order and restore stock atomically
 */
export async function cancelOrderSkill(tenantId: string, orderNumber: string, reason = 'Cancelled by Merchant over WhatsApp'): Promise<SkillResult> {
  const cleanOrderNo = orderNumber.replace(/#/g, '').trim();
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Fetch order details
    const orderRes = await client.query(
      `SELECT id, order_number, status, customer_name 
       FROM orders 
       WHERE tenant_id = $1 AND (order_number ILIKE $2 OR order_number ILIKE $3)
       LIMIT 1;`,
      [tenantId, `%${cleanOrderNo}%`, `KS-${cleanOrderNo}%`]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `⚠️ #${cleanOrderNo} নম্বরের কোনো অর্ডার পাওয়া যায়নি।`,
      };
    }

    const order = orderRes.rows[0];

    // 2. Fetch order items to restore inventory
    const itemsRes = await client.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = $1;`,
      [order.id]
    );

    for (const item of itemsRes.rows) {
      if (item.product_id) {
        await client.query(
          `UPDATE products SET stock = stock + $1, updated_at = NOW() 
           WHERE id = $2 AND tenant_id = $3;`,
          [item.quantity, item.product_id, tenantId]
        );
      }
    }

    // 3. Mark order as cancelled
    await client.query(
      `UPDATE orders 
       SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ' [', $1::text, ']'), updated_at = NOW()
       WHERE id = $2;`,
      [reason, order.id]
    );

    await client.query('COMMIT');
    await saasRedis.del(`catalog:${tenantId}`);

    return {
      success: true,
      message: `🚫 *অর্ডারটি সফলভাবে বাতিল করা হয়েছে!*\n━━━━━━━━━━━━━━━━━━━━\n📦 অর্ডার নম্বর: *#${order.order_number}*\n👤 গ্রাহক: *${order.customer_name}*\n🔄 পণ্য স্টক: *পুনরায় স্টকে ফেরত যোগ করা হয়েছে*\n📊 নতুন স্ট্যাটাস: *CANCELLED*`,
      data: order,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error cancelling order via skill:', err);
    return {
      success: false,
      message: `অর্ডার বাতিল করতে সমস্যা হয়েছে: ${err.message}`,
    };
  } finally {
    client.release();
  }
}

/**
 * Skill: Update product inventory stock
 */
export async function updateStockSkill(
  tenantId: string,
  productQuery: string,
  newStock: number,
  isDelta = false
): Promise<SkillResult> {
  const cleanQuery = productQuery.trim();

  // Find product by title or SKU
  const prodRes = await query(
    `SELECT id, title, price, stock, sku 
     FROM products 
     WHERE tenant_id = $1 AND (title ILIKE $2 OR sku ILIKE $2)
     ORDER BY updated_at DESC
     LIMIT 1;`,
    [tenantId, `%${cleanQuery}%`]
  );

  if (prodRes.rows.length === 0) {
    return {
      success: false,
      message: `⚠️ "${cleanQuery}" নামের কোনো পণ্য খুঁজে পাওয়া যায়নি। সঠিক নাম বা SKU দিয়ে চেষ্টা করুন।`,
    };
  }

  const prod = prodRes.rows[0];
  const finalStock = isDelta ? Math.max(0, Number(prod.stock) + newStock) : Math.max(0, newStock);

  await query(
    `UPDATE products 
     SET stock = $1, updated_at = NOW() 
     WHERE id = $2 AND tenant_id = $3;`,
    [finalStock, prod.id, tenantId]
  );

  await saasRedis.del(`catalog:${tenantId}`);

  return {
    success: true,
    message: `📊 *পণ্য স্টক সফলভাবে আপডেট করা হয়েছে!*\n━━━━━━━━━━━━━━━━━━━━\n🛒 পণ্য: *${prod.title}*\n📦 পূর্বের স্টক: ${prod.stock} পিস\n📈 বর্তমান লাইভ স্টক: *${finalStock} পিস*\n💰 নির্ধারিত মূল্য: ৳${prod.price}\n\n💡 ক্যাটালগ ও এআই নলেজ বেসে নতুন স্টক সিঙ্ক করা হয়েছে।`,
    data: { id: prod.id, title: prod.title, oldStock: prod.stock, newStock: finalStock },
  };
}

/**
 * Skill: Toggle AI automation for channels (Facebook / WhatsApp)
 */
export async function toggleChannelAiSkill(
  tenantId: string,
  platform: 'facebook' | 'whatsapp' | 'all',
  enable: boolean
): Promise<SkillResult> {
  let updateSql = `UPDATE channels SET ai_active = $1, updated_at = NOW() WHERE tenant_id = $2`;
  const params: any[] = [enable, tenantId];

  if (platform !== 'all') {
    updateSql += ` AND platform = $3`;
    params.push(platform);
  }
  updateSql += ` RETURNING id, platform, channel_name, ai_active;`;

  const res = await query(updateSql, params);

  if (res.rows.length === 0) {
    return {
      success: false,
      message: `⚠️ কোনো সংযুক্ত চ্যানেল পাওয়া যায়নি। ড্যাশবোর্ডের Channels ট্যাব থেকে চ্যানেল যুক্ত করুন।`,
    };
  }

  const statusText = enable ? '🟢 চালু (Active)' : '🔴 বন্ধ (Paused)';
  const channelList = res.rows.map((c: any) => `• ${c.channel_name || c.platform}: ${statusText}`).join('\n');

  return {
    success: true,
    message: `🤖 *এআই অটোমেশন স্ট্যাটাস আপডেট!*\n━━━━━━━━━━━━━━━━━━━━\n${channelList}\n\n💡 ${enable ? 'এখন থেকে কাস্টমারদের প্রশ্নের উত্তর এআই দিয়ে দেবে।' : 'এআই স্বয়ংক্রিয় রিপ্লাই সাময়িকভাবে বন্ধ রাখা হয়েছে। আপনি নিজে রিপ্লাই দিতে পারেন।'}`,
    data: res.rows,
  };
}

/**
 * Skill: Mute AI for a specific customer (Human Takeover)
 */
export async function takeoverCustomerSkill(
  tenantId: string,
  phoneOrId: string,
  durationHours = 24
): Promise<SkillResult> {
  const cleanPhone = phoneOrId.replace(/\D/g, '');

  const convRes = await query(
    `SELECT id, customer_name, customer_phone, customer_identifier 
     FROM conversations 
     WHERE tenant_id = $1 AND (
       customer_phone LIKE $2 OR customer_identifier LIKE $2 OR RIGHT(customer_identifier, 10) = RIGHT($3, 10)
     )
     ORDER BY updated_at DESC LIMIT 1;`,
    [tenantId, `%${cleanPhone}%`, cleanPhone]
  );

  if (convRes.rows.length === 0) {
    return {
      success: false,
      message: `⚠️ ${phoneOrId} নম্বরের কোনো কাস্টমার চ্যাট পাওয়া যায়নি।`,
    };
  }

  const conv = convRes.rows[0];
  await query(
    `UPDATE conversations 
     SET ai_muted_until = NOW() + ($1 || ' hours')::INTERVAL, updated_at = NOW() 
     WHERE id = $2;`,
    [durationHours, conv.id]
  );

  return {
    success: true,
    message: `👤 *হিউম্যান টেকওভার সক্রিয় করা হয়েছে!*\n━━━━━━━━━━━━━━━━━━━━\n👤 কাস্টমার: *${conv.customer_name || 'Customer'}*\n📞 নম্বর: *${conv.customer_phone || conv.customer_identifier}*\n⏳ এআই মিউট থাকবে: *পরবর্তী ${durationHours} ঘণ্টা*\n\n💡 এখন এই কাস্টমারের সাথে এআই আর কোনো স্বয়ংক্রিয় রিপ্লাই দেবে না। আপনি নিশ্চিন্তে ইনবক্স থেকে নিজে কথা বলতে পারেন।`,
    data: conv,
  };
}

