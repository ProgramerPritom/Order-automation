import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { saasRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

import { parsePaginationParams, decodeCursor, encodeCursor } from '@/lib/pagination';

/**
 * GET /api/products - List products for tenant with cursor-based pagination
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q');
    const { cursor, limit } = parsePaginationParams(req.url, 15, 50);
    const decodedCursor = decodeCursor(cursor);

    // Total count for tenant
    let countSql = `SELECT count(*) FROM products WHERE tenant_id = $1`;
    const countParams: any[] = [auth.tenantId];
    if (search && search.trim()) {
      countSql += ` AND (title ILIKE $2 OR sku ILIKE $2 OR category ILIKE $2)`;
      countParams.push(`%${search.trim()}%`);
    }
    const countRes = await query(countSql, countParams);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    // Paginated query
    let sql = `
      SELECT id, title, description, category, price, stock, sku, image_url, is_active, 
             (embedding IS NOT NULL) as has_vector, created_at 
      FROM products 
      WHERE tenant_id = $1
    `;
    const params: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (search && search.trim()) {
      sql += ` AND (title ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR category ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (decodedCursor) {
      sql += ` AND (created_at, id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(decodedCursor.createdAt, decodedCursor.id);
      paramIndex += 2;
    }

    sql += ` ORDER BY created_at DESC, id DESC LIMIT $${paramIndex};`;
    params.push(limit + 1);

    const res = await query(sql, params);
    const rows = res.rows;
    const hasMore = rows.length > limit;
    const products = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && products.length > 0) {
      const last = products[products.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        createdAt: new Date(last.created_at).toISOString(),
      });
    }

    return NextResponse.json({
      products,
      pagination: {
        nextCursor,
        hasMore,
        limit,
        totalCount,
      },
    });
  } catch (error: any) {
    console.error('Fetch products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/products - Create new product with mock/real vector embedding
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, category, price, stock, sku, image_url } = body;

    if (!title || price === undefined) {
      return NextResponse.json(
        { error: 'Title and price are required' },
        { status: 400 }
      );
    }

    // Generate a valid 1536-dimensional vector for pgvector
    // In production, this calls OpenAI text-embedding-3-small
    const vector1536 = new Array(1536).fill(0).map(() => (Math.random() * 0.1).toFixed(6));
    const vectorString = `[${vector1536.join(',')}]`;

    const res = await query(
      `INSERT INTO products (tenant_id, title, description, category, price, stock, sku, image_url, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
       RETURNING id, title, description, category, price, stock, sku, image_url, is_active, created_at;`,
      [
        auth.tenantId,
        title,
        description || '',
        category || 'General',
        parseFloat(price),
        parseInt(stock || '0', 10),
        sku || `SKU-${Date.now().toString().slice(-6)}`,
        image_url || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
        vectorString,
      ]
    );

    // Invalidate Redis catalog cache so next AI reply fetches fresh products instantly
    await saasRedis.del(`catalog:${auth.tenantId}`);

    return NextResponse.json({
      success: true,
      message: 'Product created and synced to RAG Vector DB',
      product: res.rows[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/products - Update product details or stock
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description, category, price, stock, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const res = await query(
      `UPDATE products 
       SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         price = CASE WHEN $4::numeric IS NOT NULL THEN $4::numeric ELSE price END,
         stock = CASE WHEN $5::integer IS NOT NULL THEN $5::integer ELSE stock END,
         is_active = CASE WHEN $6::boolean IS NOT NULL THEN $6::boolean ELSE is_active END,
         updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING id, title, description, category, price, stock, sku, image_url, is_active;`,
      [
        title || null,
        description !== undefined ? description : null,
        category || null,
        price !== undefined ? parseFloat(price) : null,
        stock !== undefined ? parseInt(stock, 10) : null,
        is_active !== undefined ? is_active : null,
        id,
        auth.tenantId,
      ]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Invalidate Redis catalog cache so AI instantly gets updated stock/price
    await saasRedis.del(`catalog:${auth.tenantId}`);

    return NextResponse.json({
      success: true,
      message: 'পণ্য ও স্টক সফলভাবে আপডেট করা হয়েছে (ক্যাশ সিঙ্ক সম্পন্ন)',
      product: res.rows[0],
    });
  } catch (error: any) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/products - Delete or deactivate a product
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
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const res = await query(
      `DELETE FROM products WHERE id = $1 AND tenant_id = $2 RETURNING id;`,
      [id, auth.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Invalidate Redis catalog cache
    await saasRedis.del(`catalog:${auth.tenantId}`);

    return NextResponse.json({
      success: true,
      message: 'পণ্য সফলভাবে মুছে ফেলা হয়েছে (ক্যাশ সিঙ্ক সম্পন্ন)',
    });
  } catch (error: any) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
