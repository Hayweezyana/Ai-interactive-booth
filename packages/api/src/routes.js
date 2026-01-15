"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("@shared/prisma");
const storage_1 = require("@shared/utils/storage");
const enqueue_1 = require("./queue/enqueue");
const qr_1 = require("@shared/utils/qr");
const email_1 = require("@shared/utils/email");
const node_crypto_1 = require("node:crypto");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const env_1 = require("@shared/env");
const aws_1 = require("./aws");
exports.router = (0, express_1.Router)();
/**
 * POST /upload-url
 * unchanged behaviour: returns url, fields, bucketKey for a single upload.
 * Call this once per image you need to upload (Photo 1, Photo 2, ...).
 */
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
        console.error('[upload-url] error:', err);
        return res.status(500).json({
            error: 'UPLOAD_URL_FAILED',
            message: err?.message || 'Unknown error',
        });
    }
});
/**
 * POST /jobs
 *
 * Body:
 * {
 *   bucketKey: string,                     // REQUIRED (primary image)
 *   secondaryBucketKey?: string,           // OPTIONAL (secondary image)
 *   prompt: string,
 *   promptPreset?: string,
 *   voicePreset?: string,
 *   ttsScript?: string,
 *   aspect?: string,
 *   durationSec: number,
 *   styleHints?: any
 * }
 *
 * Behavior:
 * - create Asset for primary image (SOURCE_IMAGE)
 * - optionally create Asset for secondary image (SECONDARY_IMAGE)
 * - create Job and set sourceImageId and secondaryImageId (if present)
 * - enqueue job
 */
exports.router.post('/jobs', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            bucketKey: zod_1.z.string(),
            secondaryBucketKey: zod_1.z.string().optional(),
            prompt: zod_1.z.string().min(5),
            promptPreset: zod_1.z.string().optional(),
            voicePreset: zod_1.z.string().optional(),
            ttsScript: zod_1.z.string().optional(),
            aspect: zod_1.z.string().default('16:9'),
            durationSec: zod_1.z.number().int().min(3).max(60),
            styleHints: zod_1.z.any().optional(),
        });
        const input = schema.parse(req.body);
        // Create primary asset
        const image = await prisma_1.prisma.asset.create({
            data: {
                kind: 'SOURCE_IMAGE',
                bucketKey: input.bucketKey,
                mime: 'image/*',
            },
        });
        // Create optional secondary asset
        let secondaryImage = null;
        if (input.secondaryBucketKey) {
            secondaryImage = await prisma_1.prisma.asset.create({
                data: {
                    kind: 'SOURCE_IMAGE',
                    bucketKey: input.secondaryBucketKey,
                    mime: 'image/*',
                },
            });
        }
        // Create job, linking both images via relation connect (use relation fields, not raw foreign keys)
        const jobData = {
            sourceImage: { connect: { id: image.id } },
            secondaryImage: secondaryImage ? { connect: { id: secondaryImage.id } } : undefined,
            prompt: input.prompt,
            promptPreset: input.promptPreset,
            voicePreset: input.voicePreset,
            ttsScript: input.ttsScript,
            aspect: input.aspect,
            durationSec: input.durationSec,
            // any other fields you have on Job...
        };
        if (secondaryImage) {
            jobData.secondaryImage = { connect: { id: secondaryImage.id } };
        }
        const job = await prisma_1.prisma.job.create({
            data: jobData,
        });
        await (0, enqueue_1.enqueueJob)(job.id);
        return res.json({ jobId: job.id });
    }
    catch (e) {
        next(e);
    }
});
/**
 * GET /jobs/:id
 * Returns the job plus public URLs for source & secondary image (if present) and result video URL.
 */
exports.router.get('/jobs/:id', async (req, res, next) => {
    try {
        // load job with relations that exist on the generated client (resultVideo + sourceImage)
        const job = await prisma_1.prisma.job.findUnique({
            where: { id: req.params.id },
            include: { resultVideo: true, sourceImage: true },
        });
        if (!job)
            return res.status(404).end();
        const resultUrl = job.resultVideo ? (0, storage_1.publicUrl)(job.resultVideo.bucketKey) : undefined;
        const sourceImageUrl = job.sourceImage ? (0, storage_1.publicUrl)(job.sourceImage.bucketKey) : undefined;
        // secondary image relation may not be present on the generated client types,
        // so load it explicitly if the job has a secondaryImageId scalar field.
        let secondaryImageUrl = undefined;
        // use any/ts-ignore to avoid type errors if the scalar field isn't present in types
        // @ts-ignore
        const secondaryId = job.secondaryImageId;
        if (secondaryId) {
            const secondary = await prisma_1.prisma.asset.findUnique({ where: { id: secondaryId } });
            if (secondary)
                secondaryImageUrl = (0, storage_1.publicUrl)(secondary.bucketKey);
        }
        res.json({
            ...job,
            resultUrl,
            sourceImageUrl,
            secondaryImageUrl,
        });
    }
    catch (e) {
        next(e);
    }
});
/**
 * POST /jobs/:id/email
 * Send generated video via email.
 */
exports.router.post('/jobs/:id/email', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ to: zod_1.z.string().email() });
        const { to } = schema.parse(req.body);
        const job = await prisma_1.prisma.job.findUnique({
            where: { id: req.params.id },
            include: { resultVideo: true },
        });
        if (!job || !job.resultVideo)
            return res.status(400).json({ error: 'No result yet' });
        const url = (0, storage_1.publicUrl)(job.resultVideo.bucketKey);
        await (0, email_1.sendEmail)(to, 'Your video is ready 🎉', `
    <p>Your video is ready:</p>
    <p><a href="${url}">Watch / Download Video</a></p>
    <p>You can also scan the QR code on the screen to access it.</p>
  `);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
/**
 * GET /jobs/:id/qr
 * Create or fetch share record and return QR PNG
 */
exports.router.get('/jobs/:id/qr', async (req, res, next) => {
    try {
        const jobId = req.params.id;
        let share = await prisma_1.prisma.share.findFirst({ where: { jobId } });
        if (!share) {
            const slug = Math.random().toString(36).slice(2, 10);
            share = await prisma_1.prisma.share.create({
                data: { jobId, slug },
            });
        }
        const png = await (0, qr_1.generateQR)(`${process.env.APP_ORIGIN}/v/${share.slug}`);
        res.setHeader('Content-Type', 'image/png').send(png);
    }
    catch (e) {
        next(e);
    }
});
exports.router.get('/share/:slug', async (req, res, next) => {
    try {
        const share = await prisma_1.prisma.share.findUnique({
            where: { slug: req.params.slug },
            include: { job: { include: { resultVideo: true } } },
        });
        if (!share?.job?.resultVideo) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json({
            url: (0, storage_1.publicUrl)(share.job.resultVideo.bucketKey),
        });
    }
    catch (e) {
        next(e);
    }
});
