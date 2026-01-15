"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobQueue = void 0;
exports.enqueueJob = enqueueJob;
const bullmq_1 = require("bullmq");
const env_1 = require("@shared/env");
exports.jobQueue = new bullmq_1.Queue('jobs', { connection: { url: env_1.env.REDIS_URL } });
async function enqueueJob(jobId) { await exports.jobQueue.add('process', { jobId }); }
