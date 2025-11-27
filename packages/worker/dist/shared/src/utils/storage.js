"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageKey = storageKey;
exports.publicUrl = publicUrl;
exports.getSignedUpload = getSignedUpload;
exports.persistBuffer = persistBuffer;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const env_1 = require("../env");
const crypto_1 = __importDefault(require("crypto"));
const s3 = new client_s3_1.S3Client({
    region: env_1.env.S3_REGION,
    credentials: { accessKeyId: env_1.env.S3_ACCESS_KEY_ID, secretAccessKey: env_1.env.S3_SECRET_ACCESS_KEY }
});
function storageKey(kind, name) {
    return `${kind}/${name || crypto_1.default.randomUUID()}`;
}
function publicUrl(key) {
    return `${env_1.env.S3_PUBLIC_BASE.replace(/\/$/, '')}/${key}`;
}
async function getSignedUpload(mime = 'image/*') {
    const key = storageKey('uploads');
    const { url, fields } = await (0, s3_presigned_post_1.createPresignedPost)(s3, {
        Bucket: env_1.env.S3_BUCKET,
        Key: key,
        Conditions: [["content-length-range", 0, 30_000_000]],
        Fields: { 'Content-Type': mime },
        Expires: 600
    });
    return { url, fields, bucketKey: key };
}
async function persistBuffer(key, buf, mime) {
    await s3.send(new client_s3_1.PutObjectCommand({ Bucket: env_1.env.S3_BUCKET, Key: key, Body: buf, ContentType: mime }));
    return publicUrl(key);
}
