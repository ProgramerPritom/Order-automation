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
    const lowStockRes = await query(
      `SELECT title, price, stock 
       FROM products 
       WHERE tenant_id = $1 AND stock < 10 AND is_active = true
       ORDER BY stock ASC
       LIMIT 5;`,
      [auth.tenantId]
    );

    // Build rich live database context for Gemini
    const systemContext = `
তুমি হলে "${store.name}" অনলাইন শপের নিজস্ব পার্সোনাল এআই বিজনেস অ্যাসিস্ট্যান্ট বা সহকারী (AI Business Copilot)। 
তোমার কাজ হলো শপের মালিককে তার ব্যবসার রিয়েলটাইম লাইভ ডাটাবেজ থেকে নিখুঁত তথ্য দেওয়া এবং পরামর্শ দেওয়া।

[শপের লাইভ ডাটাবেজ স্ট্যাটাস]:
- শপের নাম: ${store.name}
- বিজনেসের ক্যাটাগরি: ${store.business_category || 'ফ্যাশন ও ক্লথিং'}
- মোট অর্ডার সংখ্যা: ${stats.total_orders} টি
- পেন্ডিং অর্ডার: ${stats.pending_count} টি (জরুরি রিভিউ প্রয়োজন)
- কনফার্মড অর্ডার: ${stats.confirmed_count} টি
- পাঠানো হয়েছে (কুরিয়ারে): ${stats.shipped_count} টি
- সফলভাবে ডেলিভারড: ${stats.delivered_count} টি
- মোট বিক্রি (Total Sales): ৳${stats.total_sales}
- ডেলিভারড বিক্রি: ৳${stats.delivered_sales}
- মোট অর্জিত নিট লাভ: ৳${stats.delivered_profit}
- ডেলিভারি চার্জ: ঢাকা ৳${store.delivery_inside_dhaka || 80}, ঢাকার বাইরে ৳${store.delivery_outside_dhaka || 150}

[সাম্প্রতিক অর্ডার তালিকা]:
${recentOrdersRes.rows.map(o => `- #${o.order_number} (${o.customer_name}, ${o.customer_phone}) বিল: ৳${o.total_amount}, স্ট্যাটাস: ${o.status}`).join('\n')}

[কম স্টকের পণ্য তালিকা (Low Stock Alerts)]:
${lowStockRes.rows.length > 0 ? lowStockRes.rows.map(p => `- ${p.title}: অবশিষ্ট স্টক ${p.stock} পিস (মূল্য: ৳${p.price})`).join('\n') : '- কোনো পণ্যের স্টক কম নেই, সব পর্যাপ্ত।'}

[নির্দেশনা]:
১. উত্তর সবসময় সুন্দর, বিনয়ী ও ঝরঝরে বাংলায় দাও।
২. শপের মালিক যদি জানতে চায় আজকে কয়টা অর্ডার, পেন্ডিং কত বা লাভ কত — উপরের ডাটাবেজের সঠিক সংখ্যা উল্লেখ করে পরিষ্কার জবাব দাও।
৩. কম স্টকের পণ্য বা পেন্ডিং অর্ডারের বিষয়ে কোনো প্রশ্ন করলে সতর্ক করো।
৪. উত্তর সংক্ষিপ্ত, সুস্পষ্ট এবং তথ্যবহুল রাখো (অযথা বড় বাক্য পরিহার করো)।
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
