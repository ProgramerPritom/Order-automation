import { pool } from '../src/lib/db';

async function inspectPostObject() {
  const channelRes = await pool.query(
    `SELECT access_token FROM channels WHERE platform = 'facebook' ORDER BY ai_active DESC LIMIT 1;`
  );
  const token = channelRes.rows[0].access_token;
  const targetId = '1374129259109200_122108935551475656';

  // Check post details
  const postRes = await fetch(`https://graph.facebook.com/v19.0/${targetId}?fields=id,status_type,attachments,permalink_url&access_token=${token}`);
  const postData = await postRes.json();
  console.log('Post Object Data:', JSON.stringify(postData, null, 2));

  // If this post has attachments (like a photo or album or video), reactions might be on the photo/media node!
  if (postData.attachments?.data) {
    for (const att of postData.attachments.data) {
      console.log('Attachment target:', att.target);
      if (att.target?.id) {
        const attReactionsRes = await fetch(`https://graph.facebook.com/v19.0/${att.target.id}/reactions?access_token=${token}`);
        const attReactions = await attReactionsRes.json();
        console.log(`Reactions on target ${att.target.id}:`, attReactions);
      }
    }
  }

  await pool.end();
}

inspectPostObject().catch(console.error);
