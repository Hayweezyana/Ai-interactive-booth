"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bananaProvider = void 0;
const banana_dev_1 = require("@banana-dev/banana-dev");
const apiKey = process.env.BANANA_API_KEY;
const modelKey = process.env.BANANA_MODEL_KEY;
const endpointUrl = process.env.BANANA_URL || process.env.BANANA_ENDPOINT || '';
exports.bananaProvider = {
    name: 'banana',
    async generate(input) {
        if (!endpointUrl) {
            throw new Error('BANANA_URL (or BANANA_ENDPOINT) not set for Banana Client');
        }
        const client = new banana_dev_1.Client(apiKey, endpointUrl);
        // Allow overriding the route if your deployment expects a custom path
        const route = process.env.BANANA_ROUTE || `/call/${modelKey}`;
        const { json } = await client.call(route, {
            prompt: input.prompt,
            image_url: input.imageUrl ?? null,
            duration: input.durationSec ?? 8,
            aspect: input.aspect ?? '16:9',
            seed: input.seed ?? Math.floor(Math.random() * 1e9),
        });
        const url = json?.modelOutputs?.[0]?.video_url || json?.video_url || json?.output_url;
        if (!url)
            throw new Error('Banana model did not return video_url');
        return { url };
    },
};
