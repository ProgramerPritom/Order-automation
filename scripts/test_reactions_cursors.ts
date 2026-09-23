import { pool } from '../src/lib/db';

async function testCursors() {
  const channelRes = await pool.query(
    `SELECT access_token FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const token = channelRes.rows[0].access_token;
  const targetId = '1374129259109200_122108935551475656';

  // 1. Test fetching with fields=id,name,type and limit=25
  const u1 = `https://graph.facebook.com/v19.0/${targetId}/reactions?fields=id,name,type&limit=25&access_token=${token}`;
  const r1 = await fetch(u1);
  const d1 = await r1.json();
  console.log('--- r1 ---');
  console.log('d1 data length:', d1.data?.length);
  console.log('d1 paging:', d1.paging);

  if (d1.paging?.next) {
    console.log('Fetching next page:', d1.paging.next.replace(token, 'TOKEN_HIDDEN'));
    const rNext = await fetch(d1.paging.next);
    const dNext = await rNext.json();
    console.log('dNext data length:', dNext.data?.length);
    console.log('dNext sample:', dNext.data?.slice(0, 3));
    console.log('dNext paging:', dNext.paging);
  }

  // 2. What if we don't specify fields, or specify type?
  // Let's check `summaryUrl` where angry had paging!
  const summaryUrl = `https://graph.facebook.com/v19.0/${targetId}?fields=reactions.type(ANGRY){id,name,type}&access_token=${token}`;
  const r2 = await fetch(summaryUrl);
  const d2 = await r2.json();
  console.log('--- r2 (reactions.type(ANGRY){id,name,type}) ---');
  console.log('d2:', JSON.stringify(d2));

  // 3. What if we use `/{post-id}/reactions?type=ANGRY` with v19.0 vs v20.0 or without fields?
  const u3 = `https://graph.facebook.com/v19.0/${targetId}/reactions?type=ANGRY&access_token=${token}`;
  const r3 = await fetch(u3);
  const d3 = await r3.json();
  console.log('--- r3 ---');
  console.log('d3 data length:', d3.data?.length);
  console.log('d3 raw:', JSON.stringify(d3));

  await pool.end();
}

testCursors().catch(console.error);
