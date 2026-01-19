"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAsBase64 = fetchAsBase64;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../../.env') });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma_1 = require("@app/shared/prisma");
const storage_1 = require("@app/shared/utils/storage");
const s3PutFromUrl_1 = require("./util/s3PutFromUrl");
const runway_1 = require("./video/runway");
const identityPrompts_1 = require("./prompts/identityPrompts");
const generateLockedImage_1 = require("./util/generateLockedImage");
const env_1 = require("@app/shared/env");
const connection = new ioredis_1.default(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    keepAlive: 30000,
    family: 4,
});
const log = (...args) => console.log('[worker]', ...args);
async function fetchAsBase64(url) {
    console.log('[fetchAsBase64] Fetching:', url);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type') || '';
    console.log('[fetchAsBase64] Content-Type:', contentType);
    if (!contentType.startsWith('image/')) {
        const text = await response.text();
        console.error('[fetchAsBase64] ERROR: Not an image! Content:', text.slice(0, 500));
        throw new Error(`URL returned ${contentType}, not an image. Content starts with: ${text.slice(0, 100)}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Convert to base64 - this is the raw base64 without data URL prefix
    const base64 = buffer.toString('base64');
    console.log('[fetchAsBase64] Success. Size:', buffer.length, 'bytes, Base64 length:', base64.length);
    // Verify it starts with valid image bytes
    const firstBytes = buffer.slice(0, 4).toString('hex');
    console.log('[fetchAsBase64] First bytes (hex):', firstBytes);
    // Check for valid image signatures
    const isPNG = firstBytes.startsWith('89504e47');
    const isJPEG = firstBytes.startsWith('ffd8');
    const isGIF = firstBytes.startsWith('47494638');
    const isWEBP = buffer.slice(8, 12).toString() === 'WEBP';
    if (!isPNG && !isJPEG && !isGIF && !isWEBP) {
        throw new Error('Fetched data does not appear to be a valid image format!');
    }
    console.log('[fetchAsBase64] Valid image format detected:', isPNG ? 'PNG' : isJPEG ? 'JPEG' : isGIF ? 'GIF' : 'WEBP');
    return base64;
}
new bullmq_1.Worker('jobs', async (bullJob) => {
    const { jobId } = bullJob.data;
    log('processing', jobId);
    const job = await prisma_1.prisma.job.findUnique({
        where: { id: jobId },
        include: { sourceImage: true, secondaryImage: true },
    });
    if (!job)
        throw new Error('Job not found');
    try {
        // 1️⃣ Load reference images
        if (!job.sourceImage)
            throw new Error('Source image missing');
        const primaryUrl = (0, storage_1.publicUrl)(job.sourceImage.bucketKey);
        const primaryBase64 = await fetchAsBase64(primaryUrl);
        const base64Images = [primaryBase64];
        if (job.secondaryImage) {
            const secondaryUrl = (0, storage_1.publicUrl)(job.secondaryImage.bucketKey);
            base64Images.push(await fetchAsBase64(secondaryUrl));
        }
        // 2️⃣ Select prompt
        let finalPrompt;
        if (job.promptPreset?.includes('hug')) {
            finalPrompt = (0, identityPrompts_1.hugPrompt)(job.prompt);
        }
        else if (job.promptPreset?.includes('selfie')) {
            finalPrompt = (0, identityPrompts_1.selfiePrompt)(job.prompt);
        }
        else {
            finalPrompt = (0, identityPrompts_1.singlePersonPrompt)(job.prompt);
        }
        // 3️⃣ Generate face-locked image
        await prisma_1.prisma.job.update({ where: { id: jobId }, data: { stage: 'IMAGE_GENERATE' } });
        const imageBase64 = await (0, generateLockedImage_1.generateWithFallback)(finalPrompt, base64Images);
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const imageKey = await (0, s3PutFromUrl_1.s3PutBuffer)(imageBuffer, 'openai-gen', 'image/png');
        const imageUrl = (0, storage_1.publicUrl)(imageKey);
        // 4️⃣ Runway Gen-4 video
        await prisma_1.prisma.job.update({ where: { id: jobId }, data: { stage: 'VIDEO_GENERATE' } });
        const vstart = await runway_1.videoGen.start({
            imageUrl,
            prompt: `
Preserve facial identity exactly.
No morphing.
No face drift.

${job.prompt}
`,
            durationSec: job.durationSec,
            aspect: job.aspect,
        });
        let result;
        for (let i = 0; i < 60; i++) {
            result = await runway_1.videoGen.getStatus(vstart.jobId);
            if (result.state === 'complete')
                break;
            if (result.state === 'failed')
                throw new Error(result.error);
            await new Promise(r => setTimeout(r, 4000));
        }
        if (!result?.videoUrl)
            throw new Error('Runway timeout');
        // 5️⃣ Save final video
        const finalKey = await (0, s3PutFromUrl_1.s3PutFromUrl)(result.videoUrl, 'final', 'video/mp4');
        const asset = await prisma_1.prisma.asset.create({
            data: { kind: 'FINAL_VIDEO', bucketKey: finalKey, mime: 'video/mp4' }
        });
        await prisma_1.prisma.job.update({
            where: { id: jobId },
            data: {
                status: 'COMPLETE',
                stage: 'COMPLETE',
                resultVideoId: asset.id,
            }
        });
        log('completed', jobId);
        // const existingShare = await prisma.share.findFirst({
        //   where: { jobId }
        // })
        // if (!existingShare) {
        //   await prisma.share.create({
        //     data: {
        //       jobId,
        //       slug: Math.random().toString(36).slice(2, 10),
        //     },
        //   })
        // }
    }
    catch (err) {
        console.error('[worker ERROR]', err);
        await prisma_1.prisma.job.update({ where: { id: jobId }, data: { status: 'FAILED' } });
        throw err;
    }
}, {
    connection,
    concurrency: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
});
log('worker online');
