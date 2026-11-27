import './globals.css';
import { Providers } from './providers';
import localFont from 'next/font/local';

// Self-hosted (latin, variable) so `next build` never needs to reach Google Fonts —
// the production server failed builds when that download was unreachable.
// Both fonts are SIL Open Font License.
const inter = localFont({
  src: './fonts/inter-latin-var.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
});

const mono = localFont({
  src: './fonts/jetbrains-mono-latin-var.woff2',
  variable: '--font-mono',
  weight: '400 700',
  display: 'swap',
});

export const metadata = {
  title: 'TrickyX.ai — AI-Powered Crypto Trading',
  description: 'Automated crypto trading bot with referral rewards. Connect your Binance account and let AI trade for you.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${mono.variable}`}>
      <head>
        {/* Apply the stored theme before paint so there is no light flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}` }} />
      </head>
      <body suppressHydrationWarning className={`bg-slate-50 text-slate-900 antialiased ${inter.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
