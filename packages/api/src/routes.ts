import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@app/shared/prisma'
import { getSignedUpload, publicUrl } from '@shared/utils/storage'
import { enqueueJob } from './queue/enqueue'
import { generateQR } from '@shared/utils/qr'
import { sendEmail, getVideoEmailTemplate } from '@shared/utils/email'
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

    const job = await prisma.job.create({ data: jobData })

    await prisma.share.create({
      data: {
        jobId: job.id,
        slug: Math.random().toString(36).slice(2, 10),
      },
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
// In your routes.ts - UPDATE the email route

router.post('/jobs/:id/email', async (req, res, next) => {
  try {
    const schema = z.object({ to: z.string().email() })
    const { to } = schema.parse(req.body)
    
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { 
        resultVideo: true,
        shares: true 
      },
    })
    
    if (!job || !job.resultVideo) {
      return res.status(400).json({ error: 'No result yet' })
    }

    // Get the video URL
    const videoUrl = publicUrl(job.resultVideo.bucketKey)
    
    // Get the share URL (preferred for tracking and better UX)
    const shareUrl = job.shares?.[0]
      ? `${process.env.APP_ORIGIN}/v/${job.shares[0].slug}`
      : undefined

    console.log('[email] Sending video email:', {
      to,
      videoUrl: videoUrl.substring(0, 50) + '...',
      shareUrl,
    })

    // Use the template
    const htmlContent = getVideoEmailTemplate(videoUrl, shareUrl)

    await sendEmail(
      to,
      'Your Immersia AI Video is Ready! 🎬',
      htmlContent
    )

    console.log('[email] Email sent successfully to:', to)

    res.json({ 
      ok: true,
      message: 'Email sent successfully'
    })
  } catch (e: any) {
    console.error('[email] Error:', e)
    res.status(500).json({ 
      error: 'Failed to send email',
      message: e.message 
    })
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
// Replace your QR route with this version

router.get('/jobs/:id/qr', async (req, res, next) => {
  try {
    console.log('[QR] Request for job:', req.params.id)
    
    if (!process.env.APP_ORIGIN) {
      console.error('[QR] APP_ORIGIN not set')
      throw new Error('APP_ORIGIN not set')
    }

    const share = await prisma.share.findFirst({
      where: { jobId: req.params.id },
    })

    console.log('[QR] Share found:', !!share, share?.slug)

    if (!share) {
      console.error('[QR] No share found for job:', req.params.id)
      return res.status(404).json({ error: 'Share not ready yet' })
    }

    const shareUrl = `${process.env.APP_ORIGIN}/v/${share.slug}`
    console.log('[QR] Generating QR for:', shareUrl)

    const png = await generateQR(shareUrl)
    
    console.log('[QR] Generated PNG, size:', png.length, 'bytes')

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Length', png.length.toString())
    res.send(png)
    
    console.log('[QR] Sent successfully')
  } catch (e: any) {
    console.error('[QR] Error:', e)
    res.status(500).json({ 
      error: 'Failed to generate QR',
      message: e.message 
    })
  }
})

// Debug endpoint to test QR generation directly
router.get('/debug/qr-test', async (req, res) => {
  try {
    const testUrl = req.query.url as string || 'https://example.com'
    console.log('[QR Debug] Generating for:', testUrl)
    
    const png = await generateQR(testUrl)
    
    console.log('[QR Debug] Generated, size:', png.length)
    
    res.setHeader('Content-Type', 'image/png')
    res.send(png)
  } catch (e: any) {
    console.error('[QR Debug] Error:', e)
    res.status(500).json({ error: e.message })
  }
})

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

router.get('/debug/shares', async (_req, res) => {
  const shares = await prisma.share.findMany()
  res.json(shares)
})

router.get('/debug/share/:slug', async (req, res) => {
  const share = await prisma.share.findUnique({
    where: { slug: req.params.slug },
    include: {
      job: {
        include: { resultVideo: true },
      },
    },
  })

  res.json({
    found: !!share,
    share,
    jobId: share?.jobId,
    resultVideoId: share?.job?.resultVideoId,
    hasResultVideo: !!share?.job?.resultVideo,
  })
})


