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

    const { searchParams } = new URL(req.url);
    const searchQuery = (searchParams.get('q') || searchParams.get('search') || '').trim();
    const planFilter = (searchParams.get('plan') || '').trim().toLowerCase();
    const statusFilter = (searchParams.get('status') || '').trim().toLowerCase();

    const { limit, cursor } = parsePaginationParams(req.url, 20, 100);
    const decodedCursor = decodeCursor(cursor);

    // 1. Platform Global Metrics (Excluding master platform tenant)
    const [totalTenantsRes, totalUsersRes, totalOrdersRes, activeSubRes, trialingRes] = await Promise.all([
      query(`SELECT count(*) FROM tenants WHERE slug != 'platform-superadmin';`),
      query(`SELECT count(*) FROM users;`),
      query(`SELECT count(*), COALESCE(sum(total_amount), 0) as total_revenue FROM orders;`),
      query(`SELECT count(*) FROM tenants WHERE subscription_status = 'active' AND slug != 'platform-superadmin';`),
      query(`SELECT count(*) FROM tenants WHERE subscription_status = 'trialing' AND slug != 'platform-superadmin';`),
    ]);

    // 2. Build Where Clauses (Always filter out the master platform admin tenant)
    const conditions: string[] = [`t.slug != 'platform-superadmin'`];
    const values: any[] = [];
    let paramIndex = 1;

    if (decodedCursor) {
      conditions.push(`(t.created_at, t.id) < ($${paramIndex}, $${paramIndex + 1})`);
      values.push(decodedCursor.createdAt, decodedCursor.id);
      paramIndex += 2;
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(`(
        t.name ILIKE $${paramIndex} OR 
        t.slug ILIKE $${paramIndex} OR 
        t.phone ILIKE $${paramIndex} OR 
        t.email ILIKE $${paramIndex} OR 
        u.name ILIKE $${paramIndex} OR 
        u.phone ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex}
      )`);
      values.push(searchPattern);
      paramIndex += 1;
    }

    if (planFilter && ['starter', 'pro', 'business'].includes(planFilter)) {
      conditions.push(`t.plan = $${paramIndex}`);
      values.push(planFilter);
      paramIndex += 1;
    }

    if (statusFilter && ['active', 'trialing', 'past_due', 'expired'].includes(statusFilter)) {
      conditions.push(`t.subscription_status = $${paramIndex}`);
      values.push(statusFilter);
      paramIndex += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const tenantsListRes = await query(`
      SELECT 
        t.id, 
        t.name as store_name, 
        t.slug, 
        t.phone as store_phone, 
        t.email as store_email,
        t.plan, 
        t.subscription_status, 
        t.trial_ends_at, 
        t.current_period_ends_at,
        t.order_quota_monthly, 
        t.orders_count_current_month,
        t.max_channels,
        t.created_at,
        t.updated_at,
        u.id as owner_id,
        u.name as owner_name, 
        u.phone as owner_phone, 
        u.email as owner_email,
        u.role as owner_role,
        (SELECT count(*) FROM orders o WHERE o.tenant_id = t.id) as orders_count,
        (SELECT COALESCE(sum(total_amount), 0) FROM orders o WHERE o.tenant_id = t.id) as revenue_generated,
        (SELECT count(*) FROM channels c WHERE c.tenant_id = t.id) as channels_count,
        (SELECT count(*) FROM users u2 WHERE u2.tenant_id = t.id) as total_staff_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id AND (u.role = 'admin' OR u.role = 'superadmin')
      ${whereClause}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $${paramIndex};
    `, [...values, limit + 1]);

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
        totalUsers: parseInt(totalUsersRes.rows[0].count),
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
    const { action, tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // 1. Set Custom Validation Date
    if (action === 'set_validation_date') {
      const { targetField, date, status } = body;
      if (!date) {
        return NextResponse.json({ error: 'Date is required' }, { status: 400 });
      }

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }

      const isFuture = targetDate.getTime() > Date.now();
      const resolvedStatus = status || (isFuture ? (targetField === 'trial_ends_at' ? 'trialing' : 'active') : 'expired');

      if (targetField === 'trial_ends_at') {
        await query(`
          UPDATE tenants
          SET 
            trial_ends_at = $1,
            subscription_status = $2,
            updated_at = NOW()
          WHERE id = $3;
        `, [targetDate, resolvedStatus, tenantId]);
      } else {
        await query(`
          UPDATE tenants
          SET 
            current_period_ends_at = $1,
            subscription_status = $2,
            updated_at = NOW()
          WHERE id = $3;
        `, [targetDate, resolvedStatus, tenantId]);
      }

      return NextResponse.json({
        success: true,
        message: `মেয়াদ সফলভাবে ${targetDate.toLocaleDateString('bn-BD')} পর্যন্ত নির্ধারণ করা হয়েছে!`,
      });
    }

    // 2. Extend Validity Days
    if (action === 'extend_days') {
      const days = parseInt(body.days || 30, 10);
      const targetField = body.targetField || 'current_period_ends_at';

      if (isNaN(days) || days <= 0) {
        return NextResponse.json({ error: 'Invalid days count' }, { status: 400 });
      }

      if (targetField === 'trial_ends_at') {
        await query(`
          UPDATE tenants
          SET 
            trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + ($1 || ' days')::INTERVAL,
            subscription_status = 'trialing',
            updated_at = NOW()
          WHERE id = $2;
        `, [days, tenantId]);
      } else {
        await query(`
          UPDATE tenants
          SET 
            current_period_ends_at = GREATEST(COALESCE(current_period_ends_at, NOW()), NOW()) + ($1 || ' days')::INTERVAL,
            subscription_status = 'active',
            updated_at = NOW()
          WHERE id = $2;
        `, [days, tenantId]);
      }

      return NextResponse.json({
        success: true,
        message: `সফলভাবে +${days} দিন মেয়াদ বাড়ানো হয়েছে!`,
      });
    }

    // 3. Upgrade / Change Plan
    if (action === 'upgrade_plan') {
      const plan = body.plan || 'pro';
      await activateMonthlyPlan(tenantId, plan);
      return NextResponse.json({
        success: true,
        message: `প্ল্যান সফলভাবে ${plan.toUpperCase()} এ পরিবর্তন করা হয়েছে!`,
      });
    }

    // 4. Update Subscription Status Directly
    if (action === 'update_status') {
      const { status } = body;
      if (!['active', 'trialing', 'past_due', 'expired'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      await query(`
        UPDATE tenants
        SET subscription_status = $1, updated_at = NOW()
        WHERE id = $2;
      `, [status, tenantId]);

      return NextResponse.json({
        success: true,
        message: `সাবস্ক্রিপশন স্ট্যাটাস সফলভাবে '${status}' করা হয়েছে!`,
      });
    }

    // 5. Update Full Management Configuration
    if (action === 'update_full_config') {
      const {
        plan,
        status,
        validationDate,
        orderQuotaMonthly,
        maxChannels,
      } = body;

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (plan && ['starter', 'pro', 'business'].includes(plan)) {
        updates.push(`plan = $${idx++}`);
        values.push(plan);
      }

      if (status && ['active', 'trialing', 'past_due', 'expired'].includes(status)) {
        updates.push(`subscription_status = $${idx++}`);
        values.push(status);
      }

      if (validationDate) {
        const parsedDate = new Date(validationDate);
        if (!isNaN(parsedDate.getTime())) {
          updates.push(`current_period_ends_at = $${idx++}`);
          values.push(parsedDate);
        }
      }

      if (orderQuotaMonthly !== undefined) {
        updates.push(`order_quota_monthly = $${idx++}`);
        values.push(parseInt(orderQuotaMonthly, 10));
      }

      if (maxChannels !== undefined) {
        updates.push(`max_channels = $${idx++}`);
        values.push(parseInt(maxChannels, 10));
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      updates.push(`updated_at = NOW()`);
      values.push(tenantId);

      await query(`
        UPDATE tenants 
        SET ${updates.join(', ')}
        WHERE id = $${idx};
      `, values);

      return NextResponse.json({
        success: true,
        message: 'মার্চেন্ট এবং ভ্যালিডেশন সেটিংস সফলভাবে আপডেট করা হয়েছে!',
      });
    }

    // 6. Delete Tenant & Associated User/Data
    if (action === 'delete_tenant') {
      // Safety check: protect master superadmin tenant
      const checkRes = await query(`SELECT slug, name FROM tenants WHERE id = $1;`, [tenantId]);
      if (checkRes.rows.length === 0) {
        return NextResponse.json({ error: 'মার্চেন্ট পাওয়া যায়নি।' }, { status: 404 });
      }

      if (checkRes.rows[0].slug === 'platform-superadmin') {
        return NextResponse.json(
          { error: 'সুরক্ষা সতর্কতা: সুপার এডমিন মাস্টার টেন্যান্ট মুছে ফেলা যাবে না।' },
          { status: 400 }
        );
      }

      // Cascade delete tenant and all related data (users, channels, products, orders)
      await query(`DELETE FROM tenants WHERE id = $1;`, [tenantId]);

      return NextResponse.json({
        success: true,
        message: `মার্চেন্ট "${checkRes.rows[0].name}" এবং তার সমস্ত ডাটা সফলভাবে মুছে ফেলা হয়েছে!`,
      });
    }

    // 7. Legacy extend_trial
    if (action === 'extend_trial') {
      await query(`
        UPDATE tenants
        SET 
          subscription_status = 'trialing',
          trial_ends_at = NOW() + INTERVAL '7 days',
          updated_at = NOW()
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

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('id') || searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const checkRes = await query(`SELECT slug, name FROM tenants WHERE id = $1;`, [tenantId]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'মার্চেন্ট পাওয়া যায়নি।' }, { status: 404 });
    }

    if (checkRes.rows[0].slug === 'platform-superadmin') {
      return NextResponse.json(
        { error: 'সুরক্ষা সতর্কতা: সুপার এডমিন মাস্টার টেন্যান্ট মুছে ফেলা যাবে না।' },
        { status: 400 }
      );
    }

    await query(`DELETE FROM tenants WHERE id = $1;`, [tenantId]);

    return NextResponse.json({
      success: true,
      message: `মার্চেন্ট "${checkRes.rows[0].name}" এবং তার সমস্ত ডাটা সফলভাবে মুছে ফেলা হয়েছে!`,
    });
  } catch (error: any) {
    console.error('Admin delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
