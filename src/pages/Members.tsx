import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, Briefcase, Loader2, MapPin, Search } from 'lucide-react';
import { MemberAvatar } from '../components/MemberAvatar';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { Member } from '../types';

const PAGE_SIZE = 30;

export function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    api
      .getMembers()
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.memberNumber.toString().includes(q) ||
        m.area.toLowerCase().includes(q)
    );
  }, [members, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">সদস্য প্রোফাইল</h1>
          <Link
            href="/biodata"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            নতুন সদস্য নিবন্ধন
          </Link>
        </div>

        <div className="mb-8">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="নাম, এলাকা বা সদস্য নং দিয়ে খুঁজুন..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            />
          </div>
        </div>

        {members.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-600">
            কোনো সদস্য পাওয়া যায়নি
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-600">
            আপনার অনুসন্ধানের সাথে কোনো সদস্য মেলেনি
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginated.map((member) => (
                <Link
                  key={member.id}
                  href={`/member/${member.id}`}
                  className="block bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 sm:p-6 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                        {member.name}
                      </h2>
                      <p className="text-blue-100 text-sm tabular-nums mt-0.5">
                        সদস্য নং: {member.memberNumber}
                      </p>
                    </div>
                    <MemberAvatar
                      name={member.name}
                      photoUrl={member.photoUrl}
                      photoVisibility={member.photoVisibility}
                      size="md"
                    />
                  </div>
                  <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        {member.profession}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        {member.area}
                      </span>
                    </div>
                    <span className="text-blue-600 font-semibold text-xs sm:text-sm">
                      বিস্তারিত দেখুন →
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                >
                  পূর্ববর্তী
                </button>
                <span className="text-sm text-slate-600 tabular-nums px-2">
                  পৃষ্ঠা {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                >
                  পরবর্তী
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="উপরে যান"
          className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors z-30"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
