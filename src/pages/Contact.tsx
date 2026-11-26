import React, { useState } from 'react';
import { ExternalLink, Loader2, MessageSquare, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';

export function Contact() {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('অনুগ্রহ করে সকল ক্ষেত্র পূরণ করুন');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      });
      toast.success('আপনার বার্তা সফলভাবে পাঠানো হয়েছে!');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'বার্তা পাঠাতে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            আমাদের সাথে যোগাযোগ করুন
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            আপনার প্রশ্ন বা পরামর্শ আমাদের কাছে পাঠান
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                আপনার নাম
              </label>
              <input
                id="contact-name"
                type="text"
                placeholder="নাম লিখুন"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                ইমেইল
              </label>
              <input
                id="contact-email"
                type="email"
                placeholder="ইমেইল লিখুন"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-semibold text-slate-700 mb-1.5">
                বার্তা
              </label>
              <textarea
                id="contact-message"
                placeholder="আপনার বার্তা লিখুন"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={5}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}
            </button>
          </form>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-start gap-4">
          <MessageSquare className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-slate-900 mb-1">অফিসিয়াল ফেসবুক পেজ</h2>
            <p className="text-sm text-slate-600 mb-3">
              তাৎক্ষণিক যোগাযোগ এবং সর্বশেষ আপডেট পেতে আমাদের অফিসিয়াল ফেসবুক পেজে যুক্ত হন।
            </p>
            <a
              href="https://www.facebook.com/profile.php?id=61576054679841"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              ফেসবুক পেজ ভিজিট করুন
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
