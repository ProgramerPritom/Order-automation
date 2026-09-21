import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { saasRedis } from '@/lib/redis';

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

import { parsePaginationParams, decodeCursor, encodeCursor } from '@/lib/pagination';
import { generateProductVector } from '@/lib/embeddings';

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
    const channelIdParam = searchParams.get('channel_id');
    const { cursor, limit } = parsePaginationParams(req.url, 15, 100);
    const decodedCursor = decodeCursor(cursor);

    // Total count for tenant (with optional channel filter)
    let countSql = `SELECT count(*) FROM products WHERE tenant_id = $1`;
    const countParams: any[] = [auth.tenantId];
    let countParamIdx = 2;

    if (channelIdParam === 'global') {
      countSql += ` AND channel_id IS NULL`;
    } else if (channelIdParam && channelIdParam !== 'all') {
      countSql += ` AND (channel_id = $${countParamIdx} OR channel_id IS NULL)`;
      countParams.push(channelIdParam);
      countParamIdx++;
    }

    if (search && search.trim()) {
      countSql += ` AND (title ILIKE $${countParamIdx} OR sku ILIKE $${countParamIdx} OR category ILIKE $${countParamIdx})`;
      countParams.push(`%${search.trim()}%`);
    }
    const countRes = await query(countSql, countParams);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    // Paginated query with channel details
    let sql = `
      SELECT p.id, p.tenant_id, p.channel_id, c.channel_name, c.platform,
             p.title, p.description, p.category, p.price, p.stock, p.sku, p.image_url, 
             p.is_active, p.rag_knowledge, (p.embedding IS NOT NULL) as has_vector, p.created_at 
      FROM products p
      LEFT JOIN channels c ON p.channel_id = c.id
      WHERE p.tenant_id = $1
    `;
    const params: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (channelIdParam === 'global') {
      sql += ` AND p.channel_id IS NULL`;
    } else if (channelIdParam && channelIdParam !== 'all') {
      sql += ` AND (p.channel_id = $${paramIndex} OR p.channel_id IS NULL)`;
      params.push(channelIdParam);
      paramIndex++;
    }

    if (search && search.trim()) {
      sql += ` AND (p.title ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR p.category ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (decodedCursor) {
      sql += ` AND (p.created_at, p.id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(decodedCursor.createdAt, decodedCursor.id);
      paramIndex += 2;
    }

    sql += ` ORDER BY p.created_at DESC, p.id DESC LIMIT $${paramIndex};`;
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
 * POST /api/products - Create new product with real Gemini vector embedding and channel scoping
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, category, price, stock, sku, image_url, rag_knowledge, channel_id } = body;

    if (!title || price === undefined) {
      return NextResponse.json(
        { error: 'Title and price are required' },
        { status: 400 }
      );
    }

    // Resolve target channel
    let targetChannelId: string | null = null;
    if (channel_id && channel_id !== 'all' && channel_id !== 'global') {
      targetChannelId = channel_id;
    }

    // Generate real 768-dimensional dense vector via Gemini embedding
    let vectorString: string | null = null;
    try {
      vectorString = await generateProductVector({
        title,
        description: description || '',
        category: category || 'General',
        rag_knowledge: rag_knowledge || null,
      });
    } catch (embedErr: any) {
      console.warn('Embedding generation warning (will save without vector):', embedErr.message);
    }

    const res = await query(
      `INSERT INTO products (tenant_id, channel_id, title, description, category, price, stock, sku, image_url, embedding, rag_knowledge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $10::text IS NOT NULL THEN $10::vector ELSE NULL END, $11)
       RETURNING id, channel_id, title, description, category, price, stock, sku, image_url, is_active, rag_knowledge, created_at;`,
      [
        auth.tenantId,
        targetChannelId,
        title,
        description || '',
        category || 'General',
        parseFloat(price),
        parseInt(stock || '0', 10),
        sku || `SKU-${Date.now().toString().slice(-6)}`,
        image_url || null,
        vectorString,
        rag_knowledge || null,
      ]
    );

    // Invalidate Redis catalog caches so AI instantly gets updated product list
    await saasRedis.del(`catalog:${auth.tenantId}`);
    await saasRedis.del(`catalog:${auth.tenantId}:all`);
    if (targetChannelId) {
      await saasRedis.del(`catalog:${auth.tenantId}:${targetChannelId}`);
    }

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
 * PUT /api/products - Update product details, stock, image or knowledge
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description, category, price, stock, is_active, image_url, rag_knowledge, channel_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Recompute vector embedding if semantic fields are being updated
    let vectorString: string | null = null;
    if (title || description !== undefined || rag_knowledge !== undefined) {
      try {
        vectorString = await generateProductVector({
          title: title || '',
          description: description || '',
          category: category || '',
          rag_knowledge: rag_knowledge || null,
        });
      } catch (embedErr: any) {
        console.warn('Re-embedding warning on PUT:', embedErr.message);
      }
    }

    let channelIdUpdateVal: any = undefined;
    if (channel_id !== undefined) {
      channelIdUpdateVal = (channel_id === 'all' || channel_id === 'global' || !channel_id) ? null : channel_id;
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
         image_url = CASE WHEN $7::text IS NOT NULL THEN $7::text ELSE image_url END,
         rag_knowledge = CASE WHEN $8::text IS NOT NULL THEN $8::text ELSE rag_knowledge END,
         embedding = CASE WHEN $9::text IS NOT NULL THEN $9::vector ELSE embedding END,
         channel_id = CASE WHEN $12::boolean IS TRUE THEN $13::uuid ELSE channel_id END,
         updated_at = NOW()
       WHERE id = $10 AND tenant_id = $11
       RETURNING id, channel_id, title, description, category, price, stock, sku, image_url, is_active, rag_knowledge;`,
      [
        title || null,
        description !== undefined ? description : null,
        category || null,
        price !== undefined ? parseFloat(price) : null,
        stock !== undefined ? parseInt(stock, 10) : null,
        is_active !== undefined ? is_active : null,
        image_url !== undefined ? image_url : null,
        rag_knowledge !== undefined ? rag_knowledge : null,
        vectorString,
        id,
        auth.tenantId,
        channel_id !== undefined,
        channelIdUpdateVal,
      ]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Invalidate Redis catalog caches so AI instantly gets updated stock/price
    await saasRedis.del(`catalog:${auth.tenantId}`);
    await saasRedis.del(`catalog:${auth.tenantId}:all`);
    if (channelIdUpdateVal) {
      await saasRedis.del(`catalog:${auth.tenantId}:${channelIdUpdateVal}`);
    }

    return NextResponse.json({
      success: true,
      message: 'পণ্য, স্টক ও ছবি সফলভাবে আপডেট করা হয়েছে (ক্যাশ সিঙ্ক সম্পন্ন)',
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
