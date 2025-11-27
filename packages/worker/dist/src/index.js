"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const env_1 = require("@shared/env");
const prisma_1 = require("@shared/prisma");
const storage_1 = require("@shared/utils/storage");
const ffmpeg_1 = require("@shared/media/ffmpeg");
const gemini_1 = require("../../api/src/providers/gemini");
const video_1 = require("../../api/src/providers/video");
const tts_1 = require("../../api/src/providers/tts");
const log = (...args) => console.log('[worker]', ...args);
new bullmq_1.Worker('jobs', async (bullJob) => {
    const { jobId } = bullJob.data;
    log('processing', jobId);
    const job = await prisma_1.prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { sourceImage: true } });
    await prisma_1.prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING', stage: 'GEMINI_PREP' } });
    const prep = await gemini_1.gemini.describe({ imageUrl: (0, storage_1.publicUrl)(job.sourceImage.bucketKey), userPrompt: job.prompt });
    await prisma_1.prisma.job.update({ where: { id: jobId }, data: { stage: 'VIDEO_GENERATE' } });
    const vstart = await video_1.videoGen.start({ imageUrl: (0, storage_1.publicUrl)(job.sourceImage.bucketKey), prompt: prep.refinedPrompt, aspect: job.aspect, durationSec: job.durationSec, styleHints: job.styleHints });
    let vres;
    do {
        vres = await video_1.videoGen.getStatus(vstart.jobId);
        if (vres.state === 'failed')
            throw new Error(vres.error || 'video failed');
        if (vres.state !== 'complete')
            await new Promise(r => setTimeout(r, 4000));
    } while (vres.state !== 'complete');
    const interUrl = vres.videoUrl;
    await prisma_1.prisma.job.update({ where: { id: jobId }, data: { stage: 'TTS_GENERATE' } });
    const narration = job.ttsScript || 'Narration based on storyboard.';
    const ttsOut = await tts_1.tts.synthesize({ text: narration, voice: job.voicePreset || 'alloy' });
    await prisma_1.prisma.job.update({ where: { id: jobId }, data: { stage: 'MUX' } });
    const finalKey = await (0, ffmpeg_1.muxAudioOverVideo)({ videoUrl: interUrl, audioUrl: ttsOut.audioUrl, durationSec: job.durationSec });
    const finalAsset = await prisma_1.prisma.asset.create({ data: { kind: 'FINAL_VIDEO', bucketKey: finalKey, mime: 'video/mp4' } });
    await prisma_1.prisma.job.update({ where: { id: jobId }, data: { status: 'COMPLETE', stage: 'COMPLETE', resultVideoId: finalAsset.id } });
    log('completed', jobId);
}, { connection: { url: env_1.env.REDIS_URL } });
