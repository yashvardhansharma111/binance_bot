import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { setOtp } from '@/lib/otpCache';
import { sendOtpEmail } from '@/lib/mail';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req) {
  try {
    const { email, purpose } = await req.json();
    if (!email || !['signup', 'reset'].includes(purpose)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    await connectDB();

    if (purpose === 'signup') {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    if (purpose === 'reset') {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (!exists) return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    const otp = generateOtp();
    setOtp(purpose, email, otp);
    await sendOtpEmail(email, otp, purpose);

    return NextResponse.json({ message: 'OTP sent' });
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send OTP. Try again.' }, { status: 500 });
  }
}
