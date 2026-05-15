import './globals.css';
import { Providers } from './providers';
import { Open_Sans } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata = {
  title: 'TrickyX.ai — AI-Powered Crypto Trading',
  description: 'Automated crypto trading bot with referral rewards. Connect your Binance account and let AI trade for you.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={openSans.variable}>
      <body suppressHydrationWarning className={`bg-slate-50 text-slate-900 antialiased ${openSans.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
