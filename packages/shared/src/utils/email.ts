import { env } from '../env';


export async function sendEmail(to: string, subject: string, html: string) {
if (env.EMAIL_PROVIDER === 'resend') {
const r = await fetch('https://api.resend.com/emails', {
method: 'POST',
headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html })
});
if (!r.ok) throw new Error(`Email failed: ${await r.text()}`);
} else {
console.log(`[EMAIL MOCK] to=${to} subject=${subject}`);
}
}