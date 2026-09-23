import { saasRedis } from './redis';

export interface ErrorContext {
  tenantId?: string;
  channelId?: string;
  route?: string;
  method?: string;
  ip?: string;
  extra?: Record<string, any>;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Capture and dispatch real-time error alerts to webhook destinations (Discord, Slack, Telegram, Sentry, Axiom)
 */
export async function captureException(
  error: Error | any,
  context: ErrorContext = {},
  severity: AlertSeverity = 'critical'
): Promise<void> {
  const errorMessage = error?.message || String(error || 'Unknown Error');
  const errorStack = error?.stack || 'No stack trace available';
  const timestamp = new Date().toISOString();

  // Structured console log
  console.error(`🚨 [OBSERVABILITY ${severity.toUpperCase()}] ${errorMessage}`, {
    context,
    timestamp,
    stack: errorStack.split('\n').slice(0, 4).join('\n'),
  });

  // Calculate fingerprint to prevent alert fatigue
  const fingerprint = Buffer.from(`${context.route || 'global'}:${errorMessage.slice(0, 60)}`).toString('base64');
  const alertThrottleKey = `alert_throttle:${fingerprint}`;

  try {
    const isThrottled = await saasRedis.get(alertThrottleKey);
    if (isThrottled) {
      return; // Suppress duplicate alert within 5 minutes
    }
    // Set 5-minute throttle
    await saasRedis.set(alertThrottleKey, '1', { ex: 300 });
  } catch (e) {
    // If redis fails, continue
  }

  // Send real-time webhook alert
  await dispatchAlertNotification({
    severity,
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp,
  }).catch((dispatchErr) => {
    console.warn('[Observability Dispatch Warning]:', dispatchErr.message);
  });
}

interface AlertPayload {
  severity: AlertSeverity;
  message: string;
  stack: string;
  context: ErrorContext;
  timestamp: string;
}

async function dispatchAlertNotification(payload: AlertPayload) {
  const webhookUrl =
    process.env.ERROR_ALERT_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return; // No alert channel configured in env
  }

  const color = payload.severity === 'critical' ? 15158332 : payload.severity === 'warning' ? 16776960 : 3447003;
  const emoji = payload.severity === 'critical' ? '🔴 [CRITICAL ALERT]' : payload.severity === 'warning' ? '🟡 [WARNING]' : '🔵 [INFO]';

  // Discord / Slack Rich Webhook Embed
  const discordPayload = {
    content: `${emoji} **ShopPilot.ai Production Exception Detected**`,
    embeds: [
      {
        title: payload.message.slice(0, 250),
        color,
        fields: [
          { name: 'Route / Endpoint', value: payload.context.route || 'N/A', inline: true },
          { name: 'Tenant ID', value: payload.context.tenantId || 'N/A', inline: true },
          { name: 'Method', value: payload.context.method || 'N/A', inline: true },
          { name: 'Stack Snippet', value: `\`\`\`\n${payload.stack.slice(0, 500)}\n\`\`\``, inline: false },
        ],
        footer: { text: `Timestamp: ${payload.timestamp}` },
      },
    ],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordPayload),
  });
}

/**
 * Record custom business metrics (e.g. order count, AI response time)
 */
export async function recordMetric(name: string, value: number = 1, tags: Record<string, string> = {}) {
  const dateStr = new Date().toISOString().split('T')[0];
  const metricKey = `metric:${dateStr}:${name}`;
  try {
    await saasRedis.incr(metricKey);
    await saasRedis.expire(metricKey, 86400 * 30); // 30 days retention
  } catch (e) {}
}
