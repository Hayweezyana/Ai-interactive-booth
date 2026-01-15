import Replicate from 'replicate'

// Ensure API token is present
if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error('REPLICATE_API_TOKEN is not set')
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export const faceSwap = {
  async swap({ faceUrl, targetUrl }: { faceUrl: string; targetUrl: string }) {
    console.log('[FaceSwap] Starting swap...', { faceUrl, targetUrl })

    // 1. Fetch the latest version of the model dynamically
    //    We use "lucataco/faceswap" which is a standard InsightFace wrapper
    const model = await replicate.models.get("lucataco", "faceswap")
    const latestVersion = model.latest_version?.id

    if (!latestVersion) {
      throw new Error('Could not find latest version for lucataco/faceswap')
    }

    console.log('[FaceSwap] Using version:', latestVersion)

    // Using lucataco/faceswap (InsightFace implementation)
    // See: https://replicate.com/lucataco/faceswap
    const output = await replicate.run(
      `lucataco/faceswap:${latestVersion}`,
      {
        input: {
          target_image: targetUrl, // The "Body" image (Template)
          swap_image: faceUrl,     // The "Face" image (User)
        }
      }
    )

    // Replicate returns the URL as the output
    const resultUrl = String(output)
    
    if (!resultUrl || !resultUrl.startsWith('http')) {
      throw new Error(`FaceSwap failed, invalid output: ${resultUrl}`)
    }

    console.log('[FaceSwap] Success:', resultUrl)
    return resultUrl
  }
}