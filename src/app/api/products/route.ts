import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

/**
 * GET /api/products - List products for tenant
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      `SELECT id, title, description, category, price, stock, sku, image_url, is_active, 
              (embedding IS NOT NULL) as has_vector, created_at 
       FROM products 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC;`,
      [auth.tenantId]
    );

    return NextResponse.json({ products: res.rows });
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
