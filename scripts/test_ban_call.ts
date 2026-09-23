import { pool } from '../src/lib/db';

async function testBanParams() {
  const channelRes = await pool.query(
    `SELECT access_token, channel_identifier FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const { access_token, channel_identifier } = channelRes.rows[0];

  // Try calling POST /{page-id}/blocked with a test username/ID like "mamuda.yankatsari"
  // Let's test with user=
  const res1 = await fetch(`https://graph.facebook.com/v19.0/${channel_identifier}/blocked?user=100012345678901&access_token=${access_token}`, {
    method: 'POST'
  });
  console.log('Result with user param:', await res1.json());

  // Let's test with psid=
  const res2 = await fetch(`https://graph.facebook.com/v19.0/${channel_identifier}/blocked?psid=100012345678901&access_token=${access_token}`, {
    method: 'POST'
  });
  console.log('Result with psid param:', await res2.json());

  await pool.end();
}

testBanParams().catch(console.error);
