import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Ticket from '@/lib/models/Ticket';
import User from '@/lib/models/User';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tickets = await Ticket.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ tickets });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subject, message, priority } = await req.json();
  if (!subject?.trim() || !message?.trim())
    return NextResponse.json({ error: 'Subject and message required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const ticket = await Ticket.create({
    userId: user._id,
    subject: subject.trim(),
    message: message.trim(),
    priority: priority || 'medium',
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
