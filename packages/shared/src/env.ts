// packages/shared/src/env.ts
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

function loadClosestDotenv(startDir: string) {
  let dir = startDir
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env')
    if (fs.existsSync(candidate)) {
      // Use override: true to ensure the local .env values 
      // take precedence over any shell-injected "undefined" values
      dotenv.config({ path: candidate, override: true })
      return
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  dotenv.config()
}

loadClosestDotenv(__dirname)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
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
  FAL_KEY: process.env.FAL_KEY || 'mock',
  VIDEO_PROVIDER: process.env.VIDEO_PROVIDER || 'mock',
  VIDEO_API_KEY: process.env.VIDEO_API_KEY || 'mock',
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'mock',
  TTS_API_KEY: process.env.TTS_API_KEY || 'mock',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '',
  SMTP_SECURE: process.env.SMTP_SECURE || 'false',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'smtp',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Immersia AI Studio <no-reply@immersiavr.com>',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'mock',
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || '',
  GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account-key.json',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
}