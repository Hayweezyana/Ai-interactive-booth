import { spawn } from 'node:child_process';
import { persistBuffer, storageKey } from '../utils/storage';


export async function muxAudioOverVideo(opts: { videoUrl: string; audioUrl: string; durationSec: number }) {
const [videoRes, audioRes] = await Promise.all([fetch(opts.videoUrl), fetch(opts.audioUrl)]);
const [videoBuf, audioBuf] = await Promise.all([videoRes.arrayBuffer(), audioRes.arrayBuffer()]);


const fs = await import('node:fs/promises');
const path = await import('node:path');
const os = await import('node:os');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mux-'));
const vPath = path.join(dir, 'in.mp4');
const aPath = path.join(dir, 'in.mp3');
const oPath = path.join(dir, 'out.mp4');
await fs.writeFile(vPath, Buffer.from(videoBuf));
await fs.writeFile(aPath, Buffer.from(audioBuf));


const args = ['-y', '-i', vPath, '-i', aPath, '-filter:a', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', oPath];
await new Promise<void>((resolve, reject) => { const p = spawn('ffmpeg', args); p.on('close', c => c===0?resolve():reject(new Error('ffmpeg failed'))); });


const key = storageKey('final', `${Date.now()}.mp4`);
const outBuf = await fs.readFile(oPath);
await persistBuffer(key, outBuf, 'video/mp4');
return key;
}