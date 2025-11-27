import { Queue } from 'bullmq';
import { env } from '@shared/env';
export const jobQueue = new Queue('jobs', { connection: { url: env.REDIS_URL } });
export async function enqueueJob(jobId: string) { await jobQueue.add('process', { jobId }); }