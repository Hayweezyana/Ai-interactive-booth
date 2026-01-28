import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { router } from './routes'
import { prisma } from '@shared/prisma'
import { publicUrl } from '@shared/utils/storage'

const app = express()

// ✅ FIX 1: CORS - Allow your FRONTEND, not your API
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:4000'

console.log('[server] CORS allowed origins:', FRONTEND_URL)
console.log('[server] APP_ORIGIN:', APP_ORIGIN)

const allowedOrigins: string[] = [
  'https://immersiavideobooth.up.railway.app',
  'http://localhost:3000'
]

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow server-to-server / curl / health checks
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(
        new Error(`CORS blocked origin: ${origin}`),
        false
      )
    },
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

console.log('[server] Router file loaded')
app.options('*', cors())

// ✅ FIX 2: Move /v/:slug BEFORE /api routes to avoid conflicts
app.get('/v/:slug', async (req: Request, res: Response) => {
  try {
    console.log('[share] Accessing slug:', req.params.slug)
    
    const share = await prisma.share.findUnique({
      where: { slug: req.params.slug },
      include: {
        job: { include: { resultVideo: true } },
      },
    })

    if (!share) {
      console.log('[share] Not found:', req.params.slug)
      return res.status(404).send('Invalid link')
    }

    if (!share.job.resultVideo) {
      console.log('[share] Video not ready yet:', req.params.slug)
      return res
        .status(200)
        .send('Your video is still processing. Please refresh shortly.')
    }

    const url = publicUrl(share.job.resultVideo.bucketKey)
    console.log('[share] Redirecting to:', url.substring(0, 50) + '...')
    
    return res.redirect(url)
  } catch (e) {
    console.error('[share] Error:', e)
    return res.status(500).send('Internal error')
  }
})

// API routes
app.use('/api', router)

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    message: 'API is running 🚀',
    env: process.env.NODE_ENV || 'development',
    cors: FRONTEND_URL,
  })
})

// Root redirect
app.get('/', (_req: Request, res: Response) => {
  res.redirect('/studio')
})

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[unhandled]', err)
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: err?.message || 'Unexpected error',
  })
})

const port = Number(process.env.PORT) || 4000

// ✅ Bind to 0.0.0.0 for Railway/cloud platforms
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] API listening on http://0.0.0.0:${port}`)
  console.log(`[server] Health check: http://0.0.0.0:${port}/health`)
  console.log(`[server] Frontend URL: ${FRONTEND_URL}`)
  console.log(`[server] App Origin: ${APP_ORIGIN}`)
})