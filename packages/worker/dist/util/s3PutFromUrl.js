"use strict";
// import { storageKey, persistBuffer } from '@shared/utils/storage'
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3PutFromUrl = s3PutFromUrl;
exports.s3PutBuffer = s3PutBuffer;
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
const storage_1 = require("@shared/utils/storage");
/**
 * Upload a remote URL directly into S3
 */
async function s3PutFromUrl(sourceUrl, keyPrefix, mime) {
    // Node 18+ global fetch
    const res = await fetch(sourceUrl);
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`s3PutFromUrl fetch failed ${res.status}: ${txt.slice(0, 300)}`);
    }
    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const ext = mime.split('/')[1] || 'bin';
    const key = (0, storage_1.storageKey)(keyPrefix, `${Date.now()}.${ext}`);
    await (0, storage_1.persistBuffer)(key, buf, mime);
    return key;
}
/**
 * Upload a raw Buffer directly into S3
 * (Used for OpenAI base64 → buffer workflows)
 */
async function s3PutBuffer(buffer, keyPrefix, mime) {
    const ext = mime.split('/')[1] || 'bin';
    const key = (0, storage_1.storageKey)(keyPrefix, `${Date.now()}.${ext}`);
    await (0, storage_1.persistBuffer)(key, buffer, mime);
    return key;
}
