import { useEffect, useState } from 'react';
import { Award, Calendar, HeartHandshake, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { ClubEvent, Committee, Member, Notice } from '../types';

const MOTTOS = [
  {
    text: '"প্রেম-ভালোবাসা ক্ষণিকের, চিরকুমারত্ব চিরন্তন।"',
    icon: ShieldCheck,
    accent: 'text-rose-600 bg-rose-50',
  },
  {
    text: '"একা থাকা মানেই সুখী থাকা, চিরকুমার মানেই রাজা।"',
    icon: Award,
    accent: 'text-amber-600 bg-amber-50',
  },
  {
    text: '"নো টেনশন, নো ফিউশন, চিরকুমার ইজ দ্য সলিউশন।"',
    icon: Sparkles,
    accent: 'text-indigo-600 bg-indigo-50',
  },
  {
    text: '"সিঙ্গেল আছি থাকবো, পুজিবাদি প্রেমের বিরুদ্ধে লড়বো"',
    icon: HeartHandshake,
    accent: 'text-blue-600 bg-blue-50',
  },
];

const RULES = [
  'সদস্যদের অবশ্যই অবিবাহিত থাকতে হবে এবং চিরকুমার থাকার অঙ্গীকার করতে হবে।',
  'মাসিক সভায় নিয়মিত উপস্থিত থাকতে হবে এবং সংগঠনের কার্যক্রমে অংশগ্রহণ করতে হবে।',
  'অন্য সদস্যদের সাথে সৌহার্দ্যপূর্ণ সম্পর্ক বজায় রাখতে হবে এবং পারস্পরিক সহযোগিতা করতে হবে।',
  'সংগঠনের সুনাম রক্ষা করতে হবে এবং যেকোনো অসামাজিক কার্যকলাপ থেকে বিরত থাকতে হবে।',
  'নতুন সদস্য সংগ্রহে সহায়তা করতে হবে এবং সংগঠনের প্রচার-প্রসারে ভূমিকা রাখতে হবে।',
];

function toBengaliDigits(num: number): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[Number(d)]);
}

export function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMembers().catch(() => []),
      api.getCommittees().catch(() => []),
      api.getEvents().catch(() => []),
      api.getNotices().catch(() => []),
    ]).then(([m, c, e, n]) => {
      setMembers(m);
      setCommittees(c);
      setEvents(e);
      setNotices(n);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-blue-600 mb-4 leading-tight"
            style={{ textWrap: 'balance' }}
          >
            চিরকুমার সংঘ বাংলাদেশ
          </h1>
          <p className="text-base sm:text-xl text-slate-700 font-medium mb-3">
            চিরকুমার সংঘ এর অফিসিয়াল ওয়েবসাইটে আপনাকে স্বাগতম
          </p>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-8">
            যারা স্বাধীনতাকে ভালোবাসেন, তাদের জন্য একটি বিশেষ প্ল্যাটফর্ম
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Link
              href="/members"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm sm:text-base shadow-sm transition-all whitespace-nowrap"
            >
              সদস্যদের দেখুন
            </Link>
            <Link
              href="/biodata"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 font-semibold text-sm sm:text-base transition-colors whitespace-nowrap"
            >
              বায়োডাটা জমা দিন
            </Link>
          </div>
        </div>
      </section>

      {/* Mottos */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {MOTTOS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.text}
                className="bg-white rounded-xl border border-slate-200 p-6 flex items-start gap-4 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-slate-800 font-medium text-base sm:text-lg leading-relaxed">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 tabular-nums mb-1">
                {loading ? '...' : toBengaliDigits(members.length)}
              </div>
              <div className="text-slate-600 text-sm sm:text-base">মোট সদস্য</div>
            </div>
            <Link
              href="/members"
              className="mt-4 inline-flex items-center justify-center w-full py-2 px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
            >
              সদস্য দেখুন
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs hover:shadow-md transition-shadow flex flex-col justify-center">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-rose-600 tabular-nums mb-1">১০০%</div>
            <div className="text-slate-600 text-sm sm:text-base">স্বাধীনতা</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs hover:shadow-md transition-shadow flex flex-col justify-center">
            <div className="w-11 h-11 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-purple-600 tabular-nums mb-1">২০২৫</div>
            <div className="text-slate-600 text-sm sm:text-base">প্রতিষ্ঠিত</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Award className="w-5 h-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-emerald-600 tabular-nums mb-1">
                {loading ? '...' : toBengaliDigits(committees.length)}
              </div>
              <div className="text-slate-600 text-sm sm:text-base">মোট কমিটি</div>
            </div>
            <Link
              href="/committees"
              className="mt-4 inline-flex items-center justify-center w-full py-2 px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
            >
              কমিটি দেখুন
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 text-center">
            আসন্ন ইভেন্ট ও সভা
          </h2>
          {events.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-600">
              এখনও কোনো ইভেন্ট নির্ধারিত হয়নি
            </div>
          ) : (
            <div className="space-y-4">
              {events.slice(0, 3).map((ev) => (
                <div
                  key={ev.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-xs hover:shadow-md transition-shadow"
                >
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">{ev.title}</h3>
                  <div className="space-y-2 text-sm sm:text-base text-slate-700">
                    <p>
                      <span className="font-semibold">তারিখ:</span> {ev.date}
                    </p>
                    <p>
                      <span className="font-semibold">সময়:</span> {ev.time}
                    </p>
                    <p>
                      <span className="font-semibold">স্থান:</span> {ev.location}
                    </p>
                    {ev.description && <p className="text-slate-600 pt-1">{ev.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent Notices */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 text-center">
            সাম্প্রতিক নোটিশ
          </h2>
          {notices.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-600">
              এখনও কোনো নোটিশ নেই
            </div>
          ) : (
            <div>
              <div className="space-y-4 mb-6">
                {notices.slice(0, 3).map((notice) => (
                  <div
                    key={notice.id}
                    className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
                      {notice.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mb-4 tabular-nums">
                      {notice.date}
                      {notice.time ? ` · ${notice.time}` : ''}
                    </p>
                    <Link
                      href="/notices"
                      className="inline-flex items-center px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
                    >
                      বিস্তারিত দেখুন
                    </Link>
                  </div>
                ))}
              </div>
              {notices.length > 3 && (
                <div className="text-center">
                  <Link
                    href="/notices"
                    className="inline-flex items-center px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
                  >
                    আরো নোটিশ দেখুন
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Organization Rules */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-8 text-center">
            সংগঠনের নিয়মাবলী
          </h2>
          <div className="space-y-4">
            {RULES.map((rule, idx) => (
              <div
                key={idx}
                className="bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 flex items-start gap-4"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shrink-0 tabular-nums">
                  {toBengaliDigits(idx + 1)}
                </div>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed pt-1">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Join CTA */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">আমাদের সাথে যোগ দিন</h2>
          <p className="text-white/90 text-sm sm:text-base mb-7">
            আপনার তথ্য জমা দিয়ে আমাদের সংগঠনের অংশ হন
          </p>
          <Link
            href="/biodata"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-blue-700 hover:bg-slate-100 font-semibold text-sm sm:text-base shadow-sm transition-colors"
          >
            এখনই যোগ দিন
          </Link>
        </div>
      </section>
    </div>
  );
}
