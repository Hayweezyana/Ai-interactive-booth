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
        const job = await prisma_1.prisma.job.create({ data: jobData });
        await prisma_1.prisma.share.create({
            data: {
                jobId: job.id,
                slug: Math.random().toString(36).slice(2, 10),
            },
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
            include: { resultVideo: true, sourceImage: true, shares: true, },
        });
        if (!job)
            return res.status(404).end();
        res.json({
            ...job,
            resultUrl: job.resultVideo ? (0, storage_1.publicUrl)(job.resultVideo.bucketKey) : undefined,
            shareUrl: job.shares?.[0]
                ? `${process.env.APP_ORIGIN}/v/${job.shares[0].slug}`
                : undefined,
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
// In your routes.ts - UPDATE the email route
exports.router.post('/jobs/:id/email', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ to: zod_1.z.string().email() });
        const { to } = schema.parse(req.body);
        const job = await prisma_1.prisma.job.findUnique({
            where: { id: req.params.id },
            include: {
                resultVideo: true,
                shares: true
            },
        });
        if (!job || !job.resultVideo) {
            return res.status(400).json({ error: 'No result yet' });
        }
        // Get the video URL
        const videoUrl = (0, storage_1.publicUrl)(job.resultVideo.bucketKey);
        // Get the share URL (preferred for tracking and better UX)
        const shareUrl = job.shares?.[0]
            ? `${process.env.APP_ORIGIN}/v/${job.shares[0].slug}`
            : undefined;
        console.log('[email] Sending video email:', {
            to,
            videoUrl: videoUrl.substring(0, 50) + '...',
            shareUrl,
        });
        // Use the template
        const htmlContent = (0, email_1.getVideoEmailTemplate)(videoUrl, shareUrl);
        await (0, email_1.sendEmail)(to, 'Your Immersia AI Video is Ready! 🎬', htmlContent);
        console.log('[email] Email sent successfully to:', to);
        res.json({
            ok: true,
            message: 'Email sent successfully'
        });
    }
    catch (e) {
        console.error('[email] Error:', e);
        res.status(500).json({
            error: 'Failed to send email',
            message: e.message
        });
    }
});
/**
 * GET /jobs/:id/qr
 * Create or fetch share record and return QR PNG
 */
/**
 * GET /jobs/:id/qr
 * Return QR PNG for existing share
 */
// Replace your QR route with this version
exports.router.get('/jobs/:id/qr', async (req, res, next) => {
    try {
        console.log('[QR] Request for job:', req.params.id);
        if (!process.env.NEXT_PUBLIC_API_BASE) {
            console.error('[QR] APP_ORIGIN not set');
            throw new Error('APP_ORIGIN not set');
        }
        const share = await prisma_1.prisma.share.findFirst({
            where: { jobId: req.params.id },
        });
        console.log('[QR] Share found:', !!share, share?.slug);
        if (!share) {
            console.error('[QR] No share found for job:', req.params.id);
            return res.status(404).json({ error: 'Share not ready yet' });
        }
        const shareUrl = `${process.env.NEXT_PUBLIC_API_BASE}/v/${share.slug}`;
        console.log('[QR] Generating QR for:', shareUrl);
        const png = await (0, qr_1.generateQR)(shareUrl);
        console.log('[QR] Generated PNG, size:', png.length, 'bytes');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', png.length.toString());
        res.send(png);
        console.log('[QR] Sent successfully');
    }
    catch (e) {
        console.error('[QR] Error:', e);
        res.status(500).json({
            error: 'Failed to generate QR',
            message: e.message
        });
    }
});
// Debug endpoint to test QR generation directly
exports.router.get('/debug/qr-test', async (req, res) => {
    try {
        const testUrl = req.query.url || 'https://example.com';
        console.log('[QR Debug] Generating for:', testUrl);
        const png = await (0, qr_1.generateQR)(testUrl);
        console.log('[QR Debug] Generated, size:', png.length);
        res.setHeader('Content-Type', 'image/png');
        res.send(png);
    }
    catch (e) {
        console.error('[QR Debug] Error:', e);
        res.status(500).json({ error: e.message });
    }
});
// router.get('/v/:slug', async (req, res, next) => {
//   try {
//     const share = await prisma.share.findUnique({
//       where: { slug: req.params.slug },
//       include: {
//         job: {
//           include: { resultVideo: true },
//         },
//       },
//     })
//     if (!share) {
//   return res.status(404).send('Invalid link')
// }
// if (!share.job.resultVideo) {
//   return res
//     .status(200)
//     .send('Your video is still processing. Please refresh shortly.')
// }
//     const url = publicUrl(share.job.resultVideo.bucketKey)
//     return res.redirect(url)
//   } catch (e) {
//     next(e)
//   }
// })
exports.router.get('/debug/shares', async (_req, res) => {
    const shares = await prisma_1.prisma.share.findMany();
    res.json(shares);
});
exports.router.get('/debug/share/:slug', async (req, res) => {
    const share = await prisma_1.prisma.share.findUnique({
        where: { slug: req.params.slug },
        include: {
            job: {
                include: { resultVideo: true },
            },
        },
    });
    res.json({
        found: !!share,
        share,
        jobId: share?.jobId,
        resultVideoId: share?.job?.resultVideoId,
        hasResultVideo: !!share?.job?.resultVideo,
    });
});
