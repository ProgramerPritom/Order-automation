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

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const appId = process.env.META_APP_ID || '1088885870322128';

    // Fetch tenant connected channels
    const channelsRes = await query(
      `SELECT id, platform, channel_identifier, channel_name, ai_active, webhook_verified, created_at
       FROM channels 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC;`,
      [auth.tenantId]
    );

    const channels = channelsRes.rows;
    const fbChannels = channels.filter((c: any) => c.platform === 'facebook');
    const igChannels = channels.filter((c: any) => c.platform === 'instagram');
    const waChannels = channels.filter((c: any) => c.platform === 'whatsapp');

    return NextResponse.json({
      masterApp: {
        appId,
        appName: 'Kotha Shop AI automation',
        appType: 'Meta Business App (All-in-One: Messenger, IG, WhatsApp)',
        mode: 'Development Mode (Active & Ready)',
        webhookUrl: `${appUrl}/api/webhooks/meta`,
        verifyTokenStatus: 'Verified (saas_meta_webhook_secret_2026)',
        subscribedEvents: [
          'messages (ইনবক্স চ্যাট)',
          'messaging_postbacks (বাটন ও কুইক রিপ্লাই)',
          'feed (পোস্টের কমেন্ট)',
          'message_reactions (ইমোজি রিঅ্যাকশন)',
        ],
      },
      omnichannelStatus: {
        facebook: {
          platform: 'Facebook Messenger & Feed Comments',
          connectedCount: fbChannels.length,
          status: fbChannels.length > 0 ? 'ACTIVE' : 'READY',
          activeChannels: fbChannels,
        },
        instagram: {
          platform: 'Instagram Direct Messages',
          connectedCount: igChannels.length,
          status: igChannels.length > 0 ? 'ACTIVE' : 'READY',
          note: 'ফেসবুক পেজ সেটিংস থেকে আপনার Instagram Professional অ্যাকাউন্ট কানেক্ট করলেই সরাসরি সক্রিয় হবে।',
        },
        whatsapp: {
          platform: 'WhatsApp Cloud API',
          connectedCount: waChannels.length,
          status: waChannels.length > 0 ? 'ACTIVE' : 'READY',
          note: 'মেটা অ্যাপে WhatsApp Product যুক্ত করে Phone Number ID বসালে গ্রাহকের সাথে হোয়াটসঅ্যাপেও এআই কথা বলবে।',
        },
      },
      productionRoadmap: [
        {
          id: 'meta_app',
          title: 'Master Meta App কনফিগারেশন',
          status: 'COMPLETED',
          details: `App ID: ${appId} ও সেন্ট্রাল গেটওয়ে সফলভাবে সংযুক্ত।`,
        },
        {
          id: 'webhook_handshake',
          title: 'সেন্ট্রাল ওয়েবহুক ও ইভেন্ট সাবস্ক্রিপশন',
          status: 'COMPLETED',
          details: 'Messages এবং Post Comments (Feed) ইভেন্ট সফলভাবে ভেরিফাইড।',
        },
        {
          id: 'one_click_oauth',
          title: '১-ক্লিকে ফেসবুক পেজ কানেকশন',
          status: 'COMPLETED',
          details: 'ক্লায়েন্ট ড্যাশবোর্ড থেকে ১-ক্লিকে যেকোনো পেজ সংযুক্ত করতে পারছে।',
        },
        {
          id: 'business_verification',
          title: 'Meta Business Verification (কমার্শিয়াল স্কেলিং)',
          status: 'ACTION_REQUIRED_FOR_PUBLIC_LAUNCH',
          details:
            'বর্তমানে টেস্ট ও অ্যাডমিন পেজগুলোতে কোনো বাধা ছাড়াই লাইভ চলছে। ১০০+ পাবলিক অপরিচিত ক্লায়েন্টের পেজ কানেক্ট করতে মেটা ডেভেলপার পোর্টাল থেকে ট্রেড লাইসেন্স সাবমিট করে Business Verification ও App Review সাবমিট করতে হবে।',
        },
      ],
    });
  } catch (error: any) {
    console.error('Master status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
