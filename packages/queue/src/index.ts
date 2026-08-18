import { Queue, Worker, type Job, type Processor, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@soie/config";

/** The queues of the platform (Architecture Phase 1.9). One per nature of work
 * so IA load scales independently of CRUD. */
// BullMQ forbids ":" in queue names (it is the Redis key separator), so use "-".
export const QUEUES = {
  orchestrate: "ai-orchestrate",
  agent: "ai-agent",
  connector: "connect",
  embedding: "ai-embed",
  export: "export",
  email: "email",
  billing: "billing",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** BullMQ needs a Redis connection with maxRetriesPerRequest disabled.
 * Throws if REDIS_URL is unset — callers in inline-jobs mode must not reach here. */
export function createConnection(): Redis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not set — queue/worker require Redis (inline mode should not call this)");
  }
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: createConnection(), defaultJobOptions: DEFAULT_JOB_OPTS });
    queues.set(name, q);
  }
  return q;
}

/** Enqueue a job. Pass a stable jobId for idempotency (dedup). */
export async function enqueue<T>(
  name: QueueName,
  payload: T,
  opts?: JobsOptions & { jobId?: string },
): Promise<string> {
  const job = await getQueue(name).add(name, payload, opts);
  return job.id ?? "";
}

/** Register a worker for a queue. Concurrency defaults per queue nature. */
export function registerWorker<T = unknown, R = unknown>(
  name: QueueName,
  processor: Processor<T, R>,
  concurrency = 5,
): Worker<T, R> {
  return new Worker<T, R>(name, processor, {
    connection: createConnection(),
    concurrency,
  });
}

export type { Job };
