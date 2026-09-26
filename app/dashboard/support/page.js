'use client';
import { useState, useEffect } from 'react';
import {
  LifeBuoy, Plus, X, ChevronDown, ChevronUp,
  CheckCircle2, Clock, RefreshCw, MessageSquare, Send,
} from 'lucide-react';

const STATUS_META = {
  open:        { label: 'Open',        color: '#2563eb', bg: '#eff6ff', dot: '#2563eb' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  closed:      { label: 'Closed',      color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
};

const PRIORITY_META = {
  low:    { label: 'Low',    color: '#64748b', bg: '#f1f5f9' },
  medium: { label: 'Medium', color: '#d97706', bg: '#fffbeb' },
  high:   { label: 'High',   color: '#dc2626', bg: '#fef2f2' },
};

export default function SupportPage() {
  const [tickets,    setTickets]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [expanded,   setExpanded]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [form, setForm] = useState({ subject: '', message: '', priority: 'medium' });

  useEffect(() => { fetchTickets(); }, []);

  async function fetchTickets() {
    setLoading(true);
    try {
      const res  = await fetch('/api/tickets');
      const data = await res.json();
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function submitTicket(e) {
    e.preventDefault();
    setError('');
    if (!form.subject.trim() || !form.message.trim()) {
      setError('Subject and message are required.'); return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch('/api/tickets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to submit ticket.'); return; }
      setForm({ subject: '', message: '', priority: 'medium' });
      setShowForm(false);
      await fetchTickets();
      setExpanded(data.ticket?._id);
    } catch { setError('Network error. Try again.'); }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <LifeBuoy size={22} className="text-blue-500" />
            Support
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">Raise a ticket and track admin replies</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setError(''); }}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Ticket</>}
        </button>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <div className="card glow-border p-5 mb-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Raise a New Ticket</h2>
          <form onSubmit={submitTicket} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Subject</label>
              <input
                type="text" required maxLength={200}
                placeholder="Brief description of your issue…"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Message</label>
              <textarea
                required rows={4} maxLength={5000}
                placeholder="Describe your issue in detail…"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="input w-full resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Priority</label>
              <div className="flex gap-2">
                {['low','medium','high'].map(p => {
                  const pm = PRIORITY_META[p];
                  return (
                    <button key={p} type="button"
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className="flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all capitalize"
                      style={{
                        background:  form.priority === p ? pm.bg    : '#f8fafc',
                        color:       form.priority === p ? pm.color : '#94a3b8',
                        borderColor: form.priority === p ? pm.color : '#e2e8f0',
                      }}>
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
            )}
            <button type="submit" disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
              {submitting
                ? <><RefreshCw size={14} className="animate-spin" /> Submitting…</>
                : <><Send size={14} /> Submit Ticket</>}
            </button>
          </form>
        </div>
      )}

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <div className="card p-10 text-center">
          <MessageSquare size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No tickets yet</p>
          <p className="text-slate-400 text-sm mt-1">Click "New Ticket" to contact support.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const sm  = STATUS_META[ticket.status]   || STATUS_META.open;
            const pm  = PRIORITY_META[ticket.priority] || PRIORITY_META.medium;
            const isOpen = expanded === ticket._id;
            const hasReply = !!ticket.adminReply;

            return (
              <div key={ticket._id}
                className="card border transition-all"
                style={{ borderColor: hasReply && ticket.status !== 'closed' ? '#bfdbfe' : undefined }}>

                {/* Ticket header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : ticket._id)}
                  className="w-full text-left px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Status dot */}
                        <span className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                          style={{ background: sm.dot }} />
                        <span className="text-sm font-bold text-slate-800 truncate">{ticket.subject}</span>
                        {hasReply && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                            Reply received
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(ticket.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    {isOpen
                      ? <ChevronUp size={16} className="text-slate-400 shrink-0 mt-1" />
                      : <ChevronDown size={16} className="text-slate-400 shrink-0 mt-1" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                    {/* User message */}
                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Your Message</div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {ticket.message}
                      </div>
                    </div>

                    {/* Admin reply */}
                    {hasReply ? (
                      <div>
                        <div className="text-xs font-semibold text-blue-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                          <CheckCircle2 size={12} />
                          Admin Reply
                          {ticket.repliedAt && (
                            <span className="text-slate-400 font-normal normal-case ml-1">
                              · {new Date(ticket.repliedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {ticket.adminReply}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <Clock size={13} className="text-amber-500 shrink-0" />
                        <span className="text-xs text-amber-700 font-medium">Awaiting admin reply — we typically respond within 24 hours.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
