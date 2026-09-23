import { pool } from '../src/lib/db';

async function checkSpecific() {
  const r = await pool.query(
    "SELECT post_id, (reaction_summary->>'total')::int as total, (reaction_summary->>'angry')::int as angry, (reaction_summary->>'love')::int as love, (reaction_summary->>'like')::int as like, message FROM facebook_posts WHERE (reaction_summary->>'angry')::int > 0 ORDER BY (reaction_summary->>'angry')::int DESC;"
  );
  console.log('Posts with Angry Reactions in DB:');
  for (const row of r.rows) {
    console.log(`[Angry: ${row.angry}, Love: ${row.love}, Total: ${row.total}] -> ID: ${row.post_id} -> ${(row.message || '').slice(0, 35)}`);
  }
  await pool.end();
}

checkSpecific().catch(console.error);
