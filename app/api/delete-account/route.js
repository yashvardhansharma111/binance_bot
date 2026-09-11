import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';
import Commission from '@/lib/models/Commission';
import SubscriptionCommission from '@/lib/models/SubscriptionCommission';
import DepositCommission from '@/lib/models/DepositCommission';
import BotLog from '@/lib/models/BotLog';
import FcmToken from '@/lib/models/FcmToken';
import NotificationPrefs from '@/lib/models/NotificationPrefs';
import ApiKey from '@/lib/models/ApiKey';
import Withdrawal from '@/lib/models/Withdrawal';
import { getOtp, deleteOtp } from '@/lib/otpCache';
import { sendOtpEmail } from '@/lib/mail';
import nodemailer from 'nodemailer';

async function sendDeletionConfirmation(email, name) {
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from:    process.env.SMTP_FROM,
      to:      email,
      subject: 'Your TrickyX.ai account has been deleted',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
          <h2 style="color:#0f172a;">Account Deleted</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Your TrickyX.ai account and all associated personal data have been permanently deleted as requested.</p>
          <p><strong>What was deleted:</strong></p>
          <ul>
            <li>Your profile (name, email, password)</li>
            <li>API keys and bot settings</li>
            <li>Trade history and bot logs</li>
            <li>Push notification tokens</li>
          </ul>
          <p><em>Payment and withdrawal records are retained for 7 years as required by financial regulations (anonymised).</em></p>
          <p>If you did not request this deletion, please contact us immediately at support@trickyx.ai.</p>
          <p style="color:#64748b;font-size:13px;">— TrickyX.ai Team</p>
        </div>`,
    });
  } catch { /* non-critical */ }
}

export async function POST(req) {
  try {
    const { email, otp } = await req.json();
    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
    }

    const stored = getOtp('delete', email);
    if (!stored || stored !== otp.trim()) {
      return NextResponse.json({ error: 'Invalid or expired verification code.' }, { status: 400 });
    }
    deleteOtp('delete', email);

    const userId = user._id;
    const userName = user.name;

    // Delete all personal & operational data
    await Promise.all([
      Trade.deleteMany({ userId }),
      BotLog.deleteMany({ userId }),
      FcmToken.deleteMany({ userId }),
      NotificationPrefs.deleteOne({ userId }),
      ApiKey.deleteMany({ userId }),
      Commission.deleteMany({ userId }),
      SubscriptionCommission.deleteMany({ userId }),
      DepositCommission.deleteMany({ userId }),
    ]);

    // Anonymise withdrawals & payments (keep for financial compliance)
    await Withdrawal.updateMany(
      { userId },
      { $set: { userId: null, walletAddress: '[deleted]' } }
    );

    // Delete the user last
    await User.deleteOne({ _id: userId });

    await sendDeletionConfirmation(email, userName);

    return NextResponse.json({ message: 'Account permanently deleted.' });
  } catch (err) {
    console.error('[delete-account]', err);
    return NextResponse.json({ error: 'Deletion failed. Please try again.' }, { status: 500 });
  }
}
