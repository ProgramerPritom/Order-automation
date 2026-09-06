import 'dotenv/config';
import { syncAndProcessUnrepliedFacebookComments } from '../src/lib/ai-comment-engine';

async function testAutoHealer() {
  const tenantId = '58818813-da76-4450-a8f9-494fb46ca3d7';
  console.log('Running auto-healer comment sync...');
  const count = await syncAndProcessUnrepliedFacebookComments(tenantId);
  console.log(`Auto-healer finished! Successfully replied to ${count} new comments.`);
  process.exit(0);
}

testAutoHealer().catch((e) => {
  console.error(e);
  process.exit(1);
});
