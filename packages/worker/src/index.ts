// packages/worker/src/index.ts
import { Worker, JobsOptions } from 'bullmq'
import { env } from '@shared/env'
import { prisma } from '@shared/prisma'
import { publicUrl } from '@shared/utils/storage'
import { s3PutFromUrl } from './util/s3PutFromUrl'
// import { muxAudioOverVideo } from '@shared/media/ffmpeg'
// import { planFromImage } from './ai/gemini'
// import { getVideoProvider } from './video'
// import { s3PutFromUrl } from './util/s3PutFromUrl'
// import { tts } from '../../api/src/providers/tts' // keep if you already implemented tts.synthesize()
import { videoGen } from './video/runway'
// import { videoGen } from './video/lumaVideoGen'
// import {videoGen} from './video/bananaProvider'
import { gemini } from '../../api/src/providers/gemini'


const log = (...args: any[]) => console.log('[worker]', ...args)
console.log('[BANANA env]', {
  api: (process.env.BANANA_API_KEY || '').slice(0,4) + '…',
  model: (process.env.BANANA_MODEL_KEY || '').slice(0,4) + '…',
})

new Worker(
  'jobs',
  async (bullJob) => {
    const { jobId } = bullJob.data as { jobId: string }
    log('processing', jobId)

    try {
      // 0) load job
      const job = await prisma.job.findUniqueOrThrow({
        where: { id: jobId },
        include: { sourceImage: true },
      })

      if (!job.sourceImage) {
        throw new Error('Job missing sourceImage')
      }

      const imageUrl = publicUrl(job.sourceImage.bucketKey)
      log('imageUrl', imageUrl)

      // quick sanity: this URL should be publicly readable in a browser now
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', stage: 'GEMINI_PREP' },
      })

      // 1) GEMINI_PREP
      log('GEMINI_PREP: calling gemini.describe')
      const prep = await gemini.describe({
        imageUrl,
        userPrompt: job.prompt,
      })
      log('GEMINI_PREP: got response', prep)

      // 2) VIDEO_GENERATE
      await prisma.job.update({
  where: { id: jobId },
  data: { stage: 'VIDEO_GENERATE' },
})

log('VIDEO_GENERATE: starting videoGen')
const vstart = await videoGen.start({
  imageUrl: publicUrl(job.sourceImage.bucketKey),
  prompt: prep.refinedPrompt,
  aspect: job.aspect,
  durationSec: job.durationSec,
  styleHints: job.styleHints,
})
log('VIDEO_GENERATE: start response', vstart)

let vres: any
let polls = 0
const maxPolls = 30

while (true) {
  polls++
  vres = await videoGen.getStatus(vstart.jobId)
  log('VIDEO_GENERATE: poll', polls, vres)

  if (vres.state === 'failed') {
    console.error('[worker][VIDEO_GENERATE] video provider failed:', vres)
    throw new Error(vres.error || 'video failed')
  }

  if (vres.state === 'complete') {
    break
  }

  if (polls >= maxPolls) {
    throw new Error('video generation timed out (never reached complete/failed)')
  }

  await new Promise((r) => setTimeout(r, 4000))
}
const finalUrl = vres.videoUrl!
console.log('[worker] VIDEO_GENERATE: got final runway url', finalUrl)

// Optional: update stage to something like "MUX" or go straight to COMPLETE.
// I’ll just skip straight to COMPLETE for clarity.
const finalKey = await s3PutFromUrl(finalUrl, 'final', 'video/mp4')

const finalAsset = await prisma.asset.create({
  data: {
    kind: 'FINAL_VIDEO',
    bucketKey: finalKey,
    mime: 'video/mp4',
  },
})

await prisma.job.update({
  where: { id: jobId },
  data: {
    status: 'COMPLETE',
    stage: 'COMPLETE',
    resultVideoId: finalAsset.id,
  },
})

log('completed', jobId)

    } catch (err) {
      console.error('[worker ERROR]', err)

      // Mark job as FAILED so UI doesn’t stay stuck on GEMINI_PREP
      try {
        await prisma.job.update({
          where: { id: (bullJob.data as { jobId: string }).jobId },
          data: { status: 'FAILED' },
        })
      } catch (e) {
        console.error('[worker ERROR] failed to mark job as FAILED:', e)
      }

      throw err
    }
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 2,
  }
)