"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gemini = void 0;
exports.gemini = {
    async describe({ imageUrl, userPrompt }) {
        const refinedPrompt = `${userPrompt}
(Refined with context from image: ${imageUrl})`;
        const storyboard = { shots: [{ t: 0, desc: 'Zoom on subject' }, { t: 2, desc: 'Pan to scene' }] };
        return { refinedPrompt, storyboard };
    }
};
