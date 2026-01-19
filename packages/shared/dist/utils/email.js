"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.getVideoEmailTemplate = getVideoEmailTemplate;
// @shared/utils/email.ts
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../env");
// Create transporter with cPanel SMTP settings
const transporter = nodemailer_1.default.createTransport({
    host: env_1.env.SMTP_HOST,
    port: Number(env_1.env.SMTP_PORT),
    secure: env_1.env.SMTP_SECURE === 'true', // true for 465
    auth: {
        user: env_1.env.SMTP_USER,
        pass: env_1.env.SMTP_PASS,
    },
    debug: process.env.NODE_ENV !== 'production',
    logger: process.env.NODE_ENV !== 'production',
});
// Verify connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('[email] SMTP connection failed:', error);
    }
    else {
        console.log('[email] SMTP server is ready to send emails');
    }
});
async function sendEmail(to, subject, html) {
    console.log('[email] Sending to:', to);
    try {
        const info = await transporter.sendMail({
            from: env_1.env.EMAIL_FROM,
            to,
            subject,
            html,
            // Add plain text version for better deliverability
            text: html.replace(/<[^>]*>/g, ''), // Strip HTML tags
        });
        console.log('[email] Message sent:', info.messageId);
        console.log('[email] Response:', info.response);
    }
    catch (error) {
        console.error('[email] Send failed:', error);
        console.error('[email] Error details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
        });
        throw error;
    }
}
// Template for video ready email
function getVideoEmailTemplate(videoUrl, shareUrl) {
    const linkUrl = shareUrl || videoUrl;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Immersia AI Video</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">
        🎬 Your Video is Ready!
      </h1>
      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
        Created with Immersia AI Studio
      </p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
        Your AI-generated video is ready to view! Click the button below to watch and download your creation.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${linkUrl}" 
           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
          VIEW YOUR VIDEO
        </a>
      </div>

      <p style="margin: 30px 0 10px 0; color: #666; font-size: 14px; line-height: 1.6;">
        Or copy this link to share with friends:
      </p>
      
      <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 13px; color: #555; border: 1px solid #e5e7eb;">
        ${linkUrl}
      </div>

      <!-- Footer Info -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px 0; color: #999; font-size: 13px;">
          💡 <strong>Tip:</strong> Download your video soon! Links may expire after 30 days.
        </p>
        <p style="margin: 0; color: #999; font-size: 12px;">
          This video was created using AI technology. Share responsibly!
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #999; font-size: 12px;">
        © ${new Date().getFullYear()} Immersia AI Studio. All rights reserved.
      </p>
      <p style="margin: 8px 0 0 0; color: #999; font-size: 11px;">
        Immersia VR - Creating Immersive Experiences
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
