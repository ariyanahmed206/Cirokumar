import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Notice } from '../types';

export function Notices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getNotices()
      .then(setNotices)
      .catch(() => setNotices([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8 text-center">
          নোটিশ বোর্ড
        </h1>

        {notices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-600 text-base sm:text-lg">
            কোনো নোটিশ পাওয়া যায়নি
          </div>
        ) : (
          <div className="space-y-6">
            {notices.map((notice) => (
              <article
                key={notice.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{notice.title}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-200 text-sm sm:text-base text-slate-700">
                  {notice.date && (
                    <p>
                      <span className="font-semibold">তারিখ:</span>{' '}
                      <span className="tabular-nums">{notice.date}</span>
                    </p>
                  )}
                  {notice.time && (
                    <p>
                      <span className="font-semibold">সময়:</span> {notice.time}
                    </p>
                  )}
                  {notice.location && (
                    <p className="sm:col-span-2">
                      <span className="font-semibold">স্থান:</span> {notice.location}
                    </p>
                  )}
                </div>
                {notice.description && (
                  <p className="text-slate-700 leading-relaxed text-sm sm:text-base">
                    {notice.description}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
