import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { env } from '../env';
import crypto from 'crypto';


const s3 = new S3Client({
region: env.S3_REGION,
credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
});


export function storageKey(kind: 'uploads'|'intermediate'|'tts'|'final', name?: string) {
return `${kind}/${name || crypto.randomUUID()}`;
}


export function publicUrl(key: string): string {
  const base = process.env.S3_PUBLIC_BASE || `https://ai-interactive-booth-uploads.s3.eu-north-1.amazonaws.com`
  return `${base.replace(/\/$/, '')}/${key.replace(/^\//, '')}`
}


export async function getSignedUpload(mime = 'image/*') {
const key = storageKey('uploads');
const { url, fields } = await createPresignedPost(s3, {
Bucket: env.S3_BUCKET,
Key: key,
Conditions: [["content-length-range", 0, 30_000_000]],
Fields: { 'Content-Type': mime },
Expires: 600
});
return { url, fields, bucketKey: key };
}


export async function persistBuffer(key: string, buf: Buffer, mime: string) {
await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: buf, ContentType: mime }));
return publicUrl(key);
}