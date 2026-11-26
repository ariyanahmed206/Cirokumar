import { getAdminToken } from '../lib/api';
import { Link, useRouter } from '../lib/router';

export function NavigationBar({ unreadCount = 0 }: { unreadCount?: number }) {
  const { path } = useRouter();
  const hasAdmin = Boolean(getAdminToken());

  const navItems = [
    { href: '/', label: 'হোম' },
    { href: '/members', label: 'সদস্য' },
    { href: '/committees', label: 'কমিটি' },
    { href: '/events', label: 'ইভেন্ট' },
    { href: '/notices', label: 'নোটিস বোর্ড' },
    { href: '/notifications', label: unreadCount > 0 ? `বিজ্ঞপ্তি (${unreadCount})` : 'বিজ্ঞপ্তি' },
    { href: '/contact', label: 'যোগাযোগ' },
    { href: '/donate', label: 'ডোনেট' },
    { href: hasAdmin ? '/admin' : '/admin/login', label: 'এডমিন প্যানেল' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return path === '/';
    if (href === '/members' && path.startsWith('/member/')) return true;
    if (href === '/committees' && path.startsWith('/committee/')) return true;
    if (href.startsWith('/admin') && path.startsWith('/admin')) return true;
    return path === href;
  };

  return (
    <nav
      aria-label="প্রধান নেভিগেশন"
      className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40 shadow-xs"
    >
      <div className="max-w-6xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 py-3 px-3 border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
