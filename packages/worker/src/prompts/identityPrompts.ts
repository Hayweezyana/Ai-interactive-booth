export function baseIdentityLock() {
  return `
STRICT IDENTITY PRESERVATION MODE.

These are real people.
You MUST preserve their facial identity exactly.

Rules:
- Do NOT beautify
- Do NOT stylize faces
- Do NOT change age
- Do NOT alter skin tone
- Do NOT modify nose, lips, jaw, eyes, or face shape
- Keep hairstyle and hairline consistent
- No face swapping
- No identity blending

Any deviation is a failure.
`;
}

export function hugPrompt(userPrompt: string) {
  return `
${baseIdentityLock()}

Scene:
Two people share a warm, natural hug.

Composition:
- Person A is on the LEFT (Reference Image 1)
- Person B is on the RIGHT (Reference Image 2)
- Both faces fully visible
- Natural camera distance (no close crop)
- Friendly, realistic body language

Style:
- Photorealistic
- Soft natural lighting
- Real camera look
- No cinematic exaggeration

User intent:
${userPrompt}
`;
}

export function selfiePrompt(userPrompt: string) {
  return `
${baseIdentityLock()}

Scene:
Two people taking a casual selfie together.

Composition:
- Person A holds the camera (Reference Image 1)
- Person B stands slightly behind or beside (Reference Image 2)
- Faces centered and sharp
- No lens distortion

Style:
- Real smartphone photo
- Natural lighting
- No beauty filters
- Slight imperfections allowed

User intent:
${userPrompt}
`;
}

export function singlePersonPrompt(userPrompt: string) {
  return `
${baseIdentityLock()}

Scene:
Single person recreation.

Composition:
- Match reference image exactly
- Same facial identity
- Same proportions

User intent:
${userPrompt}
`;
}
