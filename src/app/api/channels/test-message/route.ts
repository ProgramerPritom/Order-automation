import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { processCustomerMessage } from '@/lib/ai-sales-engine';

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

/**
 * POST /api/channels/test-message - Simulate an incoming customer message on WhatsApp/Facebook
 * Allows merchants to test their AI Sales Agent instantly from the dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { channelId, messageText, customerPhone, customerName } = body;

    if (!channelId || !messageText) {
      return NextResponse.json(
        { error: 'channelId and messageText are required' },
        { status: 400 }
      );
    }

    // Verify channel belongs to this tenant
    const channelRes = await query(
      `SELECT id, platform, channel_identifier, channel_name, access_token, ai_active
       FROM channels
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1;`,
      [channelId, auth.tenantId]
    );

    if (channelRes.rows.length === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const channel = channelRes.rows[0];
    const normalizedPhone = (customerPhone || '8801700000000').replace(/[\s\-\+\(\)]/g, '');

    const result = await processCustomerMessage({
      tenantId: auth.tenantId,
      channelId: channel.id,
      platform: channel.platform as any,
      pageId: channel.channel_identifier,
      senderId: normalizedPhone,
      customerName: customerName || `WhatsApp Customer (+${normalizedPhone})`,
      messageText,
      accessToken: channel.access_token || 'whatsapp_managed_token',
    });

    return NextResponse.json({
      ...result,
      channel: {
        id: channel.id,
        platform: channel.platform,
        name: channel.channel_name,
      },
    });
  } catch (error: any) {
    console.error('Test message execution error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
