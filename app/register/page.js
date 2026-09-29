'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle,
  CheckCircle, Hash, ShieldCheck, RefreshCw, Wand2, Check, X, Copy, Phone,
} from 'lucide-react';
import { PASSWORD_RULES, validatePassword, generatePassword } from '@/lib/passwordUtils';

function StrengthChecklist({ password }) {
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      {PASSWORD_RULES.map(rule => {
        const pass = rule.test(password);
        return (
          <div key={rule.id} className="flex items-center gap-1.5 text-xs">
            {pass
              ? <Check size={11} className="text-emerald-500 shrink-0" />
              : <X     size={11} className="text-red-400 shrink-0" />}
            <span className={pass ? 'text-emerald-600' : 'text-slate-400'}>{rule.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [step,       setStep]       = useState(1);
  const [form,       setForm]       = useState({ name: '', email: '', password: '', phone: '', countryCode: '+91', referralCode: '' });
  const [otp,        setOtp]        = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [countdown,  setCountdown]  = useState(0);
  const [copied,     setCopied]     = useState(false);
  const [refStatus,  setRefStatus]  = useState('idle'); // idle | checking | valid | invalid
  const [refLocked,  setRefLocked]  = useState(false);  // true when code came from ?ref= URL param

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setForm(f => ({ ...f, referralCode: ref }));
      setRefLocked(true);
      checkRef(ref);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!form.referralCode) { setRefStatus('idle'); return; }
    setRefStatus('checking');
    const t = setTimeout(() => checkRef(form.referralCode), 600);
    return () => clearTimeout(t);
  }, [form.referralCode]);

  async function checkRef(code) {
    if (!code) { setRefStatus('idle'); return; }
    setRefStatus('checking');
    try {
      const res = await fetch(`/api/auth/check-referral?code=${encodeURIComponent(code)}`);
      const { valid } = await res.json();
      setRefStatus(valid ? 'valid' : 'invalid');
    } catch { setRefStatus('idle'); }
  }

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleGenerate() {
    const pwd = generatePassword(14);
    setForm(f => ({ ...f, password: pwd }));
    setShowPass(true);
  }

  function handleCopy() {
    if (!form.password) return;
    navigator.clipboard.writeText(form.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function sendOtp(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.phone) return setError('Please fill all required fields including phone number');
    if (form.referralCode && refStatus === 'invalid') return setError('Invalid referral code — please check and try again');
    if (refLocked && refStatus !== 'valid') return setError('Referral code could not be verified');
    const { valid, failures } = validatePassword(form.password);
    if (!valid) return setError(`Password must include: ${failures.map(f => f.label).join(', ')}`);
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...form, phone: form.countryCode + form.phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    setSuccess(`Account created! Referral code: ${data.referralCode}`);
    setTimeout(() => router.push('/login'), 2500);
  }

  const { valid: pwdValid } = validatePassword(form.password);
  const strengthCount = PASSWORD_RULES.filter(r => r.test(form.password)).length;
  const strengthColor = strengthCount <= 2 ? '#ef4444' : strengthCount <= 3 ? '#f59e0b' : strengthCount === 4 ? '#3b82f6' : '#10b981';

  const leftPanel = (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-12">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-white">TrickyX.ai</span>
      </Link>
      <div>
        <h2 className="text-4xl font-extrabold text-white mb-4 leading-tight">
          Start earning<br />in minutes.
        </h2>
        <p className="text-blue-200 text-lg leading-relaxed">
          Create your free account and activate the AI trading bot.
          No KYC, no credit card required.
        </p>
      </div>
      <p className="text-blue-300 text-sm">&copy; 2026 TrickyX.ai</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {leftPanel}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">TrickyX<span className="text-blue-600">.ai</span></span>
          </div>

          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
              <p className="text-slate-500 mb-8">Start trading with AI in minutes</p>

              <div className="card p-8 glow-border">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-red-50 border border-red-200 text-red-600">
                    <AlertCircle size={15} /> {error}
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
                    <CheckCircle size={15} /> {success}
                  </div>
                )}

                <form onSubmit={sendOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input" style={{ paddingLeft: '2.5rem' }} type="text" placeholder="John Doe"
                        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input" style={{ paddingLeft: '2.5rem' }} type="email" placeholder="you@example.com"
                        value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={form.countryCode}
                        onChange={e => setForm({ ...form, countryCode: e.target.value })}
                        className="input px-2 text-sm sm:shrink-0 sm:w-36">
                        <optgroup label="Popular">
                          <option value="+91">🇮🇳 India +91</option>
                          <option value="+1">🇺🇸 USA / Canada +1</option>
                          <option value="+44">🇬🇧 UK +44</option>
                          <option value="+971">🇦🇪 UAE +971</option>
                          <option value="+92">🇵🇰 Pakistan +92</option>
                          <option value="+880">🇧🇩 Bangladesh +880</option>
                          <option value="+60">🇲🇾 Malaysia +60</option>
                          <option value="+65">🇸🇬 Singapore +65</option>
                          <option value="+27">🇿🇦 South Africa +27</option>
                          <option value="+234">🇳🇬 Nigeria +234</option>
                        </optgroup>
                        <optgroup label="Asia">
                          <option value="+62">🇮🇩 Indonesia +62</option>
                          <option value="+63">🇵🇭 Philippines +63</option>
                          <option value="+66">🇹🇭 Thailand +66</option>
                          <option value="+84">🇻🇳 Vietnam +84</option>
                          <option value="+82">🇰🇷 South Korea +82</option>
                          <option value="+81">🇯🇵 Japan +81</option>
                          <option value="+86">🇨🇳 China +86</option>
                          <option value="+886">🇹🇼 Taiwan +886</option>
                          <option value="+852">🇭🇰 Hong Kong +852</option>
                          <option value="+94">🇱🇰 Sri Lanka +94</option>
                          <option value="+977">🇳🇵 Nepal +977</option>
                          <option value="+95">🇲🇲 Myanmar +95</option>
                          <option value="+855">🇰🇭 Cambodia +855</option>
                          <option value="+972">🇮🇱 Israel +972</option>
                          <option value="+966">🇸🇦 Saudi Arabia +966</option>
                          <option value="+968">🇴🇲 Oman +968</option>
                          <option value="+974">🇶🇦 Qatar +974</option>
                          <option value="+965">🇰🇼 Kuwait +965</option>
                          <option value="+973">🇧🇭 Bahrain +973</option>
                          <option value="+90">🇹🇷 Turkey +90</option>
                        </optgroup>
                        <optgroup label="Africa">
                          <option value="+254">🇰🇪 Kenya +254</option>
                          <option value="+233">🇬🇭 Ghana +233</option>
                          <option value="+20">🇪🇬 Egypt +20</option>
                          <option value="+212">🇲🇦 Morocco +212</option>
                          <option value="+255">🇹🇿 Tanzania +255</option>
                          <option value="+256">🇺🇬 Uganda +256</option>
                          <option value="+251">🇪🇹 Ethiopia +251</option>
                        </optgroup>
                        <optgroup label="Europe">
                          <option value="+7">🇷🇺 Russia +7</option>
                          <option value="+49">🇩🇪 Germany +49</option>
                          <option value="+33">🇫🇷 France +33</option>
                          <option value="+39">🇮🇹 Italy +39</option>
                          <option value="+34">🇪🇸 Spain +34</option>
                          <option value="+31">🇳🇱 Netherlands +31</option>
                          <option value="+32">🇧🇪 Belgium +32</option>
                          <option value="+41">🇨🇭 Switzerland +41</option>
                          <option value="+43">🇦🇹 Austria +43</option>
                          <option value="+48">🇵🇱 Poland +48</option>
                          <option value="+380">🇺🇦 Ukraine +380</option>
                          <option value="+46">🇸🇪 Sweden +46</option>
                          <option value="+47">🇳🇴 Norway +47</option>
                          <option value="+45">🇩🇰 Denmark +45</option>
                          <option value="+358">🇫🇮 Finland +358</option>
                          <option value="+353">🇮🇪 Ireland +353</option>
                          <option value="+351">🇵🇹 Portugal +351</option>
                          <option value="+30">🇬🇷 Greece +30</option>
                          <option value="+40">🇷🇴 Romania +40</option>
                          <option value="+420">🇨🇿 Czech Rep +420</option>
                        </optgroup>
                        <optgroup label="Americas & Oceania">
                          <option value="+55">🇧🇷 Brazil +55</option>
                          <option value="+52">🇲🇽 Mexico +52</option>
                          <option value="+57">🇨🇴 Colombia +57</option>
                          <option value="+54">🇦🇷 Argentina +54</option>
                          <option value="+56">🇨🇱 Chile +56</option>
                          <option value="+51">🇵🇪 Peru +51</option>
                          <option value="+61">🇦🇺 Australia +61</option>
                          <option value="+64">🇳🇿 New Zealand +64</option>
                        </optgroup>
                      </select>
                      <div className="relative flex-1 min-w-0">
                        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input className="input w-full" style={{ paddingLeft: '2.5rem' }} type="tel"
                          placeholder="9876543210" required
                          value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
                      </div>
                    </div>
                  </div>

                  {/* Password with generate + copy */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-slate-700">Password</label>
                      <div className="flex gap-1.5">
                        {form.password && (
                          <button type="button" onClick={handleCopy}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded border border-slate-200 hover:border-slate-300 transition-all">
                            <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                        <button type="button" onClick={handleGenerate}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 transition-all font-medium">
                          <Wand2 size={11} /> Generate
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input font-mono" style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                        type={showPass ? 'text' : 'password'} placeholder="Min 8 chars, mixed case, number, symbol"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Strength bar */}
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-1 flex-1 rounded-full transition-all"
                              style={{ background: i <= strengthCount ? strengthColor : '#e2e8f0' }} />
                          ))}
                        </div>
                        <StrengthChecklist password={form.password} />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Referral Code
                      {refLocked
                        ? <span className="ml-2 text-xs font-normal text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Applied</span>
                        : <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
                      }
                    </label>
                    <div className="relative">
                      <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pr-9"
                        style={{
                          paddingLeft: '2.5rem',
                          borderColor: refStatus === 'valid' ? '#10b981' : refStatus === 'invalid' ? '#ef4444' : undefined,
                          background:  refLocked ? '#f0fdf4' : undefined,
                          cursor:      refLocked ? 'not-allowed' : undefined,
                        }}
                        type="text"
                        placeholder="ABCD1234"
                        value={form.referralCode}
                        readOnly={refLocked}
                        onChange={e => !refLocked && setForm({ ...form, referralCode: e.target.value.toUpperCase() })} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {refStatus === 'checking' && <RefreshCw size={14} className="animate-spin text-slate-400" />}
                        {refStatus === 'valid'    && <CheckCircle size={15} className="text-emerald-500" />}
                        {refStatus === 'invalid'  && <AlertCircle size={15} className="text-red-500" />}
                      </span>
                    </div>
                    {refStatus === 'invalid' && (
                      <p className="text-xs text-red-500 mt-1">This referral code doesn't exist.</p>
                    )}
                    {refStatus === 'valid' && (
                      <p className="text-xs text-emerald-600 mt-1">Referral code verified ✓</p>
                    )}
                    {refLocked && refStatus !== 'valid' && refStatus !== 'invalid' && (
                      <p className="text-xs text-slate-400 mt-1">Verifying referral code...</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading || !pwdValid || refStatus === 'invalid' || refStatus === 'checking' || (refLocked && refStatus !== 'valid')}
                    className="btn-primary w-full py-3 text-sm mt-1 disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading ? <><RefreshCw size={14} className="animate-spin" /> Creating account...</> : 'Create Account'}
                  </button>
                </form>

                <p className="text-center text-slate-500 text-sm mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</Link>
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
