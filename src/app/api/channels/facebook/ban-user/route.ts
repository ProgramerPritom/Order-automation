import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

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

// GET: Retrieve list of blocked users
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const res = await query(
      `SELECT id, facebook_user_id, user_name, post_id, reason, blocked_at 
       FROM page_blocked_users 
       WHERE tenant_id = $1 
       ORDER BY blocked_at DESC LIMIT 100;`,
      [auth.tenantId]
    );

    return NextResponse.json({ blockedUsers: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Ban/Block one or multiple users from Facebook page
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const body = await req.json();
    const { users, postId, reason = 'angry_bot' } = body;

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'ব্যান করার জন্য কোনো ইউজার সিলেক্ট করা হয়নি।' }, { status: 400 });
    }

    // 1. Fetch channel credentials
    const channelRes = await query(
      `SELECT id, channel_identifier, channel_name, access_token 
       FROM channels 
       WHERE tenant_id = $1 AND platform = 'facebook'
       ORDER BY ai_active DESC, updated_at DESC LIMIT 1;`,
      [auth.tenantId]
    );

    if (channelRes.rows.length === 0) {
      return NextResponse.json({ error: 'ফেসবুক চ্যানেল পাওয়া যায়নি।' }, { status: 400 });
    }

    const channel = channelRes.rows[0];
    const pageId = channel.channel_identifier;
    const pageToken = channel.access_token;

    if (!pageToken) {
      return NextResponse.json({ error: 'পেজ অ্যাক্সেস টোকেন পাওয়া যায়নি।' }, { status: 400 });
    }

    let bannedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const u of users) {
      const psid = u.id;
      const userName = u.name || 'Facebook User';

      try {
        // Meta Graph API block call: POST /{page-id}/blocked?psid={psid}
        const blockUrl = `https://graph.facebook.com/v19.0/${pageId}/blocked?psid=${encodeURIComponent(
          psid
        )}&access_token=${pageToken}`;

        const fbRes = await fetch(blockUrl, { method: 'POST' });
        const fbData = await fbRes.json();

        // If success or already blocked
        if (fbRes.ok || fbData?.success || fbData?.error?.code === 100) {
          // Record in DB
          await query(
            `INSERT INTO page_blocked_users (tenant_id, channel_id, facebook_user_id, user_name, post_id, reason, blocked_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (tenant_id, facebook_user_id) 
             DO UPDATE SET user_name = EXCLUDED.user_name, blocked_at = NOW();`,
            [auth.tenantId, channel.id, psid, userName, postId || null, reason]
          );
          bannedCount++;
        } else {
          console.warn(`Failed to ban user ${psid}:`, fbData);
          failedCount++;
          errors.push(fbData?.error?.message || `User ${psid} could not be blocked`);
        }
      } catch (userErr: any) {
        console.error(`Error banning user ${psid}:`, userErr);
        failedCount++;
        errors.push(userErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${bannedCount} টি অ্যাকাউন্ট সফলভাবে পেজ থেকে ব্লক/ব্যান করা হয়েছে।`,
      bannedCount,
      failedCount,
      errors: errors.slice(0, 5),
    });
  } catch (err: any) {
    console.error('Ban route error:', err);
    return NextResponse.json({ error: err.message || 'সার্ভার সমস্যা' }, { status: 500 });
  }
}

// DELETE: Unblock a user
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const psid = searchParams.get('userId');

    if (!psid) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const channelRes = await query(
      `SELECT id, channel_identifier, access_token 
       FROM channels 
       WHERE tenant_id = $1 AND platform = 'facebook'
       ORDER BY ai_active DESC, updated_at DESC LIMIT 1;`,
      [auth.tenantId]
    );

    if (channelRes.rows.length > 0) {
      const channel = channelRes.rows[0];
      const unblockUrl = `https://graph.facebook.com/v19.0/${channel.channel_identifier}/blocked?psid=${encodeURIComponent(
        psid
      )}&access_token=${channel.access_token}`;
      await fetch(unblockUrl, { method: 'DELETE' }).catch((e) => console.warn('Meta unblock error:', e));
    }

    await query(
      `DELETE FROM page_blocked_users WHERE tenant_id = $1 AND facebook_user_id = $2;`,
      [auth.tenantId, psid]
    );

    return NextResponse.json({ success: true, message: 'ইউজার আনব্লক করা হয়েছে।' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
