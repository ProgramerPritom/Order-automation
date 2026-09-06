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
 * POST /api/inbox/takeover - Toggle human takeover / mute AI for 24 hours
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, action } = body; // action: 'takeover' | 'release'

    if (!conversationId || !action) {
      return NextResponse.json(
        { error: 'conversationId and action (takeover | release) are required' },
        { status: 400 }
      );
    }

    let sql = '';
    let params: any[] = [];

    if (action === 'takeover') {
      // Mute AI for 24 hours
      sql = `
        UPDATE conversations 
        SET ai_muted_until = NOW() + INTERVAL '24 hours', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, customer_name, ai_muted_until;
      `;
      params = [conversationId, auth.tenantId];
    } else {
      // Release takeover, resume AI immediately
      sql = `
        UPDATE conversations 
        SET ai_muted_until = NULL, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, customer_name, ai_muted_until;
      `;
      params = [conversationId, auth.tenantId];
    }

    const res = await query(sql, params);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      action,
      conversation: res.rows[0],
    });
  } catch (error: any) {
    console.error('Takeover toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
