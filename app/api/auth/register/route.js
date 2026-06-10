import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { getOtp, deleteOtp } from '@/lib/otpCache';
import { sendWelcomeEmail } from '@/lib/mail';
import { validatePassword } from '@/lib/passwordUtils';

function generateReferralCode(name) {
  const base = name.replace(/\s+/g, '').toUpperCase().slice(0, 4);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${rand}`;
}

export async function POST(req) {
  try {
    const { name, email, password, referralCode, otp } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    const { valid, failures } = validatePassword(password);
    if (!valid)
      return NextResponse.json({ error: `Weak password: ${failures.map(f => f.label).join(', ')}` }, { status: 400 });

    // OTP verification temporarily disabled

    await connectDB();
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) referredBy = referralCode;
    }

    const hashed = await bcrypt.hash(password, 12);
    const code = generateReferralCode(name);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      referralCode: code,
      referredBy,
    });

    deleteOtp('signup', email);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name, user.referralCode).catch(e =>
      console.error('[welcome-email]', e.message)
    );

    return NextResponse.json({
      message: 'Registered successfully',
      referralCode: user.referralCode,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
