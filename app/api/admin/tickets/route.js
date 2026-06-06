import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Ticket from '@/lib/models/Ticket';
import User from '@/lib/models/User';

async function requireAdmin(session) {
  if (!session) return false;
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean();
  return user?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!(await requireAdmin(session)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const tickets = await Ticket.find({})
    .sort({ createdAt: -1 })
    .populate('userId', 'name email')
    .lean();

  return NextResponse.json({ tickets });
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!(await requireAdmin(session)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { ticketId, status, adminReply } = await req.json();
  if (!ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 });

  const update = {};
  if (status) update.status = status;
  if (adminReply !== undefined) { update.adminReply = adminReply; update.repliedAt = new Date(); }

  const ticket = await Ticket.findByIdAndUpdate(ticketId, update, { new: true });
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  return NextResponse.json({ ticket });
}
