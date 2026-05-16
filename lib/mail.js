import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function baseTemplate(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;}
  .wrap{max-width:520px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;}
  .hdr{background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:32px 36px;text-align:center;}
  .hdr h1{color:white;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;}
  .hdr p{color:#bfdbfe;margin:6px 0 0;font-size:13px;}
  .body{padding:32px 36px;}
  .body p{color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px;}
  .otp-box{background:#eff6ff;border:2px dashed #3b82f6;border-radius:12px;text-align:center;padding:24px 16px;margin:24px 0;}
  .otp-box span{font-size:38px;font-weight:800;color:#1d4ed8;letter-spacing:10px;font-family:monospace;}
  .otp-note{font-size:12px;color:#94a3b8;margin:10px 0 0;}
  .footer{text-align:center;padding:20px 36px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;}
</style></head>
<body><div class="wrap">
  <div class="hdr"><h1>⚡ TrickyX.ai</h1><p>${title}</p></div>
  <div class="body">${body}</div>
  <div class="footer">© 2026 TrickyX.ai · support@trickyx.com<br>This is an automated message, please do not reply.</div>
</div></body></html>`;
}

export async function sendOtpEmail(email, otp, purpose) {
  const isReset  = purpose === 'reset';
  const title    = isReset ? 'Password Reset' : 'Verify Your Email';
  const heading  = isReset ? 'Reset your password' : 'Almost there!';
  const desc     = isReset
    ? 'Use the code below to reset your TrickyX.ai password.'
    : 'Enter the code below to verify your email and create your account.';

  const body = `
    <p>Hi there,</p>
    <p>${desc}</p>
    <div class="otp-box">
      <span>${otp}</span>
      <p class="otp-note">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
    </div>
    <p>If you didn't request this, you can safely ignore this email.</p>`;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      email,
    subject: `${otp} is your TrickyX.ai ${isReset ? 'password reset' : 'verification'} code`,
    html:    baseTemplate(title, body),
  });
}

export async function sendWelcomeEmail(email, name, referralCode) {
  const body = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Welcome to <strong>TrickyX.ai</strong>! Your account has been created successfully. 🎉</p>
    <p>Your AI trading bot is ready to connect. Head to your dashboard to link your Binance API keys and start the bot.</p>
    <p>Your unique referral code is:</p>
    <div class="otp-box">
      <span style="font-size:24px;letter-spacing:6px;">${referralCode}</span>
      <p class="otp-note">Share this with friends — you earn 10% of their trading profits.</p>
    </div>
    <p style="margin-top:24px;">
      <a href="${process.env.NEXTAUTH_URL}/dashboard"
         style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Go to Dashboard →
      </a>
    </p>`;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      email,
    subject: `Welcome to TrickyX.ai, ${name}!`,
    html:    baseTemplate('Account Created', body),
  });
}
