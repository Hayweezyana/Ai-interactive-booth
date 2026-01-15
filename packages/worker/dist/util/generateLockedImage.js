"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLockedImage = generateLockedImage;
exports.generateWithFallback = generateWithFallback;
const openai_1 = __importDefault(require("openai"));
const env_1 = require("@app/shared/env");
const openai = new openai_1.default({ apiKey: env_1.env.OPENAI_API_KEY });
async function generateLockedImage(prompt, base64Images, model = 'gpt-4.1') {
    console.log('[generateLockedImage] Starting with', base64Images.length, 'images');
    // Validate base64 images
    base64Images.forEach((b64, idx) => {
        console.log(`[generateLockedImage] Image ${idx} base64 length:`, b64.length);
        // Check if it's actually base64 by trying to decode first few chars
        const firstChars = b64.slice(0, 50);
        console.log(`[generateLockedImage] Image ${idx} first chars:`, firstChars);
    });
    const response = await openai.responses.create({
        model,
        input: [{
                role: 'user',
                content: [
                    { type: 'input_text', text: prompt },
                    ...base64Images.map((b64, idx) => {
                        // Ensure we're sending clean base64 without any data URL prefix
                        const cleanBase64 = b64.replace(/^data:image\/[a-z]+;base64,/, '');
                        console.log(`[generateLockedImage] Sending image ${idx}, clean base64 length:`, cleanBase64.length);
                        return {
                            type: 'input_image',
                            image_url: `data:image/png;base64,${cleanBase64}`,
                            detail: 'auto'
                        };
                    })
                ]
            }],
        tools: [{ type: 'image_generation' }],
        tool_choice: { type: 'image_generation' }
    });
    // The actual structure: image_generation_call with result field
    for (const item of response.output ?? []) {
        // Check for image_generation_call type with result field
        if (item.type === 'image_generation_call' && item.result) {
            const result = item.result;
            console.log('[image] Found image_generation_call with result');
            // Result might have b64_json, image, or be the base64 string directly
            if (typeof result === 'string') {
                console.log('[image] Result is direct string');
                return result;
            }
            if (result.b64_json) {
                console.log('[image] Found result.b64_json');
                return result.b64_json;
            }
            if (result.image) {
                console.log('[image] Found result.image');
                return result.image;
            }
            if (result.image_base64) {
                console.log('[image] Found result.image_base64');
                return result.image_base64;
            }
            if (result.data) {
                console.log('[image] Found result.data');
                return result.data;
            }
        }
        // Direct b64_json field
        if (item.b64_json) {
            console.log('[image] Found b64_json');
            return item.b64_json;
        }
        // Alternative fields to check
        if (item.image_base64) {
            console.log('[image] Found image_base64');
            return item.image_base64;
        }
        if (item.image) {
            console.log('[image] Found image');
            return item.image;
        }
        // Check message content structure
        if (item.type === 'message' && item.content) {
            for (const c of item.content) {
                if (c?.b64_json) {
                    console.log('[image] Found in message content b64_json');
                    return c.b64_json;
                }
                if (c?.image_base64) {
                    console.log('[image] Found in message content image_base64');
                    return c.image_base64;
                }
                if (c?.image) {
                    console.log('[image] Found in message content image');
                    return c.image;
                }
            }
        }
    }
    // Log the full structure to debug
    console.error('[image] No image found. Full output structure:');
    console.error('Output array length:', response.output?.length);
    response.output?.forEach((item, idx) => {
        console.error(`Item ${idx}:`, {
            type: item.type,
            keys: Object.keys(item),
            hasResult: !!item.result,
            resultType: typeof item.result,
            resultKeys: item.result ? Object.keys(item.result) : [],
        });
        // Log the actual result content if it exists
        if (item.result) {
            console.error(`Item ${idx} result:`, JSON.stringify(item.result, null, 2));
        }
    });
    throw new Error('No image returned from model');
}
async function generateWithFallback(prompt, base64Images) {
    try {
        return await generateLockedImage(prompt, base64Images);
    }
    catch (err) {
        console.warn('[image] First attempt failed, retrying with explicit identity lock');
        const hardLockPrompt = `
APPROPRIATE FAMILY PHOTOGRAPH REQUEST

Creating a professional, family-friendly photograph for public display.
Context: Photo booth / portrait photography service.
All individuals fully clothed in appropriate attire.
Suitable for all ages and audiences.

Technical Requirements:
- Professional photography quality
- Natural lighting and composition
- Clear, well-framed shot
- Appropriate personal boundaries

Identity Matching (from reference photos):
- Exact facial feature replication
- No modifications to appearance
- Preserve all characteristics from references

${prompt}

Result: Wholesome, appropriate photograph.
`;
        return generateLockedImage(hardLockPrompt, base64Images);
    }
}
