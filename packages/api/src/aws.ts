import { S3Client } from '@aws-sdk/client-s3'

function must(name: string, v?: string) {
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export const s3 = new S3Client({
  region: must('S3_REGION', process.env.S3_REGION || process.env.AWS_REGION),
  credentials: {
    accessKeyId: must('S3_ACCESS_KEY_ID', process.env.S3_ACCESS_KEY_ID),
    secretAccessKey: must('S3_SECRET_ACCESS_KEY', process.env.S3_SECRET_ACCESS_KEY),
    sessionToken: process.env.AWS_SESSION_TOKEN, // optional
  },
})
