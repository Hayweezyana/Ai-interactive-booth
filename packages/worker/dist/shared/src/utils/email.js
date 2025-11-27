"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const env_1 = require("../env");
async function sendEmail(to, subject, html) {
    if (env_1.env.EMAIL_PROVIDER === 'resend') {
        const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env_1.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env_1.env.EMAIL_FROM, to, subject, html })
        });
        if (!r.ok)
            throw new Error(`Email failed: ${await r.text()}`);
    }
    else {
        console.log(`[EMAIL MOCK] to=${to} subject=${subject}`);
    }
}
