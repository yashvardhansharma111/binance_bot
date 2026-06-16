import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function GET(req) {
  const code = new URL(req.url).searchParams.get('code')?.trim().toUpperCase();
  if (!code) return NextResponse.json({ valid: false });
  await connectDB();
  const exists = await User.exists({ referralCode: code });
  return NextResponse.json({ valid: !!exists });
}
