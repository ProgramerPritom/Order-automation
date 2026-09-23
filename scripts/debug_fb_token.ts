import { pool } from '../src/lib/db';

async function debugChannelToken() {
  const r = await pool.query(
    `SELECT id, channel_identifier, channel_name, platform, access_token 
     FROM channels 
     WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const ch = r.rows[0];
  console.log('Channel ID:', ch.id);
  console.log('Page ID:', ch.channel_identifier);
  console.log('Page Name:', ch.channel_name);

  // Check what kind of token this is via Graph API /me
  const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${ch.access_token}`);
  const meData = await meRes.json();
  console.log('/me result:', meData);

  // If this token is a Page Access Token, /me will return the Page's ID and Name!
  // If this token is a User Access Token, /me will return the User's Name (e.g. Pritom)!
  // And if it is a User token, /{post-id}/reactions will NOT return page reactors!

  // Also check debug_token
  const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${ch.access_token}&access_token=${ch.access_token}`);
  const debugData = await debugRes.json();
  console.log('/debug_token result:', JSON.stringify(debugData, null, 2));

  await pool.end();
}

debugChannelToken().catch(console.error);
