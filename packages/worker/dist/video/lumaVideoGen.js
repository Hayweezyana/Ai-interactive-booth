"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoGen = void 0;
// packages/worker/src/video/lumaVideoGen.ts
const client_1 = require("@fal-ai/client");
const FAL_KEY = (process.env.FAL_KEY || '').trim();
console.log('[worker][Luma] FAL_KEY present?', !!FAL_KEY);
if (FAL_KEY) {
    client_1.fal.config({ credentials: FAL_KEY });
}
else {
    console.warn('[worker][Luma] WARNING: FAL_KEY is not set. Video gen will fail.');
}
const jobs = new Map();
function mapDuration(durationSec) {
    if (!durationSec)
        return '5s';
    return durationSec >= 9 ? '9s' : '5s';
}
function mapAspect(aspect) {
    if (!aspect)
        return '16:9';
    if (['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'].includes(aspect)) {
        return aspect;
    }
    return '16:9';
}
exports.videoGen = {
    async start({ imageUrl, prompt, aspect, durationSec, styleHints }) {
        if (!FAL_KEY) {
            throw new Error('FAL_KEY is not configured (set it in packages/shared/.env)');
        }
        const jobId = Math.random().toString(36).slice(2);
        jobs.set(jobId, { state: 'running' });
        (async () => {
            try {
                const input = {
                    prompt,
                    aspect_ratio: mapAspect(aspect),
                    duration: mapDuration(durationSec),
                    loop: false,
                };
                if (imageUrl) {
                    input.image_url = imageUrl;
                }
                if (styleHints) {
                    input.prompt = `${prompt}\n\nStyle hints: ${styleHints}`;
                }
                console.log('[worker][Luma] starting fal.run for job', jobId, 'input:', input);
                const result = await client_1.fal.run('fal-ai/luma-dream-machine', { input });
                console.log('[worker][Luma] result raw for job', jobId, result);
                const url = result.data?.video?.url ||
                    result.data?.output?.video?.url;
                if (!url) {
                    const err = 'Luma Dream Machine completed but no video URL was returned in result.data.video.url';
                    console.error('[worker][Luma] ERROR:', err);
                    jobs.set(jobId, { state: 'failed', error: err });
                    return;
                }
                jobs.set(jobId, { state: 'complete', videoUrl: url });
            }
            catch (e) {
                let msg = e?.message || String(e);
                if (e?.response) {
                    try {
                        const text = await e.response.text();
                        console.error('[worker][Luma] response body:', text);
                        msg += ` | body: ${text}`;
                    }
                    catch {
                        // ignore
                    }
                }
                console.error('[worker][Luma] ERROR during fal.run for job', jobId, msg);
                jobs.set(jobId, { state: 'failed', error: msg });
            }
        })();
        return { jobId };
    },
    async getStatus(jobId) {
        const j = jobs.get(jobId);
        if (!j)
            return { state: 'queued' };
        if (j.state === 'failed') {
            return { state: 'failed', error: j.error };
        }
        if (j.state === 'complete') {
            return { state: 'complete', videoUrl: j.videoUrl };
        }
        return { state: j.state };
    },
};
