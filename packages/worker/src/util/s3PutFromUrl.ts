// packages/worker/src/util/s3PutFromUrl.ts
import { storageKey, persistBuffer } from '@shared/utils/storage'

export async function s3PutFromUrl(
  sourceUrl: string,
  keyPrefix: 'uploads' | 'intermediate' | 'tts' | 'final',
  mime: string
): Promise<string> {
  // Use Node 18+ global fetch – no node-fetch import
  const res = await fetch(sourceUrl)
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(
      `s3PutFromUrl fetch failed ${res.status}: ${txt.slice(0, 300)}`
    )
  }

  const arrayBuf = await res.arrayBuffer()
  const buf = Buffer.from(arrayBuf)

  const key = storageKey(keyPrefix, `${Date.now()}.mp4`)
  await persistBuffer(key, buf, mime)

  return key
}
