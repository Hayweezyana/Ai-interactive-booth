"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
function must(name, v) {
    if (!v)
        throw new Error(`Missing env ${name}`);
    return v;
}
exports.s3 = new client_s3_1.S3Client({
    region: must('S3_REGION', process.env.S3_REGION || process.env.AWS_REGION),
    credentials: {
        accessKeyId: must('S3_ACCESS_KEY_ID', process.env.S3_ACCESS_KEY_ID),
        secretAccessKey: must('S3_SECRET_ACCESS_KEY', process.env.S3_SECRET_ACCESS_KEY),
        sessionToken: process.env.AWS_SESSION_TOKEN, // optional
    },
});
