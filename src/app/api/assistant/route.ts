import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { askGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

/**
 * POST /api/assistant - Real-time Merchant AI Copilot
 * Fetches live store data from PostgreSQL and feeds to Gemini
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Fetch live tenant & shop details
    const tenantRes = await query(
      `SELECT name, business_category, support_phone, about_shop, delivery_inside_dhaka, delivery_outside_dhaka
       FROM tenants WHERE id = $1;`,
      [auth.tenantId]
    );
    const store = tenantRes.rows[0] || { name: 'My Store' };

    // 2. Fetch live order stats
    const orderStatsRes = await query(
      `SELECT 
         count(*) as total_orders,
         count(*) FILTER (WHERE status = 'pending') as pending_count,
         count(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
         count(*) FILTER (WHERE status = 'shipped') as shipped_count,
         count(*) FILTER (WHERE status = 'delivered') as delivered_count,
         count(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
         COALESCE(sum(total_amount), 0) as total_sales,
         COALESCE(sum(total_amount) FILTER (WHERE status = 'delivered'), 0) as delivered_sales,
         COALESCE(sum(estimated_profit) FILTER (WHERE status = 'delivered'), 0) as delivered_profit
       FROM orders 
       WHERE tenant_id = $1;`,
      [auth.tenantId]
    );
    const stats = orderStatsRes.rows[0];

    // 3. Fetch recent 5 orders for specific inquiries
    const recentOrdersRes = await query(
      `SELECT order_number, customer_name, customer_phone, total_amount, status, courier_name, created_at
       FROM orders
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 5;`,
      [auth.tenantId]
    );

    // 4. Fetch low stock products (stock < 10)
    // 4. Fetch low stock products (stock < 10)
    const lowStockRes = await query(
      `SELECT title, price, stock 
       FROM products 
       WHERE tenant_id = $1 AND stock < 10 AND is_active = true
       ORDER BY stock ASC
       LIMIT 5;`,
      [auth.tenantId]
    );

    // 5. Fetch connected channels (Facebook, Instagram, WhatsApp)
    const channelsRes = await query(
      `SELECT platform, channel_name, channel_identifier, ai_active, webhook_verified, created_at
       FROM channels 
       WHERE tenant_id = $1
       ORDER BY created_at DESC;`,
      [auth.tenantId]
    );

    // 6. Fetch products summary
    const prodCountRes = await query(
      `SELECT count(*) as total_products, count(*) FILTER (WHERE stock > 0) as in_stock_count
       FROM products 
       WHERE tenant_id = $1 AND is_active = true;`,
      [auth.tenantId]
    );
    const prodStats = prodCountRes.rows[0];

    // 7. Fetch comments summary
    const commentStatsRes = await query(
      `SELECT count(*) as total_comments, count(*) FILTER (WHERE ai_replied = true) as ai_replied_count
       FROM facebook_comments
       WHERE tenant_id = $1;`,
      [auth.tenantId]
    );
    const commentStats = commentStatsRes.rows[0];

    // Build rich live database context for Gemini
    const systemContext = `
তুমি হলে "${store.name}" অনলাইন শপের নিজস্ব স্মার্ট এআই বিজনেস কো-পাইলট ও সহকারী (AI Business Copilot)। 
তোমার কাজ হলো শপ ওনারকে তার ব্যবসার রিয়েলটাইম লাইভ ডাটাবেজ থেকে নিখুঁত তথ্য দেওয়া, প্রশ্নগুলোর উত্তর দেওয়া এবং সঠিক বিজনেস সিদ্ধান্ত নিতে সাহায্য করা।

[শপের লাইভ ডাটাবেজ স্ট্যাটাস]:
- শপের নাম: ${store.name}
- বিজনেসের ধরন: ${store.business_category || 'ই-কমার্স ও রিটেল'}
- মোট পণ্য সংখ্যা: ${prodStats?.total_products || 0} টি (ইন-স্টক: ${prodStats?.in_stock_count || 0} টি)
- মোট অর্ডার সংখ্যা: ${stats.total_orders} টি
- পেন্ডিং অর্ডার: ${stats.pending_count} টি (রিভিউ প্রয়োজন)
- কনফার্মড অর্ডার: ${stats.confirmed_count} টি
- পাঠানো হয়েছে (কুরিয়ারে): ${stats.shipped_count} টি
- সফলভাবে ডেলিভারড: ${stats.delivered_count} টি
- মোট বিক্রি (Total Sales): ৳${stats.total_sales}
- ডেলিভারড বিক্রি: ৳${stats.delivered_sales}
- মোট অর্জিত নিট লাভ: ৳${stats.delivered_profit}
- ডেলিভারি চার্জ: ঢাকা ৳${store.delivery_inside_dhaka || 80}, ঢাকার বাইরে ৳${store.delivery_outside_dhaka || 150}
- পোস্টের মোট কমেন্ট: ${commentStats?.total_comments || 0} টি (এআই উত্তর দিয়েছে: ${commentStats?.ai_replied_count || 0} টি)

[কানেক্টেড সোশ্যাল মিডিয়া চ্যানেল]:
${
  channelsRes.rows.length > 0
    ? channelsRes.rows
        .map(
          (c) =>
            `- [${c.platform.toUpperCase()}]: "${c.channel_name}" (ID: ${c.channel_identifier}, এআই অটো-রিপ্লাই: ${
              c.ai_active ? 'সক্রিয় (Active)' : 'বন্ধ'
            }, ওয়েবহুক: ${c.webhook_verified ? 'ভেরিফাইড' : 'পেন্ডিং'})`
        )
        .join('\n')
    : '- বর্তমানে কোনো ফেসবুক পেজ, ইনস্টাগ্রাম বা হোয়াটসঅ্যাপ চ্যানেল কানেক্ট করা নেই।'
}

[সাম্প্রতিক অর্ডার তালিকা]:
${recentOrdersRes.rows.length > 0 ? recentOrdersRes.rows.map(o => `- #${o.order_number} (${o.customer_name}, ${o.customer_phone}) বিল: ৳${o.total_amount}, স্ট্যাটাস: ${o.status}`).join('\n') : '- এখনো কোনো অর্ডার আসেনি।'}

[কম স্টকের পণ্য তালিকা (Low Stock Alerts)]:
${lowStockRes.rows.length > 0 ? lowStockRes.rows.map(p => `- ${p.title}: অবশিষ্ট স্টক ${p.stock} পিস (মূল্য: ৳${p.price})`).join('\n') : '- কোনো পণ্যের স্টক কম নেই, সব পর্যাপ্ত।'}

[গুরুত্বপূর্ণ নির্দেশিকা ও টোন]:
১. কখনোই "প্রিয় মালিক", "হে প্রভু" বা কোনো রোবটিক, অদ্ভুত বা কৃত্রিম সম্বোধন ব্যবহার করবে না।
২. সবসময় একজন অভিজ্ঞ, বন্ধুসুলভ, স্মার্ট বিজনেস কনসালট্যান্ট বা পার্টনারের মতো স্বাভাবিক বাংলায় কথা বলবে (যেমন: "জি ভাইয়া", "আপনার শপের বর্তমান তথ্য অনুযায়ী...", "আমি দেখতে পাচ্ছি...", ইত্যাদি)।
৩. যদি ইউজার জানতে চায় তার ফেসবুক পেজ বা কোনো চ্যানেল কানেক্ট হয়েছে কি না, উপরের [কানেক্টেড সোশ্যাল মিডিয়া চ্যানেল] ডাটা দেখে সঠিকভাবে পেজের নাম ও স্ট্যাটাস জানাবে।
৪. উত্তর সবসময় সুস্পষ্ট, তথ্যবহুল এবং সহজবোধ্য রাখবে। অতিরিক্ত অপ্রয়োজনীয় ভূমিকা বা অবান্তর কথা এড়িয়ে চলবে।
`;

    // Call Gemini with live context
    const aiReply = await askGemini(message, systemContext);

    return NextResponse.json({
      reply: aiReply,
      liveSummary: {
        totalOrders: stats.total_orders,
        pendingCount: stats.pending_count,
        deliveredProfit: stats.delivered_profit,
        lowStockCount: lowStockRes.rows.length,
      },
    });
  } catch (error: any) {
    console.error('Assistant API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
