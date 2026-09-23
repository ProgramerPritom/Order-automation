import { pool } from '../src/lib/db';

async function testLive() {
  const channelRes = await pool.query(
    `SELECT id, channel_identifier, channel_name, access_token, tenant_id 
     FROM channels 
     WHERE platform = 'facebook' 
     ORDER BY ai_active DESC, updated_at DESC LIMIT 1;`
  );

  if (channelRes.rows.length === 0) {
    console.log('No channel found');
    return;
  }

  const channel = channelRes.rows[0];
  console.log('Channel:', channel.channel_name, channel.channel_identifier);

  // Get the latest post
  const postsRes = await pool.query(
    `SELECT post_id, message FROM facebook_posts 
     WHERE tenant_id = $1 
     ORDER BY created_time DESC LIMIT 5;`,
    [channel.tenant_id]
  );

  console.log('Recent posts in DB:');
  for (const p of postsRes.rows) {
    console.log(p.post_id, (p.message || '').slice(0, 40));
  }

  const postWithAngry = await pool.query(
    `SELECT post_id, message FROM facebook_posts 
     WHERE post_id LIKE '%122108935551475656%' LIMIT 1;`
  );

  let targetId = postWithAngry.rows[0]?.post_id || '1374129259109200_122108935551475656';
  console.log('\nTarget Post ID:', targetId);

  // 1. Try with full ID
  const url1 = `https://graph.facebook.com/v19.0/${targetId}/reactions?fields=id,name,type&limit=100&access_token=${channel.access_token}`;
  console.log('\nFetching url1:', url1.replace(channel.access_token, 'TOKEN_HIDDEN'));
  const res1 = await fetch(url1);
  const data1 = await res1.json();
  console.log('Data1 status:', res1.status);
  console.log('Data1 count:', data1.data?.length);
  if (data1.data && data1.data.length > 0) {
    console.log('Sample reactors:', data1.data.slice(0, 5));
    const angryOnes = data1.data.filter((r: any) => r.type === 'ANGRY');
    console.log('Total angry in list:', angryOnes.length);
  } else {
    console.log('Data1 raw:', JSON.stringify(data1));
  }

  // 2. Also test with just the numeric suffix if full ID returned empty
  const cleanId = targetId.includes('_') ? targetId.split('_')[1] : targetId;
  const url2 = `https://graph.facebook.com/v19.0/${cleanId}/reactions?fields=id,name,type&limit=100&access_token=${channel.access_token}`;
  console.log('\nFetching url2 (cleanId):', url2.replace(channel.access_token, 'TOKEN_HIDDEN'));
  const res2 = await fetch(url2);
  const data2 = await res2.json();
  console.log('Data2 status:', res2.status);
  console.log('Data2 count:', data2.data?.length);
  if (data2.data && data2.data.length > 0) {
    console.log('Sample reactors cleanId:', data2.data.slice(0, 5));
  } else {
    console.log('Data2 raw:', JSON.stringify(data2));
  }

  // Summary
  const summaryUrl = `https://graph.facebook.com/v19.0/${targetId}?fields=reactions.type(LIKE).summary(total_count).as(like),reactions.type(LOVE).summary(total_count).as(love),reactions.type(ANGRY).summary(total_count).as(angry)&access_token=${channel.access_token}`;
  const sRes = await fetch(summaryUrl);
  const sData = await sRes.json();
  console.log('\nSummary Data:', JSON.stringify(sData));

  await pool.end();
}

testLive().catch(console.error);
