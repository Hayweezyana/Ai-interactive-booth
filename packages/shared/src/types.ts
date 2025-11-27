export interface ImageUnderstanding {
describe(input: { imageUrl: string; userPrompt: string }): Promise<{ refinedPrompt: string; storyboard?: any }>;
}


export interface VideoGenerator {
start(input: { imageUrl: string; prompt: string; aspect: string; durationSec: number; styleHints?: any }): Promise<{ jobId: string; statusUrl?: string }>;
getStatus(jobId: string): Promise<{ state: 'queued'|'running'|'failed'|'complete'; videoUrl?: string; error?: string }>;
}


export interface TTS {
synthesize(input: { text: string; voice: string }): Promise<{ audioUrl: string; mime: string }>;
}