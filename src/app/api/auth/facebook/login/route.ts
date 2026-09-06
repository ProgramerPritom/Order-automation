import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token =
    searchParams.get('token') ||
    req.cookies.get('accessToken')?.value ||
    req.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=token_required', req.url));
  }

  const auth = await verifyAccessToken(token);
  if (!auth) {
    return NextResponse.redirect(new URL('/login?error=session_expired', req.url));
  }

  const appId = process.env.META_APP_ID || '1088885870322128';
  
  // Dynamically resolve active origin (port 3000, 3001, dev tunnel, etc.)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const requestOrigin = `${proto}://${host}`;

  // If running locally, strictly use the user's active port/origin
  const appUrl = process.env.APP_URL && !process.env.APP_URL.includes('localhost')
    ? process.env.APP_URL
    : requestOrigin;
  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  // Scopes for Messenger, Pages, Posts, and Comments
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_messaging',
    'pages_manage_posts',
  ].join(',');

  // Encode tenantId, returnOrigin, and redirectUri in state parameter
  const state = Buffer.from(
    JSON.stringify({
      tenantId: auth.tenantId,
      returnOrigin: requestOrigin,
      redirectUri,
      time: Date.now(),
    })
  ).toString('base64');

  const fbAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`;

  return NextResponse.redirect(fbAuthUrl);
}
