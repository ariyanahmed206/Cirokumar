import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { Committee } from '../types';

export function Committees() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCommittees()
      .then(setCommittees)
      .catch(() => setCommittees([]))
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
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8 text-center">
          সংগঠনের কমিটি
        </h1>

        {committees.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-600">
            এখনও কোনো কমিটি তৈরি করা হয়নি
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {committees.map((committee) => (
              <Link
                key={committee.id}
                href={`/committee/${committee.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all"
              >
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{committee.name}</h2>
                  {committee.description && (
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      {committee.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-5 tabular-nums">
                    <Users className="w-4 h-4 text-blue-600" />
                    সদস্য সংখ্যা: {committee.committeeMembers.length} জন
                  </p>
                </div>
                <span className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                  কমিটি দেখুন
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
