import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token =
    (authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null')
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * GET /api/channels/test-context - Fetch real store info and products for interactive AI test
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch Tenant Store Info
    const tenantRes = await query(
      `SELECT name, about_shop, delivery_inside_dhaka, delivery_outside_dhaka, support_phone 
       FROM tenants 
       WHERE id = $1;`,
      [auth.tenantId]
    );
    const shop = tenantRes.rows[0] || { name: 'My Shop' };

    // 2. Fetch Real Products
    const prodRes = await query(
      `SELECT id, title, price, stock, category 
       FROM products 
       WHERE tenant_id = $1 AND is_active = TRUE 
       ORDER BY stock DESC 
       LIMIT 10;`,
      [auth.tenantId]
    );
    const products = prodRes.rows;

    // 3. Generate dynamic personalized test prompts based on real products
    const firstProduct = products[0];
    const suggestions: string[] = [
      'ভাইয়া ডেলিভারি চার্জ কত এবং ঢাকায় কতদিন সময় লাগে?',
    ];

    if (firstProduct) {
      suggestions.push(`আপনাদের "${firstProduct.title}"-এর মূল্য কত এবং স্টকে আছে?`);
      suggestions.push(
        `আমার নাম কবির হোসেন, মিরপুর ঢাকা, ফোন ০১৭১১২২৩৩৪৪। আমি ১টি "${firstProduct.title}" ক্যাশ অন ডেলিভারিতে নিতে চাই। কনফার্ম করুন।`
      );
    } else {
      suggestions.push('আপনাদের কাছে কী কী পণ্য আছে জানতে পারি?');
      suggestions.push('আমার নাম সুমন, ঢাকা ধানমন্ডি, ফোন ০১৭১১২২৩৩৪৪, ক্যাশ অন ডেলিভারিতে ১টি আইটেম পাঠাবেন।');
    }

    return NextResponse.json({
      shopName: shop.name,
      deliveryInsideDhaka: shop.delivery_inside_dhaka,
      deliveryOutsideDhaka: shop.delivery_outside_dhaka,
      products,
      suggestions,
    });
  } catch (error: any) {
    console.error('Test context error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
