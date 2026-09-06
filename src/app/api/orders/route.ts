import { NextRequest, NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

import { parsePaginationParams, decodeCursor, encodeCursor } from '@/lib/pagination';

/**
 * GET /api/orders - List orders with search, status filtering, metrics & cursor pagination
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('q');
    const { cursor, limit } = parsePaginationParams(req.url, 15, 50);
    const decodedCursor = decodeCursor(cursor);

    // 1. Overall tenant metrics query
    const metricsRes = await query(
      `SELECT count(*) as total_orders,
              count(*) FILTER (WHERE status = 'delivered') as delivered_count,
              COALESCE(sum(total_amount) FILTER (WHERE status = 'delivered'), 0) as delivered_sales,
              COALESCE(sum(estimated_profit) FILTER (WHERE status = 'delivered'), 0) as delivered_profit
       FROM orders
       WHERE tenant_id = $1;`,
      [auth.tenantId]
    );

    const metricsRow = metricsRes.rows[0] || {};
    const totalOrdersCount = parseInt(metricsRow.total_orders || '0', 10);

    // 2. Filtered count query (for search / status)
    let countSql = `SELECT count(*) FROM orders o WHERE o.tenant_id = $1`;
    const countParams: any[] = [auth.tenantId];
    if (status && status !== 'all') {
      countSql += ` AND o.status = $${countParams.length + 1}`;
      countParams.push(status);
    }
    if (search && search.trim()) {
      countSql += ` AND (o.customer_name ILIKE $${countParams.length + 1} OR o.customer_phone ILIKE $${countParams.length + 1} OR o.order_number ILIKE $${countParams.length + 1})`;
      countParams.push(`%${search.trim()}%`);
    }
    const filteredCountRes = await query(countSql, countParams);
    const filteredTotal = parseInt(filteredCountRes.rows[0].count, 10);

    // 3. Paginated orders query with Keyset / Cursor
    let sql = `
      SELECT o.id, o.order_number, o.customer_name, o.customer_phone, 
             o.delivery_address, o.delivery_city, o.district, o.postal_code,
             o.delivery_fee, o.subtotal, o.total_amount, o.status, 
             o.notes, o.courier_name, o.courier_status, o.fraud_score, 
             o.capi_fired, o.estimated_profit, o.created_at,
             c.platform as channel_platform, c.channel_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'title', oi.product_title,
                   'variant', oi.variant_title,
                   'price', oi.unit_price,
                   'quantity', oi.quantity,
                   'total_price', oi.total_price
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) as items
      FROM orders o
      LEFT JOIN channels c ON o.channel_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.tenant_id = $1
    `;
    const params: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      sql += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search && search.trim()) {
      sql += ` AND (o.customer_name ILIKE $${paramIndex} OR o.customer_phone ILIKE $${paramIndex} OR o.order_number ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Apply cursor condition if provided
    if (decodedCursor) {
      sql += ` AND (o.created_at, o.id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(decodedCursor.createdAt, decodedCursor.id);
      paramIndex += 2;
    }

    sql += ` GROUP BY o.id, c.platform, c.channel_name ORDER BY o.created_at DESC, o.id DESC LIMIT $${paramIndex};`;
    params.push(limit + 1);

    const res = await query(sql, params);
    const rows = res.rows;
    const hasMore = rows.length > limit;
    const orders = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && orders.length > 0) {
      const last = orders[orders.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        createdAt: new Date(last.created_at).toISOString(),
      });
    }

    return NextResponse.json({
      orders,
      pagination: {
        nextCursor,
        hasMore,
        limit,
        totalCount: filteredTotal,
      },
      metrics: {
        totalOrders: totalOrdersCount,
        deliveredCount: parseInt(metricsRow.delivered_count || '0', 10),
        deliveredSales: Math.round(parseFloat(metricsRow.delivered_sales || '0')),
        deliveredProfit: Math.round(parseFloat(metricsRow.delivered_profit || '0')),
        botCost: `৳০ - ৳৪০`,
      },
    });
  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/orders - Complete Order Edit (Items, Pricing, Customer Address)
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      customer_name,
      customer_phone,
      delivery_address,
      district,
      postal_code,
      delivery_fee,
      status,
      notes,
      items,
    } = body;

    if (!id || !customer_name || !customer_phone || !delivery_address) {
      return NextResponse.json(
        { error: 'Missing required order fields' },
        { status: 400 }
      );
    }

    // Calculate updated subtotal and total
    let subtotal = 0;
    if (items && Array.isArray(items)) {
      items.forEach((item: any) => {
        subtotal += parseFloat(item.price || 0) * (parseInt(item.quantity) || 1);
      });
    }
    const totalAmount = subtotal + parseFloat(delivery_fee || 0);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Update order details
      const updateRes = await client.query(
        `UPDATE orders
         SET customer_name = $1,
             customer_phone = $2,
             delivery_address = $3,
             district = $4,
             postal_code = $5,
             delivery_fee = $6,
             subtotal = $7,
             total_amount = $8,
             status = $9,
             notes = $10,
             updated_at = NOW()
         WHERE id = $11 AND tenant_id = $12
         RETURNING *;`,
        [
          customer_name,
          customer_phone,
          delivery_address,
          district || null,
          postal_code || null,
          parseFloat(delivery_fee || 0),
          subtotal,
          totalAmount,
          status || 'pending',
          notes || null,
          id,
          auth.tenantId,
        ]
      );

      if (updateRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // If items provided, replace existing items
      if (items && Array.isArray(items) && items.length > 0) {
        await client.query(`DELETE FROM order_items WHERE order_id = $1;`, [id]);

        for (const item of items) {
          await client.query(
            `INSERT INTO order_items (order_id, product_title, variant_title, unit_price, quantity, total_price)
             VALUES ($1, $2, $3, $4, $5, $6);`,
            [
              id,
              item.title || 'পণ্য',
              item.variant || null,
              parseFloat(item.price || 0),
              parseInt(item.quantity || 1),
              parseFloat(item.price || 0) * parseInt(item.quantity || 1),
            ]
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'অর্ডারের তথ্য সফলভাবে আপডেট হয়েছে!',
        order: updateRes.rows[0],
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/orders - Quick inline status / courier update
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, status, courier_name, courier_status } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const res = await query(
      `UPDATE orders 
       SET status = COALESCE($1, status),
           courier_name = COALESCE($2, courier_name),
           courier_status = COALESCE($3, courier_status),
           updated_at = NOW() 
       WHERE id = $4 AND tenant_id = $5 
       RETURNING id, order_number, status, courier_name, courier_status, updated_at;`,
      [status || null, courier_name || null, courier_status || null, orderId, auth.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: res.rows[0] });
  } catch (error: any) {
    console.error('Update order status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/orders - Delete order
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    await query(`DELETE FROM orders WHERE id = $1 AND tenant_id = $2;`, [id, auth.tenantId]);

    return NextResponse.json({ success: true, message: 'অর্ডারটি সফলভাবে মুছে ফেলা হয়েছে।' });
  } catch (error: any) {
    console.error('Delete order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
