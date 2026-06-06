import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject:    { type: String, required: true, trim: true, maxlength: 200 },
  message:    { type: String, required: true, trim: true, maxlength: 5000 },
  status:     { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
  priority:   { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  adminReply: { type: String, default: '' },
  repliedAt:  { type: Date },
}, { timestamps: true });

export default mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
