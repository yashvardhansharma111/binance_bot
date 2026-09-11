'use client';
import { useState } from 'react';

const CONTACT_EMAIL = 'support@trickyx.ai';

export default function DeleteAccountPage() {
  const [step,    setStep]    = useState('email');   // 'email' | 'otp' | 'done'
  const [email,   setEmail]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function sendOtp(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'delete' }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to send code.'); return; }
      setStep('otp');
    } catch { setError('Network error. Try again.'); }
    finally   { setLoading(false); }
  }

  async function confirmDelete(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/delete-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Deletion failed.'); return; }
      setStep('done');
    } catch { setError('Network error. Try again.'); }
    finally   { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'var(--font-open-sans, sans-serif)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>T</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-1)' }}>TrickyX.ai</span>
          </a>
          <a href="/" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>← Back</a>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <span style={{ fontSize: 28 }}>✓</span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-1)' }}>Account Deleted</h1>
              <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, margin: '0 0 8px' }}>
                Your TrickyX.ai account and all personal data have been permanently deleted.
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '0 0 32px' }}>
                A confirmation email has been sent to <strong style={{ color: 'var(--text-2)' }}>{email}</strong>.
              </p>
              <a href="/" style={{ display: 'inline-block', padding: '12px 28px', background: 'var(--accent)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                Go to Homepage
              </a>
            </div>
          )}

          {/* ── STEP: EMAIL or OTP ── */}
          {step !== 'done' && (<>
            {/* Warning banner */}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px', marginBottom: 28, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>⚠️</span>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#991b1b' }}>This action is permanent and cannot be undone.</p>
                <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', lineHeight: 1.6 }}>
                  Deleting your account will permanently remove your profile, API keys, trade history, and all associated data. Your asset balance will be forfeited if not withdrawn first.
                </p>
              </div>
            </div>

            {/* Card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px' }}>

              {step === 'email' && (<>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--text-1)' }}>Delete Account</h1>
                <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 28px', lineHeight: 1.6 }}>
                  Enter your registered email address. We'll send a 6-digit verification code to confirm it's you.
                </p>

                <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Email Address
                    </label>
                    <input
                      type="email" required autoFocus
                      placeholder="you@email.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <button
                    type="submit" disabled={loading || !email}
                    style={{ padding: '13px', borderRadius: 10, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Sending code…' : 'Send Verification Code'}
                  </button>
                </form>
              </>)}

              {step === 'otp' && (<>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--text-1)' }}>Enter Verification Code</h1>
                <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 6px', lineHeight: 1.6 }}>
                  A 6-digit code was sent to <strong style={{ color: 'var(--text-1)' }}>{email}</strong>.
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 28px' }}>
                  Code expires in 10 minutes.{' '}
                  <button onClick={() => { setStep('email'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 600 }}>
                    Wrong email?
                  </button>
                </p>

                <form onSubmit={confirmDelete} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      6-Digit Code
                    </label>
                    <input
                      type="text" required autoFocus inputMode="numeric"
                      maxLength={6} placeholder="000000"
                      value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 22, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  {/* What gets deleted */}
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Will be permanently deleted:</p>
                    {['Profile, name, email, password','Binance / BingX API keys','Trade history and bot logs','Bot settings and symbol configs','Push notification tokens','Referral commission history'].map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 700 }}>✕</span>
                        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{item}</span>
                      </div>
                    ))}
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                      ℹ️ Payment &amp; withdrawal records are anonymised and retained for 7 years (legal requirement).
                    </p>
                  </div>

                  <button
                    type="submit" disabled={loading || otp.length !== 6}
                    style={{ padding: '13px', borderRadius: 10, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer', opacity: (loading || otp.length !== 6) ? 0.6 : 1 }}>
                    {loading ? 'Deleting account…' : 'Permanently Delete My Account'}
                  </button>

                  <button
                    type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                    style={{ padding: '12px', borderRadius: 10, background: 'transparent', color: 'var(--text-2)', fontWeight: 600, fontSize: 14, border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </form>
              </>)}
            </div>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)' }}>
              Changed your mind?{' '}
              <a href="/dashboard" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Go to dashboard</a>
              {' '}or contact{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
            </p>
          </>)}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', padding: '20px 24px', textAlign: 'center', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          © {new Date().getFullYear()} TrickyX.ai ·{' '}
          <a href="/privacy" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Privacy Policy</a> ·{' '}
          <a href="/terms" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Terms of Service</a>
        </p>
      </footer>
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
      <span style={{ fontSize: 14, color: '#dc2626' }}>{children}</span>
    </div>
  );
}
