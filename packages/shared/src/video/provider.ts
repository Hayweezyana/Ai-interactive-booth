export type GenerateVideoInput = {
  prompt: string
  imageUrl?: string
  durationSec?: number
  aspect?: '16:9'|'9:16'|'1:1'
  seed?: number
}

export type GenerateVideoResult = {
  url: string // where we can fetch the video file
}

export interface VideoProvider {
  name: string
  generate(input: GenerateVideoInput): Promise<GenerateVideoResult>
}
