import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { getOtp, deleteOtp } from '@/lib/otpCache';
import { validatePassword } from '@/lib/passwordUtils';

export async function POST(req) {
  try {
    const { email, otp, password } = await req.json();
    if (!email || !otp || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    const { valid, failures } = validatePassword(password);
    if (!valid)
      return NextResponse.json({ error: `Weak password: ${failures.map(f => f.label).join(', ')}` }, { status: 400 });

    const stored = getOtp('reset', email);
    if (!stored) return NextResponse.json({ error: 'OTP expired. Request a new one.' }, { status: 400 });
    if (stored !== otp) return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });

    await connectDB();
    const hashed = await bcrypt.hash(password, 12);
    await User.findOneAndUpdate({ email: email.toLowerCase() }, { password: hashed });
    deleteOtp('reset', email);

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
