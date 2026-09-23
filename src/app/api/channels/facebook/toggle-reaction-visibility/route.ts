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

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or expired session' }, { status: 401 });
    }

    const body = await req.json();
    const { postId, hide } = body;

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const res = await query(
      `UPDATE facebook_posts 
       SET hide_reactions_internal = $1, updated_at = NOW() 
       WHERE tenant_id = $2 AND post_id = $3
       RETURNING id, post_id, hide_reactions_internal;`,
      [!!hide, auth.tenantId, postId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'পোস্ট খুঁজে পাওয়া যায়নি' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: hide
        ? 'এই পোস্টের রিঅ্যাকশন কাউন্ট পাবলিক ডিসপ্লেতে লুকানো হয়েছে (Hidden)'
        : 'এই পোস্টের রিঅ্যাকশন কাউন্ট ডিসপ্লে দৃশ্যমান করা হয়েছে (Visible)',
      post: res.rows[0],
    });
  } catch (err: any) {
    console.error('Toggle reaction visibility error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
