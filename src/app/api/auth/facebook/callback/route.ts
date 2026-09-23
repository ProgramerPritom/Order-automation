import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error_description') || searchParams.get('error');

  // Fallback origin
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const fallbackOrigin = `${proto}://${host}`;

  let returnOrigin = fallbackOrigin;
  let tenantId: string | null = null;
  let redirectUri = `${fallbackOrigin}/api/auth/facebook/callback`;
  let platform = 'facebook';

  if (state) {
    try {
      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_saas_default_2026';
      if (state.includes('.')) {
        const [b64Payload, sig] = state.split('.');
        const expectedSig = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
        
        // Timing-safe verification
        if (
          Buffer.byteLength(sig) === Buffer.byteLength(expectedSig) &&
          crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
        ) {
          const stateData = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));
          tenantId = stateData.tenantId;
          if (stateData.returnOrigin) returnOrigin = stateData.returnOrigin;
          if (stateData.redirectUri) redirectUri = stateData.redirectUri;
          if (stateData.platform) platform = stateData.platform;
        } else {
          console.warn('Invalid OAuth state signature detected');
        }
      } else {
        // Fallback for unsigned legacy states
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        tenantId = stateData.tenantId;
        if (stateData.returnOrigin) returnOrigin = stateData.returnOrigin;
        if (stateData.redirectUri) redirectUri = stateData.redirectUri;
        if (stateData.platform) platform = stateData.platform;
      }
    } catch (e) {
      console.warn('Failed to parse OAuth state:', e);
    }
  }

  if (error || !code) {
    console.error('Meta OAuth Callback error:', error);
    return NextResponse.redirect(`${returnOrigin}/dashboard/channels?error=${encodeURIComponent(error || 'Auth_Cancelled')}`);
  }

  if (!tenantId) {
    return NextResponse.redirect(`${returnOrigin}/dashboard/channels?error=Invalid_State`);
  }

  try {
    const isWhatsApp = platform === 'whatsapp';
    const appId = isWhatsApp
      ? process.env.META_WHATSAPP_APP_ID || process.env.WHATSAPP_APP_ID || process.env.META_APP_ID || '1104583752103042'
      : process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '1088885870322128';

    const appSecret = isWhatsApp
      ? process.env.META_WHATSAPP_APP_SECRET || process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || ''
      : process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';

    // 1. Exchange code for User Access Token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    // =========================================================================
    // CASE A: WHATSAPP CLOUD API ONBOARDING
    // =========================================================================
    if (platform === 'whatsapp') {
      if (!tokenRes.ok || !tokenData.access_token) {
        const metaErrMsg = tokenData?.error?.message || 'Meta OAuth token exchange failed';
        console.warn('Meta Token exchange returned error for WhatsApp:', tokenData);
        return NextResponse.redirect(
          `${returnOrigin}/dashboard/channels?error=Token_Exchange_Failed&details=${encodeURIComponent(
            `মেটা টোকেন এক্সচেঞ্জ ব্যর্থ হয়েছে (${metaErrMsg})। অনুগ্রহ করে অ্যাপ ক্রেডেনশিয়াল বা রিডাইরেক্ট ইউআরআই সেটিংস পরীক্ষা করুন।`
          )}&platform=whatsapp`
        );
      }

      const userAccessToken = tokenData.access_token;
      let connectedPhones: Array<{ id: string; display_phone_number: string; verified_name?: string }> = [];

      // 1. Search owned WABAs through businesses
      try {
        const bizRes = await fetch(
          `https://graph.facebook.com/v19.0/me/businesses?access_token=${userAccessToken}`
        );
        const bizData = await bizRes.json();
        const businesses = bizData.data || [];

        for (const biz of businesses) {
          const wabaRes = await fetch(
            `https://graph.facebook.com/v19.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${userAccessToken}`
          );
          const wabaData = await wabaRes.json();
          const wabas = wabaData.data || [];

          for (const waba of wabas) {
            try {
              await fetch(`https://graph.facebook.com/v19.0/${waba.id}/subscribed_apps`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${userAccessToken}` },
              });
            } catch (e) {}

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

      // 2. Search direct whatsapp_business_accounts
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

      // 3. Upsert discovered WhatsApp channels
      if (connectedPhones.length === 0) {
        return NextResponse.redirect(
          `${returnOrigin}/dashboard/channels?error=No_WhatsApp_Account_Found&details=${encodeURIComponent(
            'আপনার মেটা অ্যাকাউন্টে কোনো অনুমোদিত বা ভেরিফায়েড হোয়াটসঅ্যাপ বিজনেস অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে মেটা বিজনেস ম্যানেজারে হোয়াটসঅ্যাপ নম্বর যুক্ত করে আবার চেষ্টা করুন।'
          )}&platform=whatsapp`
        );
      }

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

    // =========================================================================
    // CASE B: FACEBOOK PAGES ONBOARDING
    // =========================================================================

    if (!tokenRes.ok || !tokenData.access_token) {
      const metaErrMsg = tokenData?.error?.message || 'Meta token exchange failed';
      console.warn('Meta Token exchange returned error:', tokenData);
      return NextResponse.redirect(
        `${returnOrigin}/dashboard/channels?error=Token_Exchange_Failed&details=${encodeURIComponent(
          `মেটা টোকেন এক্সচেঞ্জ ব্যর্থ হয়েছে (${metaErrMsg})। অনুগ্রহ করে ভেরিফাই করুন META_APP_SECRET সঠিক আছে কিনা এবং মেটা ড্যাশবোর্ডে ভ্যালিড রিডাইরেক্ট ইউআরআই সেভ করা হয়েছে কিনা।`
        )}&platform=facebook`
      );
    }

    const userAccessToken = tokenData.access_token;

    // 2. Fetch all Facebook Pages managed by user
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}`
    );
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${returnOrigin}/dashboard/channels?error=No_Pages_Found&details=${encodeURIComponent(
          'আপনার ফেসবুক অ্যাকাউন্টে কোনো পেজ পাওয়া যায়নি অথবা অথোরাইজেশন ডায়ালগে কোনো পেজের পারমিশন সিলেক্ট করা হয়নি।'
        )}&platform=facebook`
      );
    }

    // 3. Subscribe each page and save in channels
    for (const page of pages) {
      const pageId = page.id;
      const pageName = page.name;
      const pageAccessToken = page.access_token;

      // Subscribe page to webhooks
      try {
        await fetch(
          `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed,message_reactions&access_token=${pageAccessToken}`,
          { method: 'POST' }
        );
      } catch (subErr) {
        console.warn(`Could not subscribe page ${pageName}:`, subErr);
      }

      // Upsert into channels table
      await query(
        `INSERT INTO channels (tenant_id, platform, channel_identifier, channel_name, access_token, ai_active, webhook_verified, updated_at)
         VALUES ($1, 'facebook', $2, $3, $4, TRUE, TRUE, NOW())
         ON CONFLICT (platform, channel_identifier)
         DO UPDATE SET 
           channel_name = EXCLUDED.channel_name,
           access_token = EXCLUDED.access_token,
           tenant_id = EXCLUDED.tenant_id,
           ai_active = TRUE,
           webhook_verified = TRUE,
           updated_at = NOW();`,
        [tenantId, pageId, pageName, pageAccessToken]
      );
    }

    const pageNames = pages.map((p: any) => p.name).join(', ');
    return NextResponse.redirect(
      `${returnOrigin}/dashboard/channels?connected=true&channel_name=${encodeURIComponent(
        pageNames
      )}&count=${pages.length}&platform=facebook`
    );
  } catch (err: any) {
    console.error('Facebook OAuth Callback exception:', err);
    return NextResponse.redirect(
      `${returnOrigin}/dashboard/channels?error=OAuth_Exception&details=${encodeURIComponent(
        err.message || 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।'
      )}&platform=facebook`
    );
  }
}
