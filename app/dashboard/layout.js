export const dynamic = 'force-dynamic';
import { DesktopSidebar, MobileTopBar, MobileTabBar } from '@/components/Sidebar';
import SessionGuard from '@/components/SessionGuard';
import ChatBot from '@/components/ChatBot';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <SessionGuard />

      {/* Desktop: left sidebar */}
      <DesktopSidebar />

      {/* Mobile: top bar */}
      <MobileTopBar />

      {/* Main content */}
      <main className="flex-1 overflow-auto
        p-4 pt-4
        lg:p-8
        mt-14 lg:mt-0
        mb-16 lg:mb-0">
        {children}
      </main>

      {/* Mobile: bottom tab bar */}
      <MobileTabBar />

      {/* Floating support chatbot */}
      <ChatBot />
    </div>
  );
}
