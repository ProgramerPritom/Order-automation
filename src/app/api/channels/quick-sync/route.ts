import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token =
      (authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null')
        ? authHeader.split(' ')[1]
        : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const auth = await verifyAccessToken(token);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const pageId = '1374129259109200';
    const pageName = 'Little Joys';
    const accessToken =
      process.env.META_ACCESS_TOKEN ||
      'EAAPeVfZBAYdABSQ1W0BZC969wv7ezOumILyfpvh6t1XD4REAUIkuTZBQ9wJClEZARxr0lnhEzTZCfoNwuyiEC89tulVSpsZCggbLCROA5FbBOjfILN8c7m2DhHTvrBRFImptZCwdDrTktNSi97BQEkW63YG3IUpl7g84UPCTBgZCpegRZCO44KDoJilFFEnHQeC7ERyL5SgZDZD';

    const res = await query(
      `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token, ai_active, webhook_verified, updated_at)
       VALUES ($1, 'facebook', $2, $3, $4, TRUE, TRUE, NOW())
       ON CONFLICT (platform, channel_identifier)
       DO UPDATE SET 
         channel_name = EXCLUDED.channel_name,
         access_token = EXCLUDED.access_token,
         tenant_id = EXCLUDED.tenant_id,
         ai_active = TRUE,
         webhook_verified = TRUE,
         updated_at = NOW()
       RETURNING id, platform, channel_identifier, channel_name, ai_active, webhook_verified;`,
      [auth.tenantId, pageId, pageName, accessToken]
    );

    return NextResponse.json({
      success: true,
      message: 'Little Joys ফেসবুক পেজ সফলভাবে কানেক্ট ও এআই সক্রিয় করা হয়েছে!',
      channel: res.rows[0],
    });
  } catch (error: any) {
    console.error('Quick sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
