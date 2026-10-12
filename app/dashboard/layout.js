export const dynamic = 'force-dynamic';
import { DesktopSidebar, MobileTopBar, MobileTabBar } from '@/components/Sidebar';
import SessionGuard from '@/components/SessionGuard';
import ChatBot from '@/components/ChatBot';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <SessionGuard />

      {/* Desktop: left sidebar */}
      <DesktopSidebar />

      {/* Mobile: top bar */}
      <MobileTopBar />

      {/* Main content.
          min-w-0 stops wide children (tables, charts) from blowing out the
          flex row; the bottom pad clears the tab bar plus the home-bar inset. */}
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto
        p-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]
        mt-14
        lg:mt-0 lg:p-8 lg:pb-8">
        {children}
      </main>

      {/* Mobile: bottom tab bar */}
      <MobileTabBar />

      {/* Floating support chatbot */}
      <ChatBot />
    </div>
  );
}
