import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors';
import morgan from 'morgan';
import { router } from './routes';

const API_BASE = process.env.APP_ORIGIN || 'http://localhost:4000'
const API = `${API_BASE}`

const app = express();
app.use(cors({
  origin: API,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

console.log('ROUTER FILE LOADED')

// Add root redirect to /studio
app.use('/api', router);
app.get('/health', (_req: Request, res: Response) => res.json({ message: 'API is running 🚀' }));
app.get('/', (_req: Request, res: Response) => {
  res.redirect('/studio');
});
app.get('/v/:slug', async (req, res) => {
  
})

// Error handler should be AFTER routes
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[unhandled]', err)
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: err?.message || 'Unexpected error',
  })
})

const port = Number(process.env.PORT) || 4000;

// ⚠️ CRITICAL: Bind to 0.0.0.0 for Railway/cloud platforms
app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on port ${port}`);
  console.log(`Health check: http://0.0.0.0:${port}/health`);
});