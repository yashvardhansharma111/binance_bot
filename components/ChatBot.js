'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, RefreshCw, Ticket,
  ChevronLeft, AlertCircle, CheckCircle2,
} from 'lucide-react';

const WELCOME = "Hi! I'm TrickyX support. Ask me anything about the platform, or raise a support ticket if you need help from our team.";

export default function ChatBot() {
  const [open,    setOpen]    = useState(false);
  const [view,    setView]    = useState('chat'); // 'chat' | 'ticket'
  const [msgs,    setMsgs]    = useState([{ role: 'assistant', content: WELCOME }]);
  const [input,   setInput]   = useState('');
  const [sending, setSending] = useState(false);

  const [subject,  setSubject]  = useState('');
  const [tMsg,     setTMsg]     = useState('');
  const [priority, setPriority] = useState('medium');
  const [tLoading, setTLoading] = useState(false);
  const [tSuccess, setTSuccess] = useState('');
  const [tError,   setTError]   = useState('');

  // Drag state for the floating button
  const [pos,      setPos]      = useState({ x: null, y: null }); // null = default bottom-right
  const dragRef    = useRef(null);
  const dragging   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  const onPointerDown = useCallback((e) => {
    // Only drag on the button itself, not child elements that handle clicks
    dragging.current = true;
    const rect = dragRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    dragRef.current.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    const maxX = window.innerWidth  - 56;
    const maxY = window.innerHeight - 56;
    setPos({ x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  async function send() {
    if (!input.trim() || sending) return;
    const userMsg = { role: 'user', content: input.trim() };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput('');
    setSending(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
    }).catch(() => null);

    const data = res ? await res.json().catch(() => ({})) : {};
    setMsgs(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, something went wrong. Please try again.' }]);
    setSending(false);
  }

  async function submitTicket(e) {
    e.preventDefault();
    setTError(''); setTSuccess('');
    setTLoading(true);
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message: tMsg, priority }),
    });
    const data = await res.json();
    setTLoading(false);
    if (!res.ok) { setTError(data.error || 'Failed to submit'); return; }
    setTSuccess('Ticket submitted! Our team will reply within 24 hours.');
    setSubject(''); setTMsg(''); setPriority('medium');
  }

  return (
    <>
      {/* Floating button — draggable */}
      <button
        ref={dragRef}
        onClick={() => { if (!dragging.current) setOpen(o => !o); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center select-none touch-none"
        style={{
          background: 'var(--accent)',
          color: '#fff',
          ...(pos.x !== null
            ? { left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
            : { bottom: 24, right: 24 }),
          cursor: dragging.current ? 'grabbing' : 'grab',
        }}
        aria-label="Open support chat">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat window — anchors above the button */}
      {open && (() => {
        const winStyle = pos.x !== null
          ? {
              left: Math.min(pos.x, window.innerWidth - 368),
              top:  Math.max(8, pos.y - 528),
              bottom: 'auto', right: 'auto',
            }
          : { bottom: 96, right: 24 };
        return (
        <div
          className="fixed z-50 w-[360px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 520, ...winStyle }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <div className="flex items-center gap-2">
              {view === 'ticket' && (
                <button onClick={() => { setView('chat'); setTSuccess(''); setTError(''); }}
                  className="hover:opacity-80 mr-1">
                  <ChevronLeft size={18} />
                </button>
              )}
              <MessageCircle size={16} />
              <span className="font-bold text-sm">
                {view === 'ticket' ? 'Raise a Ticket' : 'TrickyX Support'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {view === 'chat' && (
                <button onClick={() => setView('ticket')}
                  title="Raise a ticket"
                  className="hover:opacity-80 flex items-center gap-1 text-xs border border-white/40 rounded-full px-2.5 py-1">
                  <Ticket size={12} /> Ticket
                </button>
              )}
              <button onClick={() => setOpen(false)} className="hover:opacity-80">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Chat view */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed"
                      style={{
                        background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                        color:      m.role === 'user' ? '#fff'         : 'var(--text-1)',
                        borderBottomRightRadius: m.role === 'user' ? 4 : undefined,
                        borderBottomLeftRadius:  m.role !== 'user' ? 4 : undefined,
                      }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-3.5 py-2.5 flex items-center gap-1.5"
                      style={{ background: 'var(--surface-2)', borderBottomLeftRadius: 4 }}>
                      <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--text-3)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex gap-2 items-end">
                  <textarea
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ask about TrickyX.ai…"
                    className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-1)',
                      maxHeight: 80,
                    }}
                  />
                  <button onClick={send} disabled={!input.trim() || sending}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shrink-0"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    <Send size={15} />
                  </button>
                </div>
                <p className="text-center text-[10px] mt-1.5" style={{ color: 'var(--text-3)' }}>
                  Only answers TrickyX.ai questions
                </p>
              </div>
            </>
          )}

          {/* Ticket view */}
          {view === 'ticket' && (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {tSuccess ? (
                <div className="flex flex-col items-center text-center py-10 gap-3">
                  <CheckCircle2 size={40} style={{ color: '#16a34a' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{tSuccess}</p>
                  <button onClick={() => { setTSuccess(''); setView('chat'); }}
                    className="btn-outline text-xs px-4 py-2 mt-2">Back to Chat</button>
                </div>
              ) : (
                <form onSubmit={submitTicket} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Subject</label>
                    <input
                      value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="Brief description of your issue"
                      className="input text-sm" required maxLength={200} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Priority</label>
                    <div className="flex gap-2">
                      {['low', 'medium', 'high'].map(p => (
                        <button key={p} type="button" onClick={() => setPriority(p)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                          style={{
                            background:  priority === p ? 'var(--accent-dim)' : 'var(--surface-2)',
                            border:      `1px solid ${priority === p ? 'var(--accent)' : 'var(--border)'}`,
                            color:       priority === p ? 'var(--accent)' : 'var(--text-2)',
                          }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Message</label>
                    <textarea
                      rows={5}
                      value={tMsg} onChange={e => setTMsg(e.target.value)}
                      placeholder="Describe your issue in detail…"
                      className="input text-sm resize-none w-full"
                      required maxLength={5000} />
                  </div>

                  {tError && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      <AlertCircle size={13} /> {tError}
                    </div>
                  )}

                  <button type="submit" disabled={tLoading || !subject.trim() || !tMsg.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                    {tLoading ? <RefreshCw size={14} className="animate-spin" /> : <Ticket size={14} />}
                    {tLoading ? 'Submitting…' : 'Submit Ticket'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
        );
      })()}
    </>
  );
}
