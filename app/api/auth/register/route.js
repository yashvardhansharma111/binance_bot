import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

function generateReferralCode(name) {
  const base = name.replace(/\s+/g, '').toUpperCase().slice(0, 4);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${rand}`;
}

export async function POST(req) {
  try {
    const { name, email, password, referralCode } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    await connectDB();
    const exists = await User.findOne({ email });
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
      email,
      password: hashed,
      referralCode: code,
      referredBy,
    });

    return NextResponse.json({
      message: 'Registered successfully',
      referralCode: user.referralCode,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
