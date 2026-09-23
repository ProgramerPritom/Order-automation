import { query } from './db';

export interface RetentionResult {
  success: boolean;
  retentionDays: number;
  messagesPurged: number;
  conversationsPurged: number;
  tokensPurged: number;
  executedAt: string;
}

/**
 * Execute automated data retention cleanup to comply with Meta Platform Policies & GDPR
 * Deletes or archives chat messages and temporary tokens older than retention policy (e.g. 90 or 180 days)
 */
export async function executeDataRetentionCleanup(
  retentionDays: number = 90,
  tenantId?: string
): Promise<RetentionResult> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  console.log(`🧹 [Data Retention Engine] Purging records older than ${retentionDays} days (before ${cutoffDate.toISOString()})...`);

  let messagesPurged = 0;
  let conversationsPurged = 0;
  let tokensPurged = 0;

  try {
    // 1. Purge old customer & AI messages older than cutoffDate
    if (tenantId) {
      const msgRes = await query(
        `DELETE FROM messages 
         WHERE conversation_id IN (
           SELECT id FROM conversations WHERE tenant_id = $1
         ) AND created_at < $2;`,
        [tenantId, cutoffDate]
      );
      messagesPurged = msgRes.rowCount || 0;
    } else {
      const msgRes = await query(
        `DELETE FROM messages WHERE created_at < $1;`,
        [cutoffDate]
      );
      messagesPurged = msgRes.rowCount || 0;
    }

    // 2. Purge stale conversations with no recent activity and no messages remaining
    if (tenantId) {
      const convRes = await query(
        `DELETE FROM conversations 
         WHERE tenant_id = $1 
           AND updated_at < $2 
           AND id NOT IN (SELECT DISTINCT conversation_id FROM messages);`,
        [tenantId, cutoffDate]
      );
      conversationsPurged = convRes.rowCount || 0;
    } else {
      const convRes = await query(
        `DELETE FROM conversations 
         WHERE updated_at < $1 
           AND id NOT IN (SELECT DISTINCT conversation_id FROM messages);`,
        [cutoffDate]
      );
      conversationsPurged = convRes.rowCount || 0;
    }

    // 3. Purge revoked or expired refresh tokens older than 30 days
    const tokenCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tokRes = await query(
      `DELETE FROM refresh_tokens WHERE (revoked = TRUE OR expires_at < NOW()) AND created_at < $1;`,
      [tokenCutoff]
    );
    tokensPurged = tokRes.rowCount || 0;

    // 4. Record audit log
    await query(
      `INSERT INTO data_retention_logs (
        tenant_id, retention_policy_days, messages_purged, conversations_purged, logs_purged, status
      ) VALUES ($1, $2, $3, $4, $5, 'completed');`,
      [tenantId || null, retentionDays, messagesPurged, conversationsPurged, tokensPurged]
    );

    console.log(`✅ [Data Retention Completed] Purged ${messagesPurged} messages, ${conversationsPurged} empty conversations, ${tokensPurged} expired tokens.`);

    return {
      success: true,
      retentionDays,
      messagesPurged,
      conversationsPurged,
      tokensPurged,
      executedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('Data retention error:', error);
    await query(
      `INSERT INTO data_retention_logs (
        tenant_id, retention_policy_days, messages_purged, conversations_purged, logs_purged, status
      ) VALUES ($1, $2, 0, 0, 0, 'failed');`,
      [tenantId || null, retentionDays]
    );
    throw error;
  }
}
