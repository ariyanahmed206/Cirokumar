import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { MemberAvatar } from '../components/MemberAvatar';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { Committee } from '../types';

export function CommitteeDetail({ id }: { id: number }) {
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .getCommittee(id)
      .then(setCommittee)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !committee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-14 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-600 mb-4">কমিটি পাওয়া যায়নি।</p>
          <Link
            href="/committees"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            কমিটি তালিকায় ফিরুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/committees"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          ফিরে যান
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">{committee.name}</h1>
          {committee.description && (
            <p className="text-slate-600 text-base sm:text-lg">{committee.description}</p>
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-5">সদস্যরা</h2>

        {committee.committeeMembers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
            এই কমিটিতে এখনও কোনো সদস্য যোগ করা হয়নি
          </div>
        ) : (
          <div className="space-y-4">
            {committee.committeeMembers.map((cm) => (
              <div
                key={cm.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <MemberAvatar name={cm.memberName} photoUrl={cm.photoUrl} size="md" />
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                      {cm.memberName}
                    </h3>
                    <p className="text-sm text-blue-700 font-semibold mt-0.5">{cm.position}</p>
                    {cm.memberNumber && (
                      <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                        সদস্য নং: {cm.memberNumber}
                      </p>
                    )}
                  </div>
                </div>

                {cm.memberId && (
                  <Link
                    href={`/member/${cm.memberId}`}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
                  >
                    প্রোফাইল দেখুন
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
