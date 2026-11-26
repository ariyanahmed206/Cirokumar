import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { ClubEvent } from '../types';

export function Events() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
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
          আসন্ন ইভেন্ট ও সভা
        </h1>

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-600 text-base sm:text-lg">
            এখনও কোনো ইভেন্ট নির্ধারিত হয়নি
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow"
              >
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-5">{ev.title}</h2>
                <div className="space-y-3 text-base sm:text-lg text-slate-700">
                  <div className="flex items-start gap-3">
                    <span className="font-semibold min-w-fit">তারিখ:</span>
                    <span className="tabular-nums">{ev.date}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-semibold min-w-fit">সময়:</span>
                    <span>{ev.time}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-semibold min-w-fit">স্থান:</span>
                    <span>{ev.location}</span>
                  </div>
                  {ev.description && (
                    <div className="flex items-start gap-3 pt-3 border-t border-slate-200">
                      <span className="font-semibold min-w-fit">বর্ণনা:</span>
                      <span className="text-slate-600">{ev.description}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
