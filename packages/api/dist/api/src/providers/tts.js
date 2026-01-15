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
exports.tts = void 0;
const storage_1 = require("@shared/utils/storage");
exports.tts = {
    async synthesize({ text, voice }) {
        const { spawn } = await Promise.resolve().then(() => __importStar(require('node:child_process')));
        const fs = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('node:path')));
        const os = await Promise.resolve().then(() => __importStar(require('node:os')));
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
