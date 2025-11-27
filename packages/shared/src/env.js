"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
// packages/shared/src/env.ts
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
// find the closest .env by walking upward (monorepo-friendly)
function loadClosestDotenv(startDir) {
    let dir = startDir;
    for (let i = 0; i < 6; i++) { // don't walk forever
        const candidate = node_path_1.default.join(dir, '.env');
        if (node_fs_1.default.existsSync(candidate)) {
            dotenv_1.default.config({ path: candidate });
            return;
        }
        const parent = node_path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    // fallback: normal dotenv (loads from CWD if present)
    dotenv_1.default.config();
}
loadClosestDotenv(__dirname);
exports.env = {
    APP_ORIGIN: process.env.APP_ORIGIN,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_PUBLIC_BASE: process.env.S3_PUBLIC_BASE,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'mock',
    VIDEO_PROVIDER: process.env.VIDEO_PROVIDER || 'mock',
    VIDEO_API_KEY: process.env.VIDEO_API_KEY || 'mock',
    TTS_PROVIDER: process.env.TTS_PROVIDER || 'mock',
    TTS_API_KEY: process.env.TTS_API_KEY || 'mock',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'Studio <no-reply@example.com>',
};
