import nodemailer from 'nodemailer'
import { env } from '../env'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  })

  return transporter
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
) {
  if (env.EMAIL_PROVIDER !== 'smtp') {
    console.log(`[Immersia ai booth] to=${to} subject=${subject}`)
    return
  }

  const tx = getTransporter()

  const info = await tx.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  console.log('[EMAIL SENT]', {
    to,
    subject,
    messageId: info.messageId,
  })
}
