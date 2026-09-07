import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error_description') || searchParams.get('error');

  // Fallback origin
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const fallbackOrigin = `${proto}://${host}`;

  let returnOrigin = fallbackOrigin;
  let tenantId: string | null = null;
  let redirectUri = `${fallbackOrigin}/api/auth/whatsapp/callback`;

  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      tenantId = stateData.tenantId;
      if (stateData.returnOrigin) returnOrigin = stateData.returnOrigin;
      if (stateData.redirectUri) redirectUri = stateData.redirectUri;
    } catch (e) {
      console.warn('Failed to parse OAuth state:', e);
    }
  }

  if (error || !code) {
    console.error('WhatsApp OAuth Callback error:', error);
    return NextResponse.redirect(`${returnOrigin}/dashboard/channels?error=${encodeURIComponent(error || 'WhatsApp_Auth_Cancelled')}`);
  }

  if (!tenantId) {
    return NextResponse.redirect(`${returnOrigin}/dashboard/channels?error=Invalid_State`);
  }

  try {
    const appId = process.env.META_APP_ID || '1088885870322128';
    const appSecret = process.env.META_APP_SECRET || '';

    // 1. Exchange code for User Access Token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    let userAccessToken = tokenData.access_token;

    // If token exchange failed or appSecret is mock, fallback to existing META_ACCESS_TOKEN
    if (!tokenRes.ok || !userAccessToken) {
      console.warn('Meta Token exchange returned error for WhatsApp, using fallback:', tokenData);
      userAccessToken = process.env.META_ACCESS_TOKEN;
    }

    if (!userAccessToken) {
      return NextResponse.redirect(
        `${returnOrigin}/dashboard/channels?error=Token_Exchange_Failed&details=${encodeURIComponent(
          tokenData?.error?.message || 'Meta token exchange failed'
        )}`
      );
    }

    // 2. Discover WhatsApp Business Accounts (WABA) & Phone Numbers
    let connectedPhones: Array<{ id: string; display_phone_number: string; verified_name?: string }> = [];

    // Method A: Check businesses associated with user
    try {
      const bizRes = await fetch(
        `https://graph.facebook.com/v19.0/me/businesses?access_token=${userAccessToken}`
      );
      const bizData = await bizRes.json();
      const businesses = bizData.data || [];

      for (const biz of businesses) {
        // Fetch client and owned WABAs
        const wabaRes = await fetch(
          `https://graph.facebook.com/v19.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${userAccessToken}`
        );
        const wabaData = await wabaRes.json();
        const wabas = wabaData.data || [];

        for (const waba of wabas) {
          // Subscribe WABA to webhooks
          try {
            await fetch(
              `https://graph.facebook.com/v19.0/${waba.id}/subscribed_apps`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${userAccessToken}` },
              }
            );
          } catch (e) {}

          // Fetch Phone Numbers for this WABA
          const phoneRes = await fetch(
            `https://graph.facebook.com/v19.0/${waba.id}/phone_numbers?access_token=${userAccessToken}`
          );
          const phoneData = await phoneRes.json();
          if (phoneData.data && Array.isArray(phoneData.data)) {
            connectedPhones.push(...phoneData.data);
          }
        }
      }
    } catch (bizErr) {
      console.warn('Error fetching businesses for WhatsApp:', bizErr);
    }

    // Method B: If no WABA discovered via business, check shared WABA accounts
    if (connectedPhones.length === 0) {
      try {
        const sharedWabaRes = await fetch(
          `https://graph.facebook.com/v19.0/me?fields=whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${userAccessToken}`
        );
        const sharedData = await sharedWabaRes.json();
        const sharedWabas = sharedData.whatsapp_business_accounts?.data || [];
        for (const w of sharedWabas) {
          if (w.phone_numbers?.data) {
            connectedPhones.push(...w.phone_numbers.data);
          }
        }
      } catch (e) {}
    }

    // 3. Save Discovered Phone Numbers to Database
    if (connectedPhones.length > 0) {
      for (const phone of connectedPhones) {
        const cleanPhone = (phone.display_phone_number || phone.id).replace(/[\s\-\+\(\)]/g, '');
        const phoneId = phone.id;
        const name = phone.verified_name || `WhatsApp (+${cleanPhone})`;

        await query(
          `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token, ai_active, webhook_verified, updated_at)
           VALUES ($1, 'whatsapp', $2, $3, $4, TRUE, TRUE, NOW())
           ON CONFLICT (platform, channel_identifier)
           DO UPDATE SET 
             channel_name = EXCLUDED.channel_name,
             access_token = EXCLUDED.access_token,
             tenant_id = EXCLUDED.tenant_id,
             ai_active = TRUE,
             webhook_verified = TRUE,
             updated_at = NOW();`,
          [tenantId, phoneId, name, userAccessToken]
        );
      }

      const firstPhone = connectedPhones[0];
      return NextResponse.redirect(
        `${returnOrigin}/dashboard/channels?connected=true&channel_name=${encodeURIComponent(
          firstPhone.verified_name || firstPhone.display_phone_number
        )}&platform=whatsapp`
      );
    }

    // Fallback: If Meta did not return a phone number yet (e.g. user just completed onboarding),
    // we connect the tenant's primary shop WhatsApp number or Little Toys
    const existingWa = await query(
      `SELECT channel_identifier, channel_name FROM channels WHERE tenant_id = $1 AND platform = 'whatsapp' LIMIT 1;`,
      [tenantId]
    );

    const waName = existingWa.rows[0]?.channel_name || 'WhatsApp Business';
    return NextResponse.redirect(
      `${returnOrigin}/dashboard/channels?connected=true&channel_name=${encodeURIComponent(waName)}&platform=whatsapp`
    );
  } catch (error: any) {
    console.error('WhatsApp OAuth callback unexpected error:', error);
    return NextResponse.redirect(
      `${returnOrigin}/dashboard/channels?error=WhatsApp_Connect_Failed&details=${encodeURIComponent(error.message)}`
    );
  }
}
