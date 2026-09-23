import { pool } from '../src/lib/db';

async function testBanUser() {
  const channelRes = await pool.query(
    `SELECT access_token, channel_identifier FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const { access_token, channel_identifier } = channelRes.rows[0];

  // Let's test what happens when calling /{page-id}/blocked with different params
  // 1. with user parameter (numeric UID or username)
  // 2. with psid parameter
  console.log('Testing block endpoint for page:', channel_identifier);

  const testId = '4009642566006086'; // Pritom's user id from debug_token or a test ID
  const testUrl = `https://graph.facebook.com/v19.0/${channel_identifier}/blocked`;

  // Test GET /{page-id}/blocked
  const getRes = await fetch(`${testUrl}?access_token=${access_token}`);
  const getData = await getRes.json();
  console.log('Current blocked users on page:', getData);

  await pool.end();
}

testBanUser().catch(console.error);
