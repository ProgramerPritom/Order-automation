import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { activateMonthlyPlan } from '@/lib/subscription';

import { parsePaginationParams, decodeCursor, encodeCursor } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Bearer token required' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    if (!payload || payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { limit, cursor } = parsePaginationParams(req.url, 15, 50);
    const decodedCursor = decodeCursor(cursor);

    // 1. Platform Global Metrics
    const totalTenantsRes = await query(`SELECT count(*) FROM tenants;`);
    const totalOrdersRes = await query(`SELECT count(*), COALESCE(sum(total_amount), 0) as total_revenue FROM orders;`);
    const activeSubRes = await query(`SELECT count(*) FROM tenants WHERE subscription_status = 'active';`);
    const trialingRes = await query(`SELECT count(*) FROM tenants WHERE subscription_status = 'trialing';`);

    // 2. Tenants Keyset Cursor Filter
    const cursorValues: any[] = [];
    let cursorClause = '';
    if (decodedCursor) {
      cursorClause = `WHERE (t.created_at, t.id) < ($1, $2)`;
      cursorValues.push(decodedCursor.createdAt, decodedCursor.id);
    }

    const tenantsListRes = await query(`
      SELECT 
        t.id, t.name as store_name, t.slug, t.phone as store_phone, t.email as store_email,
        t.plan, t.subscription_status, t.trial_ends_at, t.current_period_ends_at,
        t.order_quota_monthly, t.created_at,
        u.name as owner_name, u.phone as owner_phone, u.email as owner_email,
        (SELECT count(*) FROM orders o WHERE o.tenant_id = t.id) as orders_count,
        (SELECT COALESCE(sum(total_amount), 0) FROM orders o WHERE o.tenant_id = t.id) as revenue_generated
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id AND (u.role = 'admin' OR u.role = 'superadmin')
      ${cursorClause}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $${cursorValues.length + 1};
    `, [...cursorValues, limit + 1]);

    const rows = tenantsListRes.rows;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        createdAt: new Date(last.created_at).toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalTenants: parseInt(totalTenantsRes.rows[0].count),
        totalOrders: parseInt(totalOrdersRes.rows[0].count),
        totalRevenue: parseFloat(totalOrdersRes.rows[0].total_revenue),
        activeSubscriptions: parseInt(activeSubRes.rows[0].count),
        trialingStores: parseInt(trialingRes.rows[0].count),
      },
      tenants: items,
      pagination: {
        nextCursor,
        hasMore,
        limit,
        totalCount: parseInt(totalTenantsRes.rows[0].count),
      },
    });
  } catch (error: any) {
    console.error('Super Admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyAccessToken(token);

    if (!payload || payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, tenantId, plan } = body;

    if (action === 'upgrade_plan') {
      await activateMonthlyPlan(tenantId, plan || 'pro');
      return NextResponse.json({ success: true, message: `প্ল্যান সফলভাবে ${plan} এ পরিবর্তন করা হয়েছে!` });
    }

    if (action === 'extend_trial') {
      await query(`
        UPDATE tenants
        SET 
          subscription_status = 'trialing',
          trial_ends_at = NOW() + INTERVAL '7 days'
        WHERE id = $1;
      `, [tenantId]);
      return NextResponse.json({ success: true, message: '৭ দিনের ট্রায়াল বাড়ানো হয়েছে!' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
