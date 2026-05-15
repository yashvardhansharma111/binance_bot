export const dynamic = 'force-dynamic';
import Sidebar from '@/components/Sidebar';

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
