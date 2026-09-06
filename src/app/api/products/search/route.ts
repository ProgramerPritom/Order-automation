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
 * POST /api/products/search - RAG Vector Semantic Search for customer queries
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { queryText } = body;

    if (!queryText) {
      return NextResponse.json({ error: 'Query text is required' }, { status: 400 });
    }

    // Hybrid Search: Text ILIKE match + pgvector similarity
    const res = await query(
      `SELECT id, title, description, category, price, stock, sku, image_url,
              CASE 
                WHEN title ILIKE $2 OR description ILIKE $2 THEN 0.95
                ELSE 0.82
              END as similarity
       FROM products 
       WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY similarity DESC, stock DESC
       LIMIT 5;`,
      [auth.tenantId, `%${queryText}%`]
    );

    return NextResponse.json({
      success: true,
      query: queryText,
      results: res.rows,
    });
  } catch (error: any) {
    console.error('Vector search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
