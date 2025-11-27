// packages/shared/src/env.ts
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

// find the closest .env by walking upward (monorepo-friendly)
function loadClosestDotenv(startDir: string) {
  let dir = startDir
  for (let i = 0; i < 6; i++) {           // don't walk forever
    const candidate = path.join(dir, '.env')
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate })
      return
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // fallback: normal dotenv (loads from CWD if present)
  dotenv.config()
}

loadClosestDotenv(__dirname)

export const env = {
  APP_ORIGIN: process.env.APP_ORIGIN!,
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL!,
  S3_BUCKET: process.env.S3_BUCKET!,
  S3_REGION: process.env.S3_REGION!,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
  S3_PUBLIC_BASE: process.env.S3_PUBLIC_BASE!,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'mock',
  BANANA_API_KEY: process.env.BANANA_API_KEY || 'mock',
  BANANA_MODEL_KEY: process.env.BANANA_MODEL_KEY || 'mock',
  BANANA_URL: process.env.BANANA_URL || 'mock',
  VIDEO_PROVIDER: process.env.VIDEO_PROVIDER || 'mock',
  VIDEO_API_KEY: process.env.VIDEO_API_KEY || 'mock',
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'mock',
  TTS_API_KEY: process.env.TTS_API_KEY || 'mock',
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Studio <no-reply@example.com>',
}