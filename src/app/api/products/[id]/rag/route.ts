import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { saasRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token =
    authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null'
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return null;
  return verifyAccessToken(token);
}

// GET /api/products/[id]/rag - Retrieve product's RAG knowledge
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const res = await query(
      `SELECT id, title, sku, price, stock, description, rag_knowledge 
       FROM products 
       WHERE id = $1 AND tenant_id = $2;`,
      [id, auth.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'পণ্যটি পাওয়া যায়নি।' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      product: res.rows[0],
    });
  } catch (error: any) {
    console.error('Fetch product RAG error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/products/[id]/rag - Save / update product's RAG knowledge
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { rag_knowledge } = body;

    // Fetch product details to regenerate semantic vector
    const prodRes = await query(
      `SELECT title, category, description FROM products WHERE id = $1 AND tenant_id = $2;`,
      [id, auth.tenantId]
    );

    if (prodRes.rows.length === 0) {
      return NextResponse.json({ error: 'পণ্যটি পাওয়া যায়নি।' }, { status: 404 });
    }

    const currentProd = prodRes.rows[0];
    let vectorString: string | null = null;
    try {
      const { generateProductVector } = await import('@/lib/embeddings');
      vectorString = await generateProductVector({
        title: currentProd.title,
        category: currentProd.category,
        description: currentProd.description,
        rag_knowledge: rag_knowledge || null,
      });
    } catch (e: any) {
      console.warn('RAG vector generation warning:', e.message);
    }

    const res = await query(
      `UPDATE products 
       SET 
         rag_knowledge = $1, 
         embedding = CASE WHEN $2::text IS NOT NULL THEN $2::vector ELSE embedding END,
         updated_at = NOW() 
       WHERE id = $3 AND tenant_id = $4
       RETURNING id, title, sku, price, stock, description, rag_knowledge, (embedding IS NOT NULL) as has_vector;`,
      [rag_knowledge || null, vectorString, id, auth.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'পণ্যটি আপডেট করা সম্ভব হয়নি।' }, { status: 404 });
    }

    // Invalidate Redis catalog cache so AI engines fetch fresh RAG knowledge immediately
    await saasRedis.del(`catalog:${auth.tenantId}`);

    return NextResponse.json({
      success: true,
      message: 'পণ্যটির এআই র্যাক (RAG) নলেজ সফলভাবে সংরক্ষিত হয়েছে!',
      product: res.rows[0],
    });
  } catch (error: any) {
    console.error('Save product RAG error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
