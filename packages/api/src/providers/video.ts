import type { VideoGenerator } from '@shared/types';
import { storageKey, persistBuffer, publicUrl } from '@shared/utils/storage';


async function makeMockMp4(): Promise<string> {
const { spawn } = await import('node:child_process');
const fs = await import('node:fs/promises');
const path = await import('node:path');
const os = await import('node:os');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mockvid-'));
const out = path.join(dir, 'mock.mp4');
const args = ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:d=3', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', out];
await new Promise<void>((resolve, reject) => { const p = spawn('ffmpeg', args); p.on('close', c => c===0?resolve():reject(new Error('ffmpeg mock failed'))); });
const buf = await fs.readFile(out);
const key = storageKey('intermediate', `${Date.now()}.mp4`);
await persistBuffer(key, buf, 'video/mp4');
return key;
}


const jobs = new Map<string, { state: 'queued'|'running'|'failed'|'complete'; key?: string }>();


export const videoGen: VideoGenerator = {
async start({ imageUrl, prompt }) {
const id = Math.random().toString(36).slice(2);
jobs.set(id, { state: 'queued' });
setTimeout(async () => {
jobs.set(id, { state: 'running' });
try { 
    console.log('[videoGen] mock generation starting for', id);
    const key = await makeMockMp4();
    console.log('[videoGen] mock generation complete, key:', key);
    jobs.set(id, { state: 'complete', key }); }
catch (err) {
    console.error('[videoGen] mock generation failed:', err);
    jobs.set(id, { state: 'failed' });
  }
}, 1000);
return { jobId: id };
},
async getStatus(jobId) {
const j = jobs.get(jobId) || { state: 'queued' as const };
if (j.state === 'complete' && j.key) return { state: 'complete', videoUrl: publicUrl(j.key) };
return { state: j.state };
}
};