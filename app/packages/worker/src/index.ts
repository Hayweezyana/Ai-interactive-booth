import { Worker } from 'bullmq'
import { env } from '../../../../packages/shared/src/env'
import { prisma } from '../../../../packages/shared/src/prisma'
import { publicUrl } from '../../../../packages/shared/src/utils/storage'
import { muxAudioOverVideo } from '../../../../packages/shared/src/media/ffmpeg'
import { gemini } from '../../../../packages/api/src/providers/gemini'
import { videoGen } from '../../../../packages/api/src/providers/video'
import { tts } from '../../../../packages/api/src/providers/tts'

const log = (...args: any[]) => console.log('[worker]', ...args)

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

const interUrl = vres.videoUrl!
log('VIDEO_GENERATE: completed with URL', interUrl)


      // 3) TTS_GENERATE
      await prisma.job.update({
        where: { id: jobId },
        data: { stage: 'TTS_GENERATE' },
      })

      const narration =
        (job.ttsScript && job.ttsScript.trim().length > 0)
          ? job.ttsScript
          : 'Narration based on storyboard.'
      log('TTS_GENERATE: calling tts.synthesize')
      const ttsOut = await tts.synthesize({
        text: narration,
        voice: job.voicePreset || 'alloy',
      })
      log('TTS_GENERATE: got audioUrl', ttsOut.audioUrl)

      // 4) MUX
      await prisma.job.update({
        where: { id: jobId },
        data: { stage: 'MUX' },
      })

      log('MUX: combining audio+video')
      const finalKey = await muxAudioOverVideo({
        videoUrl: interUrl,
        audioUrl: ttsOut.audioUrl,
        durationSec: job.durationSec,
      })
      log('MUX: finalKey', finalKey)

      // 5) save asset & mark COMPLETE
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
