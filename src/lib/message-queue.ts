import { saasRedis } from './redis';
import { processCustomerMessage } from './ai-sales-engine';
import { processFacebookComment } from './ai-comment-engine';

export interface QueueJob {
  id: string;
  type: 'customer_message' | 'facebook_comment';
  payload: any;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  lastError?: string;
}

const QUEUE_KEY = 'queue:incoming_messages';
const LOCK_KEY = 'lock:queue_worker';
const DLQ_KEY = 'dlq:failed_jobs';

/**
 * Enqueue a new webhook event into Redis Queue
 */
export async function enqueueWebhookJob(
  type: 'customer_message' | 'facebook_comment',
  payload: any
): Promise<string> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job: QueueJob = {
    id: jobId,
    type,
    payload,
    attempts: 0,
    maxAttempts: 3,
    createdAt: Date.now(),
    status: 'queued',
  };

  try {
    // 1. Store job details in Redis (TTL 24 hours)
    await saasRedis.set(`job:${jobId}`, job, { ex: 86400 });

    // 2. Push Job ID into FIFO Queue
    await saasRedis.lpush(QUEUE_KEY, jobId);
    console.log(`📥 [Queue Producer] Job ${jobId} (${type}) enqueued. Triggering consumer...`);

    // 3. Asynchronously trigger worker without blocking the webhook response
    triggerQueueWorker().catch((err) => {
      console.warn('[Queue Worker Trigger Warning]:', err.message);
    });

    return jobId;
  } catch (err: any) {
    console.error('Failed to enqueue job in Redis:', err);
    // Fallback: If Redis is temporarily unreachable, process immediately in memory
    executeJobDirectly(job).catch(() => {});
    return jobId;
  }
}

/**
 * Lightweight Concurrent Queue Worker Consumer
 */
let isWorkerRunning = false;

export async function triggerQueueWorker() {
  if (isWorkerRunning) return;

  isWorkerRunning = true;

  try {
    while (true) {
      // Pop oldest job ID from right of list (FIFO)
      const jobId = await saasRedis.rpop<string>(QUEUE_KEY);
      if (!jobId) {
        break; // Queue is empty, exit loop
      }

      // Fetch job payload
      const job = await saasRedis.get<QueueJob>(`job:${jobId}`);
      if (!job) continue;

      job.status = 'processing';
      job.attempts += 1;
      await saasRedis.set(`job:${jobId}`, job, { ex: 86400 });

      console.log(`⚙️ [Queue Consumer] Processing job ${jobId} (Attempt ${job.attempts}/${job.maxAttempts})...`);

      const success = await executeJobDirectly(job);

      if (success) {
        job.status = 'completed';
        await saasRedis.set(`job:${jobId}`, job, { ex: 3600 });
        console.log(`✅ [Queue Consumer] Job ${jobId} successfully finished.`);
      } else {
        // Retry logic with exponential backoff
        if (job.attempts < job.maxAttempts) {
          console.warn(`⚠️ [Queue Retry] Job ${jobId} failed. Re-queuing for attempt ${job.attempts + 1}...`);
          job.status = 'queued';
          await saasRedis.set(`job:${jobId}`, job, { ex: 86400 });
          // Delay before re-queue
          await new Promise((resolve) => setTimeout(resolve, job.attempts * 1000));
          await saasRedis.lpush(QUEUE_KEY, jobId);
        } else {
          // Send to Dead Letter Queue (DLQ)
          job.status = 'failed';
          await saasRedis.set(`job:${jobId}`, job, { ex: 86400 * 7 });
          await saasRedis.lpush(DLQ_KEY, jobId);
          console.error(`🚨 [DLQ Alert] Job ${jobId} exhausted all ${job.maxAttempts} attempts. Sent to DLQ.`);
        }
      }
    }
  } catch (err: any) {
    console.error('[Queue Worker Loop Error]:', err);
  } finally {
    isWorkerRunning = false;
  }
}

/**
 * Execute job handler directly
 */
async function executeJobDirectly(job: QueueJob): Promise<boolean> {
  try {
    if (job.type === 'customer_message') {
      const result = await processCustomerMessage(job.payload);
      return !!result.success;
    } else if (job.type === 'facebook_comment') {
      const result = await processFacebookComment(job.payload);
      return !!result.success;
    }
    return true;
  } catch (err: any) {
    job.lastError = err.message;
    console.error(`Execution error for job ${job.id}:`, err.message);
    return false;
  }
}

/**
 * Inspect live queue metrics for admin diagnostics
 */
export async function getQueueMetrics() {
  try {
    const queueLength = await saasRedis.llen(QUEUE_KEY);
    const dlqLength = await saasRedis.llen(DLQ_KEY);
    return {
      status: 'healthy',
      queueLength: queueLength || 0,
      dlqCount: dlqLength || 0,
      isWorkerActive: isWorkerRunning,
    };
  } catch (err: any) {
    return {
      status: 'degraded',
      queueLength: 0,
      dlqCount: 0,
      isWorkerActive: false,
      error: err.message,
    };
  }
}
