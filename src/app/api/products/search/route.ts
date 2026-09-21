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

import { searchCatalogSemantic } from '@/lib/embeddings';

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
    const { queryText, limit } = body;

    if (!queryText) {
      return NextResponse.json({ error: 'Query text is required' }, { status: 400 });
    }

    const results = await searchCatalogSemantic(auth.tenantId, queryText, limit || 5);

    return NextResponse.json({
      success: true,
      query: queryText,
      results,
    });
  } catch (error: any) {
    console.error('Vector search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
