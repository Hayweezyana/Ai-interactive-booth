// // @shared/utils/email.ts - Production-Ready Version

// import nodemailer from 'nodemailer'
// import { env } from '../env'

// interface TransporterConfig {
//   host: string
//   port: number
//   secure: boolean
//   auth: {
//     user: string
//     pass: string
//   }
//   pool: boolean
//   maxConnections: number
//   maxMessages: number
//   rateDelta: number
//   rateLimit: number
//   connectionTimeout: number
//   greetingTimeout: number
//   socketTimeout: number
//   debug: boolean
//   logger: boolean
// }

// interface EmailError extends Error {
//   code?: string
//   command?: string
//   response?: string
//   responseCode?: number
// }

// // Create transporter with better error handling and connection pooling
// const createTransporter = () => {
//   console.log('[email] Creating transporter...')
//   console.log('[email] Host:', env.SMTP_HOST)
//   console.log('[email] Port:', env.SMTP_PORT)
//   console.log('[email] Secure:', env.SMTP_SECURE)
//   console.log('[email] User:', env.SMTP_USER)

//   const config: TransporterConfig = {
//     host: env.SMTP_HOST,
//     port: Number(env.SMTP_PORT),
//     secure: env.SMTP_SECURE === 'true',
//     auth: {
//       user: env.SMTP_USER,
//       pass: env.SMTP_PASS,
//     },
//     // Add these for production reliability
//     pool: true, // Use connection pooling
//     maxConnections: 5,
//     maxMessages: 10,
//     rateDelta: 1000, // Delay between messages
//     rateLimit: 5, // Max 5 emails per rateDelta
//     // Increase timeouts for slow connections
//     connectionTimeout: 10000, // 10 seconds
//     greetingTimeout: 5000,
//     socketTimeout: 10000,
//     // Debug in development
//     debug: process.env.NODE_ENV !== 'production',
//     logger: process.env.NODE_ENV !== 'production',
//   }

//   // For Railway/cloud platforms, try to avoid connection timeout
//   if (process.env.NODE_ENV === 'production') {
//     // Increase timeouts even more in production
//     config.connectionTimeout = 30000 // 30 seconds
//     config.greetingTimeout = 10000
//     config.socketTimeout = 30000
//   }

//   return nodemailer.createTransport(config)
// }

// const transporter = createTransporter()

// // Verify connection on startup (but don't block if it fails)
// transporter.verify((error: Error | null, success: true | undefined) => {
//   if (error) {
//     console.error('[email] ⚠️  SMTP verification failed:', error.message)
//     console.error('[email] Code:', (error as EmailError).code)
//     if ((error as EmailError).code === 'ETIMEDOUT') {
//       console.error('[email] Connection timeout - check if Railway blocks SMTP ports')
//       console.error('[email] Try using port 587 or consider SendGrid/Resend instead')
//     }
//   } else {
//     console.log('[email] ✅ SMTP server is ready to send emails')
//   }
// })

// export async function sendEmail(
//   to: string,
//   subject: string,
//   html: string
// ): Promise<void> {
//   console.log('[email] Sending to:', to)

//   try {
//     const info = await transporter.sendMail({
//       from: env.EMAIL_FROM,
//       to,
//       subject,
//       html,
//       // Add plain text version
//       text: html.replace(/<[^>]*>/g, ''),
//     })

//     console.log('[email] ✅ Message sent:', info.messageId)
//     console.log('[email] Response:', info.response)
//   } catch (error: unknown) {
//     const emailError = error as EmailError
//     console.error('[email] ❌ Send failed:', emailError.message)
//     console.error('[email] Error details:', {
//       code: emailError.code,
//       command: emailError.command,
//       response: emailError.response,
//       responseCode: emailError.responseCode,
//     })

//     // Provide helpful error messages
//     if (emailError.code === 'ETIMEDOUT') {
//       throw new Error('Email service timeout - the hosting platform may block SMTP connections')
//     } else if (emailError.code === 'ECONNREFUSED') {
//       throw new Error('SMTP connection refused - check server and port settings')
//     } else if (emailError.code === 'EAUTH') {
//       throw new Error('SMTP authentication failed - check username and password')
//     } else {
//       throw new Error(`Email failed: ${emailError.message}`)
//     }
//   }
// }

// // Template function (unchanged)
// export function getVideoEmailTemplate(
//   videoUrl: string,
//   shareUrl?: string
// ): string {
//   const linkUrl = shareUrl || videoUrl

//   return `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="utf-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <title>Your Immersia AI Video</title>
// </head>
// <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
//   <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
//     <!-- Header -->
//     <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
//       <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">
//         🎬 Your Video is Ready!
//       </h1>
//       <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
//         Created with Immersia AI Studio
//       </p>
//     </div>

//     <!-- Content -->
//     <div style="padding: 40px 30px;">
//       <p style="margin: 0 0 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
//         Your AI-generated video is ready to view! Click the button below to watch and download your creation.
//       </p>

//       <!-- CTA Button -->
//       <div style="text-align: center; margin: 30px 0;">
//         <a href="${linkUrl}" 
//            style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
//           VIEW YOUR VIDEO
//         </a>
//       </div>

//       <p style="margin: 30px 0 10px 0; color: #666; font-size: 14px; line-height: 1.6;">
//         Or copy this link to share:
//       </p>
      
//       <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 13px; color: #555; border: 1px solid #e5e7eb;">
//         ${linkUrl}
//       </div>

//       <!-- Footer Info -->
//       <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
//         <p style="margin: 0 0 10px 0; color: #999; font-size: 13px;">
//           💡 <strong>Tip:</strong> Download your video soon! Links may expire after 30 days.
//         </p>
//       </div>
//     </div>

//     <!-- Footer -->
//     <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
//       <p style="margin: 0; color: #999; font-size: 12px;">
//         © ${new Date().getFullYear()} Immersia AI Studio
//       </p>
//     </div>
//   </div>
// </body>
// </html>
//   `.trim()
// }

// packages/shared/src/utils/email.ts
// COMPLETE REPLACEMENT - Delete old nodemailer code

import { Resend } from 'resend'
import { env } from '../env'

const resend = new Resend(process.env.RESEND_API_KEY || env.RESEND_API_KEY)

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  console.log('[email] Sending via Resend to:', to)

  try {
    const { data, error } = await resend.emails.send({
      from: 'Immersia AI Studio <noreply@aivideobooth.immersiavr.com>',
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('[email] ❌ Resend error:', error)
      throw new Error(`Email failed: ${error.message}`)
    }

    console.log('[email] ✅ Email sent successfully!')
    console.log('[email] Message ID:', data?.id)
  } catch (error: any) {
    console.error('[email] ❌ Send failed:', error.message)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

export function getVideoEmailTemplate(
  videoUrl: string,
  shareUrl?: string
): string {
  const linkUrl = shareUrl || videoUrl

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
        Or copy this link to share:
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
  `.trim()
}