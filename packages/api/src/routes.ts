import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@shared/prisma'
import { getSignedUpload, publicUrl } from '@shared/utils/storage'
import { enqueueJob } from './queue/enqueue'
import { generateQR } from '@shared/utils/qr'
import { sendEmail } from '@shared/utils/email'
import { randomUUID } from 'node:crypto'
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { env } from '@shared/env'
import { s3 } from './aws'

export const router = Router()

/**
 * POST /upload-url
 * unchanged behaviour: returns url, fields, bucketKey for a single upload.
 * Call this once per image you need to upload (Photo 1, Photo 2, ...).
 */
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
    console.error('[upload-url] error:', err)
    return res.status(500).json({
      error: 'UPLOAD_URL_FAILED',
      message: err?.message || 'Unknown error',
    })
  }
})

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
router.post('/jobs', async (req, res, next) => {
  try {
    const schema = z.object({
      bucketKey: z.string(),
      secondaryBucketKey: z.string().optional(),
      prompt: z.string().min(5),
      promptPreset: z.string().optional(),
      voicePreset: z.string().optional(),
      ttsScript: z.string().optional(),
      aspect: z.string().default('16:9'),
      durationSec: z.number().int().min(3).max(60),
      styleHints: z.any().optional(),
    })
    const input = schema.parse(req.body)

    // Create primary asset
    const image = await prisma.asset.create({
      data: {
        kind: 'SOURCE_IMAGE',
        bucketKey: input.bucketKey,
        mime: 'image/*',
      },
    })

    // Create optional secondary asset
    let secondaryImage: typeof image | null = null
    if (input.secondaryBucketKey) {
      secondaryImage = await prisma.asset.create({
        data: {
          kind: 'SOURCE_IMAGE' as any,
          bucketKey: input.secondaryBucketKey,
          mime: 'image/*',
        },
      })
    }

    // Create job, linking both images via relation connect (use relation fields, not raw foreign keys)
    const jobData: any = {
      sourceImage: { connect: { id: image.id } },
      secondaryImage: secondaryImage ? { connect: { id: secondaryImage.id } } : undefined,
      prompt: input.prompt,
      promptPreset: input.promptPreset,
      voicePreset: input.voicePreset,
      ttsScript: input.ttsScript,
      aspect: input.aspect,
      durationSec: input.durationSec,
      // any other fields you have on Job...
    }

    if (secondaryImage) {
      jobData.secondaryImage = { connect: { id: secondaryImage.id } }
    }

    const job = await prisma.job.create({
      data: jobData,
    })

    await enqueueJob(job.id)

    return res.json({ jobId: job.id })
  } catch (e) {
    next(e)
  }
})

/**
 * GET /jobs/:id
 * Returns the job plus public URLs for source & secondary image (if present) and result video URL.
 */
router.get('/jobs/:id', async (req, res, next) => {
  try {
    // load job with relations that exist on the generated client (resultVideo + sourceImage)
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { resultVideo: true, sourceImage: true, shares: true, },
    })
    if (!job) return res.status(404).end()
      res.json({
        ...job,
        resultUrl: job.resultVideo ? publicUrl(job.resultVideo.bucketKey) : undefined,
        shareUrl: job.shares?.[0]
        ? `${process.env.APP_ORIGIN}/v/${job.shares[0].slug}`
        : undefined,
    })
  } catch (e) {
    next(e)
  }
})

/**
 * POST /jobs/:id/email
 * Send generated video via email.
 */
router.post('/jobs/:id/email', async (req, res, next) => {
  try {
    const { to } = z
      .object({ to: z.string().email() })
      .parse(req.body)

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { shares: true },
    })

    if (!job?.shares) {
      return res.status(400).json({ error: 'Result not ready' })
    }

    const link = `${process.env.APP_ORIGIN}/v/${job.shares[0].slug}`

    await sendEmail(
      to,
      'Your video is ready 🎉',
      `
        <p>Your video is ready:</p>
        <p><a href="${link}">Watch / Download Video</a></p>
        <p>You can also scan the QR code on the screen to access it.</p>
      `
    )

    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})


/**
 * GET /jobs/:id/qr
 * Create or fetch share record and return QR PNG
 */
/**
 * GET /jobs/:id/qr
 * Return QR PNG for existing share
 */
router.get('/jobs/:id/qr', async (req, res, next) => {
  try {
    if (!process.env.APP_ORIGIN) {
      throw new Error('APP_ORIGIN not set')
    }

    const share = await prisma.share.findFirst({
      where: { jobId: req.params.id },
    })

    if (!share) {
      return res.status(404).json({ error: 'Share not ready yet' })
    }

    const png = await generateQR(
      `${process.env.APP_ORIGIN}/v/${share.slug}`
    )

    res.setHeader('Content-Type', 'image/png')
    res.send(png)
  } catch (e) {
    next(e)
  }
})


router.get('/v/:slug', async (req, res, next) => {
  try {
    const share = await prisma.share.findUnique({
      where: { slug: req.params.slug },
      include: {
        job: {
          include: { resultVideo: true },
        },
      },
    })

    if (!share?.job?.resultVideo) {
      return res.status(404).end()
    }

    const url = publicUrl(share.job.resultVideo.bucketKey)

    return res.redirect(url)
  } catch (e) {
    next(e)
  }
})
