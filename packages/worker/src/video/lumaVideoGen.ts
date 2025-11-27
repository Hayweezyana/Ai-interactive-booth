// packages/worker/src/video/lumaVideoGen.ts
import { fal } from '@fal-ai/client'
import type { VideoGenerator } from '@shared/types'

const FAL_KEY = (process.env.FAL_KEY || '').trim()

console.log('[worker][Luma] FAL_KEY present?', !!FAL_KEY)

if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY })
} else {
  console.warn('[worker][Luma] WARNING: FAL_KEY is not set. Video gen will fail.')
}

type JobState =
  | { state: 'queued' }
  | { state: 'running' }
  | { state: 'failed'; error?: string }
  | { state: 'complete'; videoUrl: string }

const jobs = new Map<string, JobState>()

function mapDuration(durationSec?: number): '5s' | '9s' {
  if (!durationSec) return '5s'
  return durationSec >= 9 ? '9s' : '5s'
}

function mapAspect(aspect?: string | null): '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' {
  if (!aspect) return '16:9'
  if (['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'].includes(aspect)) {
    return aspect as any
  }
  return '16:9'
}

export const videoGen: VideoGenerator = {
  async start({ imageUrl, prompt, aspect, durationSec, styleHints }) {
    if (!FAL_KEY) {
      throw new Error('FAL_KEY is not configured (set it in packages/shared/.env)')
    }

    const jobId = Math.random().toString(36).slice(2)
    jobs.set(jobId, { state: 'running' })

    ;(async () => {
      try {
        const input: any = {
          prompt,
          aspect_ratio: mapAspect(aspect as any),
          duration: mapDuration(durationSec),
          loop: false,
        }

        if (imageUrl) {
          input.image_url = imageUrl
        }

        if (styleHints) {
          input.prompt = `${prompt}\n\nStyle hints: ${styleHints}`
        }

        console.log('[worker][Luma] starting fal.run for job', jobId, 'input:', input)

        const result = await fal.run('fal-ai/luma-dream-machine', { input })

        console.log('[worker][Luma] result raw for job', jobId, result)

        const url =
          (result.data as any)?.video?.url ||
          (result.data as any)?.output?.video?.url

        if (!url) {
          const err =
            'Luma Dream Machine completed but no video URL was returned in result.data.video.url'
          console.error('[worker][Luma] ERROR:', err)
          jobs.set(jobId, { state: 'failed', error: err })
          return
        }

        jobs.set(jobId, { state: 'complete', videoUrl: url })
      } catch (e: any) {
        let msg = e?.message || String(e)
        if (e?.response) {
    try {
      const text = await e.response.text()
      console.error('[worker][Luma] response body:', text)
      msg += ` | body: ${text}`
    } catch {
      // ignore
    }
  }
        console.error('[worker][Luma] ERROR during fal.run for job', jobId, msg)
        jobs.set(jobId, { state: 'failed', error: msg })
      }
    })()

    return { jobId }
  },

  async getStatus(jobId: string) {
    const j = jobs.get(jobId)
    if (!j) return { state: 'queued' as const }

    if (j.state === 'failed') {
      return { state: 'failed' as const, error: j.error }
    }
    if (j.state === 'complete') {
      return { state: 'complete' as const, videoUrl: j.videoUrl }
    }
    return { state: j.state }
  },
}
