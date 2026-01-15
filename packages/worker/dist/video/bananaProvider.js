"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoGen = void 0;
const endpoint = (process.env.BANANA_URL || '').trim();
if (!endpoint) {
    // fail fast so you notice misconfig immediately
    throw new Error('BANANA_URL is not set (e.g. https://<project>.run.banana.dev/)');
}
const bananaProvider = {
    async generate(input) {
        // Shape the payload to whatever your Potassium handler expects:
        const body = {
            prompt: input.prompt,
            image_url: input.imageUrl ?? null,
            duration: input.durationSec ?? 8,
            aspect: input.aspect ?? '16:9',
            seed: input.seed ?? Math.floor(Math.random() * 1e9),
        };
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.BANANA_API_KEY) {
            headers.Authorization = `Bearer ${process.env.BANANA_API_KEY}`;
        }
        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`Banana HTTP ${res.status}: ${text}`);
        }
        let json;
        try {
            json = JSON.parse(text);
        }
        catch {
            throw new Error(`Banana returned non-JSON: ${text.slice(0, 300)}`);
        }
        // Map your server’s response to a video URL.
        // Common patterns: { video_url }, { output_url }, { modelOutputs: [{ video_url }] }
        const url = json?.video_url ||
            json?.output_url ||
            json?.modelOutputs?.[0]?.video_url ||
            json?.modelOutputs?.[0]?.output_url;
        if (!url) {
            throw new Error('Banana response missing video URL');
        }
        return { url };
    },
};
const jobs = new Map();
exports.videoGen = {
    async start({ imageUrl, prompt, aspect, durationSec, seed }) {
        const jobId = Math.random().toString(36).slice(2);
        setTimeout(async () => {
            try {
                console.log('[videoGen][Banana] generation starting for', jobId);
                const allowedAspects = ['16:9', '9:16', '1:1'];
                const aspectArg = typeof aspect === 'string' && allowedAspects.includes(aspect)
                    ? aspect
                    : undefined;
                const result = await bananaProvider.generate({
                    imageUrl,
                    prompt,
                    aspect: aspectArg,
                    durationSec,
                    seed,
                });
                console.log('[videoGen][Banana] generation complete for', jobId, 'url:', result.url);
                jobs.set(jobId, { state: 'complete', videoUrl: result.url });
            }
            catch (err) {
                console.error('[videoGen][Banana] generation failed for', jobId, err);
                jobs.set(jobId, { state: 'failed' });
            }
        }, 1000);
        jobs.set(jobId, { state: 'queued' });
        return { jobId };
    },
    async getStatus(jobId) {
        const j = jobs.get(jobId);
        if (!j) {
            return { state: 'queued' };
        }
        if (j.state === 'complete' && j.videoUrl) {
            return { state: 'complete', videoUrl: j.videoUrl };
        }
        if (j.state === 'failed') {
            return { state: 'failed' };
        }
        // fallback to queued for any other / in-progress states
        return { state: 'queued' };
    },
};
