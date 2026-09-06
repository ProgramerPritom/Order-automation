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
 * GET /api/inbox - List active conversations across FB, IG, WA
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      `SELECT c.id, c.customer_identifier, c.customer_name, c.customer_phone, 
              c.ai_muted_until, c.updated_at,
              (c.ai_muted_until IS NOT NULL AND c.ai_muted_until > NOW()) as is_human_takeover_active,
              ch.platform as channel_platform, ch.channel_name
       FROM conversations c
       JOIN channels ch ON c.channel_id = ch.id
       WHERE c.tenant_id = $1
       ORDER BY c.updated_at DESC;`,
      [auth.tenantId]
    );

    return NextResponse.json({ conversations: res.rows });
  } catch (error: any) {
    console.error('Fetch inbox error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
