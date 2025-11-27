import type { ImageUnderstanding } from '@shared/types';
export const gemini: ImageUnderstanding = {
async describe({ imageUrl, userPrompt }) {
const refinedPrompt = `${userPrompt}
(Refined with context from image: ${imageUrl})`;
const storyboard = { shots: [ { t: 0, desc: 'Zoom on subject' }, { t: 2, desc: 'Pan to scene' } ] };
return { refinedPrompt, storyboard };
}
};