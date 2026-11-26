import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Info, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import type { ClubNotification } from '../types';

type FilterType = 'all' | 'announcement' | 'alert' | 'info';

export function Notifications({ onUnreadChange }: { onUnreadChange?: (count: number) => void }) {
  const toast = useToast();
  const [items, setItems] = useState<ClubNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setItems(data);
      onUnreadChange?.(data.filter((n) => !n.isRead).length);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      await fetchNotifications();
      toast.success('বিজ্ঞপ্তি পঠিত হিসেবে চিহ্নিত হয়েছে');
    } catch {
      toast.error('বিজ্ঞপ্তি চিহ্নিত করতে ত্রুটি হয়েছে');
    }
  };

  const typeLabel = (t: ClubNotification['type']) => {
    if (t === 'announcement') return 'ঘোষণা';
    if (t === 'alert') return 'সতর্কতা';
    return 'তথ্য';
  };

  const renderIcon = (t: ClubNotification['type']) => {
    if (t === 'alert') return <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />;
    if (t === 'info') return <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />;
    return <Bell className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />;
  };

  const filtered = items.filter((n) => (filter === 'all' ? true : n.type === filter));
  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">আমার বিজ্ঞপ্তি</h1>
          <p className="text-slate-600 text-sm sm:text-base">
            {unreadCount > 0 ? (
              <>
                আপনার <span className="font-bold text-blue-600 tabular-nums">{unreadCount}</span> টি
                নতুন বিজ্ঞপ্তি রয়েছে
              </>
            ) : (
              'কোনো নতুন বিজ্ঞপ্তি নেই'
            )}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl mb-6 flex-wrap">
          {(
            [
              { id: 'all', label: 'সব' },
              { id: 'announcement', label: 'ঘোষণা' },
              { id: 'alert', label: 'সতর্কতা' },
              { id: 'info', label: 'তথ্য' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-6 transition-colors ${
                  item.isRead
                    ? 'bg-white border-slate-200'
                    : 'bg-blue-50/60 border-blue-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex gap-3.5 flex-1">
                    {renderIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                        <span className="font-medium text-slate-700">{typeLabel(item.type)}</span>
                        {!item.isRead && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-blue-700">নতুন</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString('bn-BD', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mb-1.5">{item.title}</h2>
                      <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </div>
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => markAsRead(item.id)}
                      className="self-start px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors"
                    >
                      পড়া হয়েছে
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Bell className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 text-base">
              {filter === 'all' ? 'কোনো বিজ্ঞপ্তি নেই' : `কোনো ${typeLabel(filter)} বিজ্ঞপ্তি নেই`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
