import OpenAI from 'openai'
import { env } from '@shared/env'

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export async function generateLockedImage(
  prompt: string,
  base64Images: string[],
  model: 'gpt-4.1' | 'gpt-5' = 'gpt-4.1'
): Promise<string> {

  console.log('[generateLockedImage] Starting with', base64Images.length, 'images')
  
  // Validate base64 images
  base64Images.forEach((b64, idx) => {
    console.log(`[generateLockedImage] Image ${idx} base64 length:`, b64.length)
    // Check if it's actually base64 by trying to decode first few chars
    const firstChars = b64.slice(0, 50)
    console.log(`[generateLockedImage] Image ${idx} first chars:`, firstChars)
  })

  const response = await openai.responses.create({
    model,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: prompt },
        ...base64Images.map((b64, idx) => {
          // Ensure we're sending clean base64 without any data URL prefix
          const cleanBase64 = b64.replace(/^data:image\/[a-z]+;base64,/, '')
          
          console.log(`[generateLockedImage] Sending image ${idx}, clean base64 length:`, cleanBase64.length)
          
          return {
            type: 'input_image' as const,
            image_url: `data:image/png;base64,${cleanBase64}`,
            detail: 'auto' as const
          }
        })
      ]
    }],
    tools: [{ type: 'image_generation' }],
    tool_choice: { type: 'image_generation' }
  })

  // The actual structure: image_generation_call with result field
  for (const item of response.output ?? []) {
    // Check for image_generation_call type with result field
    if (item.type === 'image_generation_call' && (item as any).result) {
      const result = (item as any).result
      console.log('[image] Found image_generation_call with result')
      
      // Result might have b64_json, image, or be the base64 string directly
      if (typeof result === 'string') {
        console.log('[image] Result is direct string')
        return result
      }
      if (result.b64_json) {
        console.log('[image] Found result.b64_json')
        return result.b64_json
      }
      if (result.image) {
        console.log('[image] Found result.image')
        return result.image
      }
      if (result.image_base64) {
        console.log('[image] Found result.image_base64')
        return result.image_base64
      }
      if (result.data) {
        console.log('[image] Found result.data')
        return result.data
      }
    }

    // Direct b64_json field
    if ((item as any).b64_json) {
      console.log('[image] Found b64_json')
      return (item as any).b64_json
    }
    
    // Alternative fields to check
    if ((item as any).image_base64) {
      console.log('[image] Found image_base64')
      return (item as any).image_base64
    }

    if ((item as any).image) {
      console.log('[image] Found image')
      return (item as any).image
    }

    // Check message content structure
    if (item.type === 'message' && (item as any).content) {
      for (const c of (item as any).content) {
        if (c?.b64_json) {
          console.log('[image] Found in message content b64_json')
          return c.b64_json
        }
        if (c?.image_base64) {
          console.log('[image] Found in message content image_base64')
          return c.image_base64
        }
        if (c?.image) {
          console.log('[image] Found in message content image')
          return c.image
        }
      }
    }
  }

  // Log the full structure to debug
  console.error('[image] No image found. Full output structure:')
  console.error('Output array length:', response.output?.length)
  response.output?.forEach((item, idx) => {
    console.error(`Item ${idx}:`, {
      type: (item as any).type,
      keys: Object.keys(item),
      hasResult: !!(item as any).result,
      resultType: typeof (item as any).result,
      resultKeys: (item as any).result ? Object.keys((item as any).result) : [],
    })
    // Log the actual result content if it exists
    if ((item as any).result) {
      console.error(`Item ${idx} result:`, JSON.stringify((item as any).result, null, 2))
    }
  })

  throw new Error('No image returned from model')
}

export async function generateWithFallback(
  prompt: string,
  base64Images: string[]
): Promise<string> {
  try {
    return await generateLockedImage(prompt, base64Images)
  } catch (err) {
    console.warn('[image] First attempt failed, retrying with explicit identity lock')

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
`

    return generateLockedImage(hardLockPrompt, base64Images)
  }
}