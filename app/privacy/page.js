export const metadata = {
  title: 'Privacy Policy — TrickyX.ai',
  description: 'Privacy Policy for TrickyX.ai — AI-powered crypto trading bot.',
};

const LAST_UPDATED = 'September 3, 2026';
const CONTACT_EMAIL = 'support@trickyx.ai';
const APP_NAME = 'TrickyX.ai';
const WEBSITE = 'https://trickyx.ai';

export default function PrivacyPage() {
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

      {/* Content */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Title */}
        <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-1)', letterSpacing: -0.5 }}>
            Privacy Policy
          </h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15 }}>
            Last updated: <strong>{LAST_UPDATED}</strong> · Effective immediately
          </p>
          <p style={{ marginTop: 16, color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7 }}>
            This Privacy Policy describes how <strong>{APP_NAME}</strong> ("{APP_NAME}", "we", "us", or "our") collects, uses, and shares information about you when you use our website ({WEBSITE}), mobile application, and trading bot services (collectively, the "Service").
          </p>
        </div>

        <Section title="1. Information We Collect">
          <Sub title="a. Account Information">
            When you register, we collect your <strong>name</strong>, <strong>email address</strong>, and <strong>password</strong> (stored as a bcrypt hash — we never store plain-text passwords). You may optionally provide a phone number.
          </Sub>
          <Sub title="b. Binance / BingX API Keys">
            To enable automated trading, you provide your exchange API key and secret. These are <strong>encrypted at rest</strong> using AES-256 encryption before storage. We never use your API keys for anything other than executing trades on your behalf.
          </Sub>
          <Sub title="c. Trading &amp; Financial Data">
            We store records of trades executed by the bot, including symbol, price, quantity, profit/loss, and timestamps. This data is used to display your trade history and calculate statistics.
          </Sub>
          <Sub title="d. Payment Information">
            We process crypto payments via <strong>NOWPayments</strong>. We do not collect or store credit/debit card numbers. We store payment status, amounts, and wallet addresses for reconciliation purposes.
          </Sub>
          <Sub title="e. Device &amp; Push Notification Tokens">
            If you enable push notifications, we store your device push token (FCM token) to send trade alerts and bot status updates. These tokens are associated with your account and deleted when you disable notifications or delete your account.
          </Sub>
          <Sub title="f. Usage Data">
            We collect log data including IP addresses, browser/app type, pages visited, and timestamps when you interact with the Service. This data is used for security monitoring and debugging.
          </Sub>
          <Sub title="g. Referral Data">
            We track referral relationships (which user referred whom) to calculate multi-level commissions. We store referral codes and the users who used them.
          </Sub>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Create and manage your account</li>
            <li>Execute automated cryptocurrency trades on your behalf via your connected exchange</li>
            <li>Send OTP verification codes and password reset emails</li>
            <li>Send push notifications for trade opens, closes, bot status changes, and platform announcements (only if you opt in)</li>
            <li>Calculate and credit referral commissions</li>
            <li>Process deposit and withdrawal requests</li>
            <li>Provide customer support</li>
            <li>Detect, prevent, and investigate fraud or unauthorized activity</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal data to third parties. We do not use your data for advertising.</p>
        </Section>

        <Section title="3. Third-Party Services">
          <p>We share limited data with these third-party providers to operate the Service:</p>
          <table>
            <thead>
              <tr><th>Provider</th><th>Purpose</th><th>Data Shared</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>MongoDB Atlas</strong></td><td>Database hosting</td><td>All user and trade data (encrypted at rest)</td></tr>
              <tr><td><strong>Binance / BingX</strong></td><td>Trade execution</td><td>Your API key &amp; secret (encrypted), order parameters</td></tr>
              <tr><td><strong>NOWPayments</strong></td><td>Crypto payment processing</td><td>Payment amount, currency, wallet address</td></tr>
              <tr><td><strong>Firebase (Google)</strong></td><td>Push notifications</td><td>Device FCM push token</td></tr>
              <tr><td><strong>Hostinger SMTP</strong></td><td>Transactional email</td><td>Your email address, OTP codes</td></tr>
              <tr><td><strong>Groq AI</strong></td><td>Trade sentiment analysis</td><td>Market symbol name only — no personal data</td></tr>
            </tbody>
          </table>
          <p>Each provider has their own privacy policy. We are not responsible for their data practices.</p>
        </Section>

        <Section title="4. Data Security">
          <ul>
            <li>Passwords are hashed with <strong>bcrypt</strong> and never stored in plain text</li>
            <li>API keys are encrypted with <strong>AES-256</strong> before storage</li>
            <li>All data in transit is protected by <strong>TLS/HTTPS</strong></li>
            <li>Session tokens are stored as <strong>httpOnly cookies</strong> to prevent XSS access</li>
            <li>On mobile, sensitive tokens are stored in <strong>Expo SecureStore</strong> (iOS Keychain / Android Keystore)</li>
            <li>We conduct regular security reviews of our codebase and infrastructure</li>
          </ul>
          <p>While we take reasonable precautions, no method of transmission over the internet is 100% secure. Use the Service at your own risk.</p>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain your data for as long as your account is active. If you delete your account:</p>
          <ul>
            <li>Personal information (name, email, API keys) is deleted within <strong>30 days</strong></li>
            <li>Anonymised trade records may be retained for analytics purposes</li>
            <li>Payment records may be retained for up to <strong>7 years</strong> for tax and legal compliance</li>
          </ul>
        </Section>

        <Section title="6. Cookies">
          <p>We use session cookies for authentication only. We do not use tracking, advertising, or analytics cookies. You can disable cookies in your browser, but this will prevent you from logging in to the Service.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Correction</strong> — update or correct inaccurate personal data via your Profile settings</li>
            <li><strong>Deletion</strong> — request deletion of your account and associated personal data</li>
            <li><strong>Portability</strong> — request your trade history and account data in a machine-readable format</li>
            <li><strong>Objection</strong> — opt out of push notifications at any time in Notification Settings</li>
          </ul>
          <p>To exercise these rights, email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within 30 days.</p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>The Service is not directed to individuals under the age of <strong>18</strong>. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected data from a minor, contact us immediately and we will delete it.</p>
        </Section>

        <Section title="9. International Data Transfers">
          <p>Your data may be processed in countries other than your own (including India, the United States, and Singapore, where our service providers are located). By using the Service, you consent to this transfer. We ensure appropriate safeguards are in place when transferring data internationally.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by email or via an in-app notification. Continued use of the Service after changes constitutes acceptance of the updated policy. The "Last updated" date at the top of this page will always reflect the most recent revision.</p>
        </Section>

        <Section title="11. Contact Us">
          <p>If you have questions, concerns, or requests regarding this Privacy Policy, please contact us:</p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginTop: 16 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15 }}>TrickyX.ai — Support</p>
            <p style={{ margin: '0 0 4px', color: 'var(--text-2)', fontSize: 14 }}>Email: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)' }}>{CONTACT_EMAIL}</a></p>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 14 }}>Website: <a href={WEBSITE} style={{ color: 'var(--accent)' }}>{WEBSITE}</a></p>
          </div>
        </Section>

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', padding: '24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          © {new Date().getFullYear()} TrickyX.ai · <a href="/privacy" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Privacy Policy</a> · <a href="/terms" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Terms of Service</a>
        </p>
      </footer>

      <style>{`
        h2 { font-size: 20px; font-weight: 700; margin: 0 0 16px; color: var(--text-1); }
        h3 { font-size: 15px; font-weight: 700; margin: 20px 0 8px; color: var(--text-1); }
        p  { font-size: 15px; line-height: 1.75; color: var(--text-2); margin: 0 0 14px; }
        ul { padding-left: 22px; margin: 0 0 14px; }
        li { font-size: 15px; line-height: 1.75; color: var(--text-2); margin-bottom: 6px; }
        a  { color: var(--accent); }
        strong { color: var(--text-1); }
        table { width: 100%; border-collapse: collapse; margin: 16px 0 20px; font-size: 14px; }
        th { text-align: left; padding: 10px 14px; background: var(--surface-2); color: var(--text-1); font-weight: 700; border: 1px solid var(--border); }
        td { padding: 10px 14px; color: var(--text-2); border: 1px solid var(--border); vertical-align: top; }
        tr:hover td { background: var(--surface-2); }
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

function Sub({ title, children }) {
  return (
    <>
      <h3>{title}</h3>
      <p>{children}</p>
    </>
  );
}
