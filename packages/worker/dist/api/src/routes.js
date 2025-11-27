"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("@shared/prisma");
const storage_1 = require("@shared/utils/storage");
const enqueue_1 = require("./queue/enqueue");
const qr_1 = require("../../shared/src/utils/qr");
const email_1 = require("@shared/utils/email");
const node_crypto_1 = require("node:crypto");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const env_1 = require("@shared/env");
const aws_1 = require("./aws");
exports.router = (0, express_1.Router)();
// const s3 = new S3Client({
//   region: process.env.S3_REGION || process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.f!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//     sessionToken: process.env.AWS_SESSION_TOKEN,
//   },
// })
exports.router.post('/upload-url', async (req, res, next) => {
    try {
        const { mime } = req.body || {};
        if (!mime || typeof mime !== 'string') {
            return res.status(400).json({ error: 'Missing mime' });
        }
        if (!env_1.env.S3_BUCKET || !env_1.env.S3_REGION) {
            return res.status(500).json({ error: 'S3 not configured' });
        }
        const key = `uploads/${(0, node_crypto_1.randomUUID)()}`;
        const { url, fields } = await (0, s3_presigned_post_1.createPresignedPost)(aws_1.s3, {
            Bucket: env_1.env.S3_BUCKET,
            Key: key,
            Conditions: [
                ['content-length-range', 0, 20 * 1024 * 1024],
                ['starts-with', '$Content-Type', ''],
            ],
            Expires: 60,
        });
        return res.json({ url, fields, bucketKey: key });
    }
    catch (err) {
        // Log full error server-side
        console.error('[upload-url] error:', err);
        // Send JSON to client
        return res.status(500).json({
            error: 'UPLOAD_URL_FAILED',
            message: err?.message || 'Unknown error',
        });
    }
});
exports.router.post('/jobs', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ bucketKey: zod_1.z.string(), prompt: zod_1.z.string().min(5), promptPreset: zod_1.z.string().optional(), voicePreset: zod_1.z.string().optional(), ttsScript: zod_1.z.string().optional(), aspect: zod_1.z.string().default('16:9'), durationSec: zod_1.z.number().int().min(3).max(60), styleHints: zod_1.z.any().optional() });
        const input = schema.parse(req.body);
        const image = await prisma_1.prisma.asset.create({ data: { kind: 'SOURCE_IMAGE', bucketKey: input.bucketKey, mime: 'image/*' } });
        const job = await prisma_1.prisma.job.create({ data: { sourceImageId: image.id, prompt: input.prompt, promptPreset: input.promptPreset, voicePreset: input.voicePreset, ttsScript: input.ttsScript, aspect: input.aspect, durationSec: input.durationSec } });
        await (0, enqueue_1.enqueueJob)(job.id);
        res.json({ jobId: job.id });
    }
    catch (e) {
        next(e);
    }
});
exports.router.get('/jobs/:id', async (req, res, next) => {
    try {
        const job = await prisma_1.prisma.job.findUnique({ where: { id: req.params.id }, include: { resultVideo: true } });
        if (!job)
            return res.status(404).end();
        const resultUrl = job.resultVideo ? (0, storage_1.publicUrl)(job.resultVideo.bucketKey) : undefined;
        res.json({ ...job, resultUrl });
    }
    catch (e) {
        next(e);
    }
});
exports.router.post('/jobs/:id/email', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ to: zod_1.z.string().email() });
        const { to } = schema.parse(req.body);
        const job = await prisma_1.prisma.job.findUnique({ where: { id: req.params.id }, include: { resultVideo: true } });
        if (!job || !job.resultVideo)
            return res.status(400).json({ error: 'No result yet' });
        const url = (0, storage_1.publicUrl)(job.resultVideo.bucketKey);
        await (0, email_1.sendEmail)(to, 'Your generated video', `<p>Your video is ready:</p><p><a href="${url}">Download/Watch</a></p>`);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
exports.router.get('/jobs/:id/qr', async (req, res, next) => {
    try {
        const jobId = req.params.id;
        // try find existing share for this job
        let share = await prisma_1.prisma.share.findFirst({ where: { jobId } });
        if (!share) {
            const slug = Math.random().toString(36).slice(2, 10);
            share = await prisma_1.prisma.share.create({
                data: { jobId, slug }
            });
        }
        const png = await (0, qr_1.generateQR)(`${process.env.APP_ORIGIN}/v/${share.slug}`);
        res.setHeader('Content-Type', 'image/png').send(png);
    }
    catch (e) {
        next(e);
    }
});
