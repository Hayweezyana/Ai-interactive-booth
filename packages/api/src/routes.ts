import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@shared/prisma';
import { getSignedUpload, publicUrl } from '@shared/utils/storage';
import { enqueueJob } from './queue/enqueue';
import { generateQR } from '../../shared/src/utils/qr';
import { sendEmail } from '@shared/utils/email';
import { randomUUID } from 'node:crypto'
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { env } from '@shared/env'
import { s3 } from './aws'

export const router = Router();

// const s3 = new S3Client({
//   region: process.env.S3_REGION || process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.f!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//     sessionToken: process.env.AWS_SESSION_TOKEN,
//   },
// })

router.post('/upload-url', async (req, res, next) => {
  try {
    const { mime } = req.body || {}
    if (!mime || typeof mime !== 'string') {
      return res.status(400).json({ error: 'Missing mime' })
    }
    if (!env.S3_BUCKET || !env.S3_REGION) {
      return res.status(500).json({ error: 'S3 not configured' })
    }

    const key = `uploads/${randomUUID()}`
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: env.S3_BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 0, 20 * 1024 * 1024],
        ['starts-with', '$Content-Type', ''],
      ],
      Expires: 60,
    })

    return res.json({ url, fields, bucketKey: key })
  } catch (err: any) {
    // Log full error server-side
    console.error('[upload-url] error:', err)
    // Send JSON to client
    return res.status(500).json({
      error: 'UPLOAD_URL_FAILED',
      message: err?.message || 'Unknown error',
    })
  }
})


router.post('/jobs', async (req, res, next) => {
try {
const schema = z.object({ bucketKey: z.string(), prompt: z.string().min(5), promptPreset: z.string().optional(), voicePreset: z.string().optional(), ttsScript: z.string().optional(), aspect: z.string().default('16:9'), durationSec: z.number().int().min(3).max(60), styleHints: z.any().optional() });
const input = schema.parse(req.body);
const image = await prisma.asset.create({ data: { kind: 'SOURCE_IMAGE', bucketKey: input.bucketKey, mime: 'image/*' } });
const job = await prisma.job.create({ data: { sourceImageId: image.id, prompt: input.prompt, promptPreset: input.promptPreset, voicePreset: input.voicePreset, ttsScript: input.ttsScript, aspect: input.aspect, durationSec: input.durationSec } });
await enqueueJob(job.id); res.json({ jobId: job.id });
} catch (e) { next(e); }
});


router.get('/jobs/:id', async (req, res, next) => {
try { const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { resultVideo: true } }); if (!job) return res.status(404).end(); const resultUrl = job.resultVideo ? publicUrl(job.resultVideo.bucketKey) : undefined; res.json({ ...job, resultUrl }); }
catch (e) { next(e); }
});


router.post('/jobs/:id/email', async (req, res, next) => {
try { const schema = z.object({ to: z.string().email() }); const { to } = schema.parse(req.body); const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { resultVideo: true } }); if (!job || !job.resultVideo) return res.status(400).json({ error: 'No result yet' }); const url = publicUrl(job.resultVideo.bucketKey); await sendEmail(to, 'Your generated video', `<p>Your video is ready:</p><p><a href="${url}">Download/Watch</a></p>`); res.json({ ok: true }); }
catch (e) { next(e); }
});


router.get('/jobs/:id/qr', async (req, res, next) => {
  try {
    const jobId = req.params.id;
    // try find existing share for this job
    let share = await prisma.share.findFirst({ where: { jobId } });

    if (!share) {
      const slug = Math.random().toString(36).slice(2, 10);
      share = await prisma.share.create({
        data: { jobId, slug }
      });
    }

    const png = await generateQR(`${process.env.APP_ORIGIN}/v/${share.slug}`);
    res.setHeader('Content-Type', 'image/png').send(png);
  } catch (e) { next(e); }
});