"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bananaProvider = void 0;
const banana_dev_1 = __importDefault(require("@banana-dev/banana-dev"));
const apiKey = process.env.GEMINI_API_KEY;
const modelKey = process.env.BANANA_MODEL_KEY;
exports.bananaProvider = {
    name: 'banana',
    async generate(input) {
        // Adapt to your Banana model’s expected input schema
        const out = await banana_dev_1.default.run(apiKey, modelKey, {
            prompt: input.prompt,
            image_url: input.imageUrl ?? null,
            duration: input.durationSec ?? 8,
            aspect: input.aspect ?? '16:9',
            seed: input.seed ?? Math.floor(Math.random() * 1e9),
            // any other knobs your model expects
        });
        // Expect something like { modelOutputs: [{ video_url: '...' }] }
        const url = out?.modelOutputs?.[0]?.video_url || out?.video_url || out?.output_url;
        if (!url)
            throw new Error('Banana model did not return video_url');
        return { url };
    },
};
