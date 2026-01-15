"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tts = void 0;
const storage_1 = require("@shared/utils/storage");
exports.tts = {
    async synthesize({ text, voice }) {
        const { spawn } = await import('node:child_process');
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const os = await import('node:os');
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mocktts-'));
        const out = path.join(dir, 'mock.mp3');
        const args = ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '2', out];
        await new Promise((resolve, reject) => { const p = spawn('ffmpeg', args); p.on('close', c => c === 0 ? resolve() : reject(new Error('ffmpeg tts mock failed'))); });
        const buf = await fs.readFile(out);
        const key = (0, storage_1.storageKey)('tts', `${Date.now()}.mp3`);
        await (0, storage_1.persistBuffer)(key, buf, 'audio/mpeg');
        return { audioUrl: (0, storage_1.publicUrl)(key), mime: 'audio/mpeg' };
    }
};
