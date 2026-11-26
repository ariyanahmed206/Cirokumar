import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { NavigationBar } from './components/NavigationBar';
import { api } from './lib/api';
import { Link, RouterProvider, useRouter } from './lib/router';
import { ToastProvider } from './lib/toast';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminLogin } from './pages/AdminLogin';
import { Biodata } from './pages/Biodata';
import { CommitteeDetail } from './pages/CommitteeDetail';
import { Committees } from './pages/Committees';
import { Contact } from './pages/Contact';
import { Donate } from './pages/Donate';
import { Events } from './pages/Events';
import { Home } from './pages/Home';
import { MemberDetail } from './pages/MemberDetail';
import { Members } from './pages/Members';
import { Notices } from './pages/Notices';
import { Notifications } from './pages/Notifications';

function NotFoundPage() {
  return (
    <div className="min-h-[60vh] bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-xs">
        <h1 className="text-4xl font-bold text-slate-900 mb-2 tabular-nums">৪০৪</h1>
        <p className="text-slate-600 mb-6">দুঃখিত, আপনি যে পাতাটি খুঁজছেন তা পাওয়া যায়নি।</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          হোম পাতায় ফিরুন
        </Link>
      </div>
    </div>
  );
}

function AppShell() {
  const { path } = useRouter();
  const [settingsRefresh, setSettingsRefresh] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(() => {
    api
      .getNotifications()
      .then((list) => setUnreadCount(list.filter((n) => !n.isRead).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const renderPage = () => {
    if (path === '/') return <Home />;
    if (path === '/members') return <Members />;
    if (path.startsWith('/member/')) {
      const id = Number(path.split('/')[2]);
      return Number.isInteger(id) && id > 0 ? <MemberDetail id={id} /> : <NotFoundPage />;
    }
    if (path === '/biodata') return <Biodata />;
    if (path === '/committees') return <Committees />;
    if (path.startsWith('/committee/')) {
      const id = Number(path.split('/')[2]);
      return Number.isInteger(id) && id > 0 ? <CommitteeDetail id={id} /> : <NotFoundPage />;
    }
    if (path === '/events') return <Events />;
    if (path === '/notices') return <Notices />;
    if (path === '/notifications') {
      return <Notifications onUnreadChange={setUnreadCount} />;
    }
    if (path === '/contact') return <Contact />;
    if (path === '/donate') return <Donate />;
    if (path === '/admin/login') return <AdminLogin />;
    if (path === '/admin') {
      return (
        <AdminDashboard
          onSettingsUpdated={() => setSettingsRefresh((n) => n + 1)}
          onNotificationsUpdated={refreshNotifications}
        />
      );
    }
    return <NotFoundPage />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header refreshKey={settingsRefresh} />
      <NavigationBar unreadCount={unreadCount} />
      <main className="flex-1">{renderPage()}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider>
          <AppShell />
        </RouterProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
