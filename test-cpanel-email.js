// test-cpanel-email.js
// Run with: node test-cpanel-email.js

const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🔧 Testing cPanel SMTP Configuration...\n');

console.log('Configuration:');
console.log('  Host:', process.env.SMTP_HOST);
console.log('  Port:', process.env.SMTP_PORT);
console.log('  Secure:', process.env.SMTP_SECURE);
console.log('  User:', process.env.SMTP_USER);
console.log('  From:', process.env.EMAIL_FROM);
console.log('');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug: true, // Enable debug output
  logger: true, // Log to console
});

console.log('📡 Step 1: Verifying SMTP connection...');

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Connection failed:', error);
    console.error('\nCommon issues:');
    console.error('  - Check SMTP_HOST is correct (usually your domain)');
    console.error('  - Verify SMTP_PORT (465 for SSL, 587 for TLS)');
    console.error('  - Ensure SMTP_SECURE matches port (true for 465)');
    console.error('  - Check SMTP_USER and SMTP_PASS are correct');
    console.error('  - Verify cPanel email account exists');
    console.error('  - Check firewall allows outbound SMTP connections');
    process.exit(1);
  }

  console.log('✅ SMTP connection verified!\n');
  
  console.log('📧 Step 2: Sending test email...');
  
  // Send a test email
  const testEmail = process.argv[2] || process.env.SMTP_USER;
  
  transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: testEmail,
    subject: 'Test Email from Immersia AI Studio',
    text: 'This is a test email from your cPanel SMTP configuration.',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">✅ SMTP Test Successful!</h2>
        <p>If you're reading this, your cPanel SMTP configuration is working correctly.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 14px;">
          <strong>Configuration Details:</strong><br>
          Host: ${process.env.SMTP_HOST}<br>
          Port: ${process.env.SMTP_PORT}<br>
          User: ${process.env.SMTP_USER}<br>
          Sent: ${new Date().toLocaleString()}
        </p>
      </div>
    `,
  }, (error, info) => {
    if (error) {
      console.error('❌ Send failed:', error);
      console.error('\nError details:');
      console.error('  Code:', error.code);
      console.error('  Command:', error.command);
      console.error('  Response:', error.response);
      process.exit(1);
    }
    
    console.log('✅ Test email sent successfully!');
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
    console.log('  Sent to:', testEmail);
    console.log('\n📬 Check your inbox (and spam folder)!');
    process.exit(0);
  });
});

// Handle process errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught error:', error);
  process.exit(1);
});