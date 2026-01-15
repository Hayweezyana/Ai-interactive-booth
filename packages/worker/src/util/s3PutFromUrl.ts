// import { storageKey, persistBuffer } from '@shared/utils/storage'

// /**
//  * Upload a remote URL directly into S3
//  */
// export async function s3PutFromUrl(
//   sourceUrl: string,
//   keyPrefix: 'vertex-gen' | 'uploads' | 'intermediate' | 'tts' | 'final',
//   mime: string
// ): Promise<string> {
//   // Node 18+ global fetch
//   const res = await fetch(sourceUrl)

//   if (!res.ok) {
//     const txt = await res.text().catch(() => '')
//     throw new Error(
//       `s3PutFromUrl fetch failed ${res.status}: ${txt.slice(0, 300)}`
//     )
//   }

//   const arrayBuf = await res.arrayBuffer()
//   const buf = Buffer.from(arrayBuf)

//   const ext = mime.split('/')[1] || 'bin'
//   const key = storageKey(keyPrefix, `${Date.now()}.${ext}`)

//   await persistBuffer(key, buf, mime)
//   return key
// }

// /**
//  * Upload a raw Buffer directly into S3
//  * (Used for OpenAI base64 → buffer workflows)
//  */
// export async function s3PutBuffer(
//   buffer: Buffer,
//   keyPrefix: 'vertex-gen' | 'uploads' | 'intermediate' | 'tts' | 'final',
//   mime: string
// ): Promise<string> {
//   const ext = mime.split('/')[1] || 'bin'
//   const key = storageKey(keyPrefix, `${Date.now()}.${ext}`)

//   await persistBuffer(key, buffer, mime)
//   return key
// }

import { storageKey, persistBuffer } from '@shared/utils/storage'

/**
 * Upload a remote URL directly into S3
 */
export async function s3PutFromUrl(
  sourceUrl: string,
  keyPrefix: 'openai-gen' | 'uploads' | 'intermediate' | 'tts' | 'final',
  mime: string
): Promise<string> {
  // Node 18+ global fetch
  const res = await fetch(sourceUrl)

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(
      `s3PutFromUrl fetch failed ${res.status}: ${txt.slice(0, 300)}`
    )
  }

  const arrayBuf = await res.arrayBuffer()
  const buf = Buffer.from(arrayBuf)

  const ext = mime.split('/')[1] || 'bin'
  const key = storageKey(keyPrefix as any, `${Date.now()}.${ext}`)

  await persistBuffer(key, buf, mime)
  return key
}

/**
 * Upload a raw Buffer directly into S3
 * (Used for OpenAI base64 → buffer workflows)
 */
export async function s3PutBuffer(
  buffer: Buffer,
  keyPrefix: 'openai-gen' | 'uploads' | 'intermediate' | 'tts' | 'final',
  mime: string
): Promise<string> {
  const ext = mime.split('/')[1] || 'bin'
  const key = storageKey(keyPrefix as any, `${Date.now()}.${ext}`)

  await persistBuffer(key, buffer, mime)
  return key
}
