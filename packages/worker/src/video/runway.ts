// packages/api/src/providers/video.ts
import type { VideoGenerator } from '@shared/types'

const RUNWAY_API_SECRET = process.env.RUNWAYML_API_SECRET
if (!RUNWAY_API_SECRET) {
  // Fail fast so you don't sit there wondering why jobs are stuck
  throw new Error('RUNWAYML_API_SECRET is not set')
}

// You can override these via env if you want
const RUNWAY_MODEL =
  process.env.RUNWAYML_MODEL || 'gen4_turbo' // or "gen3a_turbo" depending on your access
const RUNWAY_VERSION =
  process.env.RUNWAYML_VERSION || '2024-11-06'
const RUNWAY_BASE = process.env.RUNWAYML_BASE_URL || 'https://api.dev.runwayml.com'

// Map our aspect ratios ("16:9", "9:16", "1:1") to Runway's `ratio` values
function toRunwayRatio(aspect?: string | null): string {
  switch (aspect) {
    case '9:16':
      return '768:1280'
    case '1:1':
      return '1024:1024'
    // default 16:9 style
    case '16:9':
    default:
      // Example from docs uses 1280x720 / 1280:720
      return '1280:720'
  }
}

type RunwayTaskStatus =
  | 'PENDING'
  | 'THROTTLED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

// This is what your worker already imports
export const videoGen: VideoGenerator = {
  async start({
    imageUrl,
    prompt,
    aspect,
    durationSec,
    seed,
  }: {
    imageUrl: string
    prompt: string
    aspect?: string
    durationSec?: number
    styleHints?: any
    seed?: number
  }) {
    const ratio = toRunwayRatio(aspect)
    const duration = durationSec ?? 5

    const body = {
      promptImage: imageUrl,
      promptText: prompt,
      model: RUNWAY_MODEL,
      ratio,
      duration,
      seed,
      watermark: false,
    }

    const res = await fetch(`${RUNWAY_BASE}/v1/image_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_SECRET}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': RUNWAY_VERSION,
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }

    if (!res.ok) {
      throw new Error(
        `Runway image_to_video HTTP ${res.status}: ${text.slice(0, 500)}`
      )
    }

    if (!json?.id) {
      throw new Error(
        `Runway image_to_video response missing id: ${text.slice(0, 500)}`
      )
    }

    const jobId = String(json.id)
    console.log('[videoGen][Runway] created task', jobId)
    return { jobId }
  },

  async getStatus(jobId: string) {
    const res = await fetch(`${RUNWAY_BASE}/v1/tasks/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_SECRET}`,
        'X-Runway-Version': RUNWAY_VERSION,
      },
    })

    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }

    if (!res.ok) {
      console.error(
        '[videoGen][Runway] tasks error',
        jobId,
        `HTTP ${res.status}: ${text.slice(0, 500)}`
      )
      return { state: 'failed', error: `HTTP ${res.status}` } as any
    }

    const status = (json?.status || '') as RunwayTaskStatus
    console.log('[videoGen][Runway] task status', jobId, status)

    if (status === 'SUCCEEDED') {
      const url = json?.output?.[0]
      if (!url) {
        return {
          state: 'failed',
          error: 'SUCCEEDED but no output URL',
        } as any
      }
      return { state: 'complete', videoUrl: url } as any
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      const failure = json?.failure || status
      return { state: 'failed', error: String(failure) } as any
    }

    if (status === 'RUNNING') {
      return { state: 'running' } as any
    }

    if (status === 'PENDING' || status === 'THROTTLED' || !status) {
      return { state: 'queued' } as any
    }

    
    return { state: 'queued' } as any
  },
}
