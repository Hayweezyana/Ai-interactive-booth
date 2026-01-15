"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../env");
let transporter = null;
function getTransporter() {
    if (transporter)
        return transporter;
    transporter = nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: Number(env_1.env.SMTP_PORT),
        secure: env_1.env.SMTP_SECURE === 'true',
        auth: {
            user: env_1.env.SMTP_USER,
            pass: env_1.env.SMTP_PASS,
        },
    });
    return transporter;
}
async function sendEmail(to, subject, html) {
    if (env_1.env.EMAIL_PROVIDER !== 'smtp') {
        console.log(`[EMAIL MOCK] to=${to} subject=${subject}`);
        return;
    }
    const tx = getTransporter();
    const info = await tx.sendMail({
        from: env_1.env.EMAIL_FROM,
        to,
        subject,
        html,
    });
    console.log('[EMAIL SENT]', {
        to,
        subject,
        messageId: info.messageId,
    });
}
