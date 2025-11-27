import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export type GeminiPlan = {
  narration: string
  stylePrompt: string
}

export async function planFromImage(opts: { imageUrl?: string; userPrompt: string }): Promise<GeminiPlan> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })

  const system = `You are a creative director turning a still image and a user prompt into a short animated video plan.
Return concise JSON with:
- narration: a 1-2 sentence voiceover
- stylePrompt: a compact visual style prompt for a video model
Keep under 300 chars each.`
  const user = `User prompt: ${opts.userPrompt}\nImage URL: ${opts.imageUrl ?? '(none)'}`
  const resp = await model.generateContent([{ text: system }, { text: user }])
  const text = resp.response.text().trim()

  // Try to extract JSON; fallback to plain text if needed.
  try {
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    return {
      narration: String(json.narration || '').slice(0, 500),
      stylePrompt: String(json.stylePrompt || '').slice(0, 500),
    }
  } catch {
    return {
      narration: text.slice(0, 280),
      stylePrompt: opts.userPrompt.slice(0, 280),
    }
  }
}
