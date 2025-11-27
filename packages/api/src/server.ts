import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors';
import morgan from 'morgan';
import { router } from './routes';

// console.log('[AWS env]', {
//   id: process.env.S3_ACCESS_KEY_ID,
//   region: process.env.S3_REGION || process.env.AWS_REGION,
//   bucket: process.env.S3_BUCKET
// })

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use('/api', router);
app.get('/health', (_req: Request, res: Response) => res.json({ message: 'API is running 🚀' }));
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[unhandled]', err)
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: err?.message || 'Unexpected error',
  })
})