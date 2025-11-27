"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoGen = void 0;
const storage_1 = require("@shared/utils/storage");
async function makeMockMp4() {
    const { spawn } = await Promise.resolve().then(() => __importStar(require('node:child_process')));
    const fs = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
    const path = await Promise.resolve().then(() => __importStar(require('node:path')));
    const os = await Promise.resolve().then(() => __importStar(require('node:os')));
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mockvid-'));
    const out = path.join(dir, 'mock.mp4');
    const args = ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:d=3', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', out];
    await new Promise((resolve, reject) => { const p = spawn('ffmpeg', args); p.on('close', c => c === 0 ? resolve() : reject(new Error('ffmpeg mock failed'))); });
    const buf = await fs.readFile(out);
    const key = (0, storage_1.storageKey)('intermediate', `${Date.now()}.mp4`);
    await (0, storage_1.persistBuffer)(key, buf, 'video/mp4');
    return key;
}
const jobs = new Map();
exports.videoGen = {
    async start({ imageUrl, prompt }) {
        const id = Math.random().toString(36).slice(2);
        jobs.set(id, { state: 'queued' });
        setTimeout(async () => {
            jobs.set(id, { state: 'running' });
            try {
                const key = await makeMockMp4();
                jobs.set(id, { state: 'complete', key });
            }
            catch {
                jobs.set(id, { state: 'failed' });
            }
        }, 1000);
        return { jobId: id };
    },
    async getStatus(jobId) {
        const j = jobs.get(jobId) || { state: 'queued' };
        if (j.state === 'complete' && j.key)
            return { state: 'complete', videoUrl: (0, storage_1.publicUrl)(j.key) };
        return { state: j.state };
    }
};
