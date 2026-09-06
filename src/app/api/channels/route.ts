import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Helper to extract tenant from request
async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

/**
 * GET /api/channels - List all connected social channels for the tenant
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      `SELECT id, platform, channel_identifier, channel_name, ai_active, 
              webhook_verified, quality_rating, created_at, updated_at
       FROM channels 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC;`,
      [auth.tenantId]
    );

    return NextResponse.json({
      channels: res.rows,
    });
  } catch (error: any) {
    console.error('Fetch channels error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/channels - Connect or update a channel
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { platform, channel_identifier, channel_name, access_token } = body;

    if (!platform || !channel_identifier || !channel_name) {
      return NextResponse.json(
        { error: 'Platform, channel_identifier, and channel_name are required' },
        { status: 400 }
      );
    }

    const res = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token, ai_active, webhook_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
       ON CONFLICT (platform, channel_identifier) 
       DO UPDATE SET 
         channel_name = EXCLUDED.channel_name,
         access_token = COALESCE(EXCLUDED.access_token, channels.access_token),
         updated_at = NOW()
       RETURNING id, platform, channel_identifier, channel_name, ai_active, webhook_verified;`,
      [auth.tenantId, platform, channel_identifier, channel_name, access_token || 'mock_token']
    );

    return NextResponse.json({
      success: true,
      channel: res.rows[0],
    });
  } catch (error: any) {
    console.error('Save channel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/channels - Toggle AI status or update channel state
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { channelId, ai_active } = body;

    if (!channelId || typeof ai_active !== 'boolean') {
      return NextResponse.json(
        { error: 'Channel ID and ai_active boolean are required' },
        { status: 400 }
      );
    }

    const res = await query(
      `UPDATE channels 
       SET ai_active = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, platform, channel_name, ai_active;`,
      [ai_active, channelId, auth.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      channel: res.rows[0],
    });
  } catch (error: any) {
    console.error('Toggle channel AI error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
