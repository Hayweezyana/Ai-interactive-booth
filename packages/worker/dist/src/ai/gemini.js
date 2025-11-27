"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planFromImage = planFromImage;
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function planFromImage(opts) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const system = `You are a creative director turning a still image and a user prompt into a short animated video plan.
Return concise JSON with:
- narration: a 1-2 sentence voiceover
- stylePrompt: a compact visual style prompt for a video model
Keep under 300 chars each.`;
    const user = `User prompt: ${opts.userPrompt}\nImage URL: ${opts.imageUrl ?? '(none)'}`;
    const resp = await model.generateContent([{ text: system }, { text: user }]);
    const text = resp.response.text().trim();
    // Try to extract JSON; fallback to plain text if needed.
    try {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        return {
            narration: String(json.narration || '').slice(0, 500),
            stylePrompt: String(json.stylePrompt || '').slice(0, 500),
        };
    }
    catch {
        return {
            narration: text.slice(0, 280),
            stylePrompt: opts.userPrompt.slice(0, 280),
        };
    }
}
