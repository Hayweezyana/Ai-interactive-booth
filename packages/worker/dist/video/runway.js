"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoGen = void 0;
const RUNWAY_API_SECRET = process.env.RUNWAYML_API_SECRET;
if (!RUNWAY_API_SECRET) {
    // Fail fast so you don't sit there wondering why jobs are stuck
    throw new Error('RUNWAYML_API_SECRET is not set');
}
// You can override these via env if you want
const RUNWAY_MODEL = process.env.RUNWAYML_MODEL || 'gen4_turbo'; // or "gen3a_turbo" depending on your access
const RUNWAY_VERSION = process.env.RUNWAYML_VERSION || '2024-11-06';
const RUNWAY_BASE = process.env.RUNWAYML_BASE_URL || 'https://api.dev.runwayml.com';
// Map our aspect ratios ("16:9", "9:16", "1:1") to Runway's `ratio` values
function toRunwayRatio(aspect) {
    switch (aspect) {
        case '9:16':
            return '768:1280';
        case '1:1':
            return '1024:1024';
        // default 16:9 style
        case '16:9':
        default:
            // Example from docs uses 1280x720 / 1280:720
            return '1280:720';
    }
}
// This is what your worker already imports
exports.videoGen = {
    async start({ imageUrl, secondaryImageUrl, prompt, aspect, durationSec, seed, }) {
        const ratio = toRunwayRatio(aspect);
        const duration = durationSec ?? 5;
        console.log('[videoGen] STARTING RUNWAY JOB WITH:', {
            image1: imageUrl,
            image2: secondaryImageUrl
        });
        const body = {
            promptImage: imageUrl,
            secondaryImage: secondaryImageUrl ? secondaryImageUrl : undefined,
            promptText: prompt,
            model: RUNWAY_MODEL,
            ratio,
            duration,
            seed,
            watermark: false,
        };
        const res = await fetch(`${RUNWAY_BASE}/v1/image_to_video`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RUNWAY_API_SECRET}`,
                'Content-Type': 'application/json',
                'X-Runway-Version': RUNWAY_VERSION,
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        }
        catch {
            json = undefined;
        }
        if (!res.ok) {
            throw new Error(`Runway image_to_video HTTP ${res.status}: ${text.slice(0, 500)}`);
        }
        if (!json?.id) {
            throw new Error(`Runway image_to_video response missing id: ${text.slice(0, 500)}`);
        }
        const jobId = String(json.id);
        console.log('[videoGen][Runway] created task', jobId);
        return { jobId };
    },
    async getStatus(jobId) {
        const res = await fetch(`${RUNWAY_BASE}/v1/tasks/${jobId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${RUNWAY_API_SECRET}`,
                'X-Runway-Version': RUNWAY_VERSION,
            },
        });
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        }
        catch {
            json = undefined;
        }
        if (!res.ok) {
            console.error('[videoGen][Runway] tasks error', jobId, `HTTP ${res.status}: ${text.slice(0, 500)}`);
            return { state: 'failed', error: `HTTP ${res.status}` };
        }
        const status = (json?.status || '');
        console.log('[videoGen][Runway] task status', jobId, status);
        if (status === 'SUCCEEDED') {
            const url = json?.output?.[0];
            if (!url) {
                return {
                    state: 'failed',
                    error: 'SUCCEEDED but no output URL',
                };
            }
            return { state: 'complete', videoUrl: url };
        }
        if (status === 'FAILED' || status === 'CANCELLED') {
            const failure = json?.failure || status;
            return { state: 'failed', error: String(failure) };
        }
        if (status === 'RUNNING') {
            return { state: 'running' };
        }
        if (status === 'PENDING' || status === 'THROTTLED' || !status) {
            return { state: 'queued' };
        }
        return { state: 'queued' };
    },
};
