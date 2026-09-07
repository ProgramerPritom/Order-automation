import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Helper to extract tenant from request (supports Authorization header & cookies)
async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token =
    (authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null')
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return null;
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

    let cleanIdentifier = channel_identifier.trim();
    if (platform === 'whatsapp') {
      // Auto-normalize phone numbers (e.g. 017... -> 88017...)
      cleanIdentifier = cleanIdentifier.replace(/[\s\-\+\(\)]/g, '');
      if (cleanIdentifier.startsWith('01')) {
        cleanIdentifier = '88' + cleanIdentifier;
      }
    }

    const finalToken =
      access_token?.trim() ||
      process.env.META_ACCESS_TOKEN ||
      process.env.META_PAGE_ACCESS_TOKEN ||
      'whatsapp_managed_token';

    const res = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token, ai_active, webhook_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
       ON CONFLICT (platform, channel_identifier) 
       DO UPDATE SET 
         channel_name = EXCLUDED.channel_name,
         access_token = COALESCE(EXCLUDED.access_token, channels.access_token),
         updated_at = NOW()
       RETURNING id, platform, channel_identifier, channel_name, ai_active, webhook_verified;`,
      [auth.tenantId, platform, cleanIdentifier, channel_name, finalToken]
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
      return NextResponse.json({ error: 'চ্যানেলটি খুঁজে পাওয়া যায়নি।' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: ai_active
        ? `"${res.rows[0].channel_name}"-এর এআই সফলভাবে চালু করা হয়েছে!`
        : `"${res.rows[0].channel_name}"-এর এআই সম্পূর্ণ বন্ধ (OFF) করা হয়েছে।`,
      channel: res.rows[0],
    });
  } catch (error: any) {
    console.error('Toggle channel AI error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/channels - Disconnect / delete a channel
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    // 1. Detach orders so they remain intact in store records
    await query(
      `UPDATE orders SET channel_id = NULL WHERE channel_id = $1 AND tenant_id = $2;`,
      [channelId, auth.tenantId]
    );

    // 2. Cascade cleanup related comments, posts, and conversations
    await query(
      `DELETE FROM facebook_comments WHERE channel_id = $1 AND tenant_id = $2;`,
      [channelId, auth.tenantId]
    );

    await query(
      `DELETE FROM facebook_posts WHERE channel_id = $1 AND tenant_id = $2;`,
      [channelId, auth.tenantId]
    );

    await query(
      `DELETE FROM conversations WHERE channel_id = $1 AND tenant_id = $2;`,
      [channelId, auth.tenantId]
    );

    // 3. Delete the channel itself
    const res = await query(
      `DELETE FROM channels 
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, platform, channel_name;`,
      [channelId, auth.tenantId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'চ্যানেলটি খুঁজে পাওয়া যায়নি।' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `"${res.rows[0].channel_name}" সফলভাবে সংযোগ বিচ্ছিন্ন (Disconnected) করা হয়েছে।`,
      deleted: res.rows[0],
    });
  } catch (error: any) {
    console.error('Delete channel error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

