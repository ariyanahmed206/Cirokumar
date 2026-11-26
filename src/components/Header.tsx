import { useEffect, useState } from 'react';
import { Download, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { SiteSettings } from '../types';

export function Header({ refreshKey = 0 }: { refreshKey?: number }) {
  const [settings, setSettings] = useState<SiteSettings>({
    logoUrl: '/src/assets/images/chirakumar_emblem_1795673549264.jpg',
    appDownloadLink: null,
  });
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((data) => {
        setSettings(data);
        setImgFailed(false);
      })
      .catch(() => {});
  }, [refreshKey]);

  const logoSrc = settings.logoUrl || '/src/assets/images/chirakumar_emblem_1795673549264.jpg';
  const safeAppDownloadLink = (() => {
    if (!settings.appDownloadLink) return null;
    try {
      const parsed = new URL(settings.appDownloadLink);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  })();

  return (
    <header className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-600 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded-lg"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-white/30">
              {!imgFailed ? (
                <img
                  src={logoSrc}
                  alt="চিরকুমার সংঘ বাংলাদেশ লোগো"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="w-6 h-6 text-indigo-700" />
              )}
            </div>
            <span className="text-white font-bold text-lg sm:text-xl tracking-tight whitespace-nowrap shrink-0">
              চিরকুমার সংঘ বাংলাদেশ
            </span>
          </Link>

          <div className="flex items-center gap-3 shrink-0">
            {safeAppDownloadLink ? (
              <a
                href={safeAppDownloadLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">ডাউনলোড অ্যাপ</span>
                <span className="sm:hidden">অ্যাপ</span>
              </a>
            ) : (
              <Link
                href="/biodata"
                className="inline-flex items-center bg-white text-indigo-700 hover:bg-indigo-50 font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                সদস্য নিবন্ধন
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
