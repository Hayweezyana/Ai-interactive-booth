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
exports.muxAudioOverVideo = muxAudioOverVideo;
const node_child_process_1 = require("node:child_process");
const storage_1 = require("../utils/storage");
async function muxAudioOverVideo(opts) {
    const [videoRes, audioRes] = await Promise.all([fetch(opts.videoUrl), fetch(opts.audioUrl)]);
    const [videoBuf, audioBuf] = await Promise.all([videoRes.arrayBuffer(), audioRes.arrayBuffer()]);
    const fs = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
    const path = await Promise.resolve().then(() => __importStar(require('node:path')));
    const os = await Promise.resolve().then(() => __importStar(require('node:os')));
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mux-'));
    const vPath = path.join(dir, 'in.mp4');
    const aPath = path.join(dir, 'in.mp3');
    const oPath = path.join(dir, 'out.mp4');
    await fs.writeFile(vPath, Buffer.from(videoBuf));
    await fs.writeFile(aPath, Buffer.from(audioBuf));
    const args = ['-y', '-i', vPath, '-i', aPath, '-filter:a', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', oPath];
    await new Promise((resolve, reject) => { const p = (0, node_child_process_1.spawn)('ffmpeg', args); p.on('close', c => c === 0 ? resolve() : reject(new Error('ffmpeg failed'))); });
    const key = (0, storage_1.storageKey)('final', `${Date.now()}.mp4`);
    const outBuf = await fs.readFile(oPath);
    await (0, storage_1.persistBuffer)(key, outBuf, 'video/mp4');
    return key;
}
