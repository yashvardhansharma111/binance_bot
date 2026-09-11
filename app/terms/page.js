export const metadata = {
  title: 'Terms of Service — TrickyX.ai',
  description: 'Terms of Service for TrickyX.ai — AI-powered crypto trading bot.',
};

const LAST_UPDATED = 'September 3, 2026';
const CONTACT_EMAIL = 'support@trickyx.ai';
const APP_NAME = 'TrickyX.ai';
const WEBSITE = 'https://trickyx.ai';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'var(--font-open-sans, sans-serif)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)', padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>T</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-1)' }}>{APP_NAME}</span>
          </a>
          <a href="/" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>← Back to App</a>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-1)', letterSpacing: -0.5 }}>
            Terms of Service
          </h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15 }}>
            Last updated: <strong>{LAST_UPDATED}</strong> · Effective immediately
          </p>
          <p style={{ marginTop: 16, color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7 }}>
            Please read these Terms of Service carefully before using <strong>{APP_NAME}</strong>. By accessing or using the Service, you agree to be bound by these terms.
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>By creating an account or using any part of the {APP_NAME} Service, you confirm that you are at least 18 years old, have the legal capacity to enter into this agreement, and agree to these Terms. If you do not agree, do not use the Service.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>{APP_NAME} provides an automated cryptocurrency trading bot that connects to your exchange account (Binance or BingX) via API keys and executes trades based on AI-driven signals. The Service also includes a referral commission system, deposit/withdrawal management, push notifications, and a web and mobile dashboard.</p>
          <p><strong>Cryptocurrency trading involves substantial risk of loss.</strong> The bot's trading decisions are not financial advice. Past performance does not guarantee future results.</p>
        </Section>

        <Section title="3. Account Registration">
          <ul>
            <li>You must provide accurate, complete, and current registration information</li>
            <li>You are responsible for maintaining the confidentiality of your password</li>
            <li>You are responsible for all activity that occurs under your account</li>
            <li>You must notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> of any unauthorised use of your account</li>
            <li>One person may only register one account. Duplicate accounts may be suspended</li>
          </ul>
        </Section>

        <Section title="4. Subscription &amp; Payments">
          <ul>
            <li>Access to the trading bot requires an active subscription (currently $49 for 6 months)</li>
            <li>Payments are processed in cryptocurrency via NOWPayments. We do not accept refunds for subscription fees once a subscription has been activated</li>
            <li>Asset balance deposits (for trading capital) are credited to your account after blockchain confirmation. Minimum deposit is $10 USDT</li>
            <li>We deduct a platform commission (up to 15%) from profitable trades. The exact rate is shown in your dashboard</li>
            <li>Prices and fees may change at any time with reasonable notice</li>
          </ul>
        </Section>

        <Section title="5. API Keys &amp; Trading">
          <ul>
            <li>You grant {APP_NAME} permission to execute trades using your provided API keys for the duration your bot is active</li>
            <li>We recommend providing <strong>trade-only API keys</strong> (no withdrawal permissions) as a security best practice</li>
            <li>We are not liable for losses arising from trades executed by the bot, including losses due to market volatility, exchange downtime, or slippage</li>
            <li>You may stop the bot at any time from your dashboard. Any open positions at the time of stopping will remain open on your exchange until manually closed</li>
            <li>We reserve the right to pause or stop the bot if we detect API key issues, insufficient balance, or suspicious activity</li>
          </ul>
        </Section>

        <Section title="6. Referral Program">
          <ul>
            <li>You earn commissions when users you refer make trades or purchase subscriptions</li>
            <li>Commission rates: L1 direct referral — 6% of trade commissions + 12% of subscription; L2 — 3% + 5%; L3 — 1% + 3%</li>
            <li>Commissions are credited to your asset balance and can be withdrawn subject to the minimum withdrawal threshold</li>
            <li>Self-referrals (referring yourself via alternate accounts) are prohibited and will result in account termination</li>
            <li>We reserve the right to modify or discontinue the referral program at any time</li>
          </ul>
        </Section>

        <Section title="7. Withdrawals">
          <ul>
            <li>Minimum withdrawal amount is <strong>$5 USDT</strong></li>
            <li>Withdrawals are processed manually by admins within 24 hours on business days</li>
            <li>We reserve the right to delay or refuse a withdrawal if fraud or a violation of these Terms is suspected</li>
            <li>You are responsible for providing a correct wallet address. We are not liable for funds sent to an incorrect address</li>
          </ul>
        </Section>

        <Section title="8. Prohibited Activities">
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations</li>
            <li>Attempt to reverse-engineer, decompile, or hack any part of the Service</li>
            <li>Use the Service to manipulate markets or engage in wash trading</li>
            <li>Create multiple accounts to abuse the referral system</li>
            <li>Share your account credentials with others</li>
            <li>Use automated scripts to scrape or overload our API</li>
            <li>Impersonate {APP_NAME} staff or other users</li>
          </ul>
        </Section>

        <Section title="9. Disclaimers &amp; Risk Warning">
          <p style={{ fontWeight: 700, color: 'var(--text-1)' }}>⚠️ IMPORTANT RISK WARNING</p>
          <p>Cryptocurrency trading is highly speculative and volatile. You may lose some or all of your trading capital. The {APP_NAME} bot does not guarantee profits. By using the Service, you acknowledge and accept all trading risks.</p>
          <p>The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied. We do not warrant that:</p>
          <ul>
            <li>The Service will be uninterrupted or error-free</li>
            <li>The bot's trading strategy will be profitable</li>
            <li>The Service will be compatible with all devices or exchanges</li>
          </ul>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>To the maximum extent permitted by law, {APP_NAME} and its operators shall not be liable for:</p>
          <ul>
            <li>Any trading losses incurred through use of the bot</li>
            <li>Loss of profits, data, or business opportunities</li>
            <li>Indirect, incidental, or consequential damages</li>
            <li>Losses arising from exchange downtime, API errors, or network issues</li>
          </ul>
          <p>Our total liability to you for any claim arising from the Service shall not exceed the subscription fees you paid in the 6 months prior to the claim.</p>
        </Section>

        <Section title="11. Termination">
          <p>We may suspend or terminate your account at any time, with or without notice, for violations of these Terms. Upon termination, any unused subscription period is non-refundable. You may delete your account at any time by contacting us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </Section>

        <Section title="12. Governing Law">
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Maharashtra, India.</p>
        </Section>

        <Section title="13. Changes to Terms">
          <p>We may modify these Terms at any time. We will notify you of material changes via email or in-app notification. Continued use of the Service after changes become effective constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section title="14. Contact">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginTop: 16 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15 }}>TrickyX.ai — Support</p>
            <p style={{ margin: '0 0 4px', color: 'var(--text-2)', fontSize: 14 }}>Email: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)' }}>{CONTACT_EMAIL}</a></p>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 14 }}>Website: <a href={WEBSITE} style={{ color: 'var(--accent)' }}>{WEBSITE}</a></p>
          </div>
        </Section>

      </main>

      <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', padding: '24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          © {new Date().getFullYear()} TrickyX.ai · <a href="/privacy" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Privacy Policy</a> · <a href="/terms" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Terms of Service</a>
        </p>
      </footer>

      <style>{`
        h2 { font-size: 20px; font-weight: 700; margin: 0 0 16px; color: var(--text-1); }
        p  { font-size: 15px; line-height: 1.75; color: var(--text-2); margin: 0 0 14px; }
        ul { padding-left: 22px; margin: 0 0 14px; }
        li { font-size: 15px; line-height: 1.75; color: var(--text-2); margin-bottom: 6px; }
        a  { color: var(--accent); }
        strong { color: var(--text-1); }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid var(--border)' }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
