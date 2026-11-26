import React, { useState } from 'react';
import { Check, Copy, HeartHandshake, Loader2, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';

const PAYMENT_METHODS = [
  {
    name: 'বিকাশ' as const,
    number: '01750087206',
    accountType: 'ব্যক্তিগত',
    accent: 'text-pink-700 bg-pink-50 border-pink-200',
  },
  {
    name: 'নগদ' as const,
    number: '01750087206',
    accountType: 'ব্যক্তিগত',
    accent: 'text-orange-700 bg-orange-50 border-orange-200',
  },
  {
    name: 'রকেট' as const,
    number: '01750087206',
    accountType: 'ব্যক্তিগত',
    accent: 'text-purple-700 bg-purple-50 border-purple-200',
  },
];

export function Donate() {
  const toast = useToast();
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    donorName: '',
    method: 'বিকাশ' as 'বিকাশ' | 'নগদ' | 'রকেট',
    amount: '',
    transactionId: '',
    phone: '',
    note: '',
  });

  const handleCopy = (name: string, number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedMethod(name);
    toast.success(`${name} নম্বর কপি করা হয়েছে`);
    window.setTimeout(() => setCopiedMethod(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.donorName.trim() || !form.transactionId.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('অনুগ্রহ করে নাম, সঠিক পরিমাণ এবং ট্রানজেকশন আইডি দিন');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitDonation({
        donorName: form.donorName.trim(),
        method: form.method,
        amount,
        transactionId: form.transactionId.trim(),
        phone: form.phone.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      toast.success('আপনার অবদানের তথ্য জমা হয়েছে! এডমিন যাচাই করে নিশ্চিত করবেন।');
      setForm({
        donorName: '',
        method: 'বিকাশ',
        amount: '',
        transactionId: '',
        phone: '',
        note: '',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'তথ্য জমা দিতে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">অবদান রাখুন</h1>
          <p className="text-slate-600 text-base sm:text-lg">
            চিরকুমার সংঘ বাংলাদেশ এর ওয়েবসাইট রক্ষণাবেক্ষণে সহায়তা করুন
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-purple-200 p-6 sm:p-7 mb-8 shadow-xs">
          <h2 className="text-lg font-bold text-purple-800 mb-2">আপনার অবদান গুরুত্বপূর্ণ</h2>
          <p className="text-slate-700 leading-relaxed text-sm sm:text-base">
            এই ওয়েবসাইটটি চিরকুমার সংঘ বাংলাদেশ এর সকল কার্যক্রম পরিচালনা এবং সদস্যদের তথ্য
            সংরক্ষণের জন্য ব্যবহৃত হয়। আপনার দান এই প্ল্যাটফর্মটি চালু রাখতে এবং উন্নত করতে সাহায্য করবে।
          </p>
        </div>

        <div className="space-y-4 mb-10">
          <h2 className="text-2xl font-bold text-slate-900">পেমেন্ট পদ্ধতি</h2>
          {PAYMENT_METHODS.map((pm) => (
            <div
              key={pm.name}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${pm.accent}`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{pm.name}</h3>
                  <p className="text-xs text-slate-500">{pm.accountType} একাউন্ট</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">নম্বর</p>
                  <p className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                    {pm.number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(pm.name, pm.number)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedMethod === pm.name ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      কপি হয়েছে
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      কপি করুন
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900 mb-1.5">ডোনেশন তথ্য জমা দিন</h2>
          <p className="text-sm text-slate-600 mb-6">
            টাকা পাঠানোর পর ট্রানজেকশন আইডি সহ নিচের ফর্মটি পূরণ করুন।
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="donorName" className="block text-sm font-semibold text-slate-700 mb-1">
                  আপনার নাম *
                </label>
                <input
                  id="donorName"
                  type="text"
                  placeholder="পূর্ণ নাম"
                  value={form.donorName}
                  onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="method" className="block text-sm font-semibold text-slate-700 mb-1">
                  মাধ্যম *
                </label>
                <select
                  id="method"
                  value={form.method}
                  onChange={(e) =>
                    setForm({ ...form, method: e.target.value as 'বিকাশ' | 'নগদ' | 'রকেট' })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="বিকাশ">বিকাশ</option>
                  <option value="নগদ">নগদ</option>
                  <option value="রকেট">রকেট</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-slate-700 mb-1">
                  পরিমাণ (টাকা) *
                </label>
                <input
                  id="amount"
                  type="number"
                  min={1}
                  placeholder="যেমন: ১০০"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="trx" className="block text-sm font-semibold text-slate-700 mb-1">
                  ট্রানজেকশন আইডি *
                </label>
                <input
                  id="trx"
                  type="text"
                  placeholder="TrxID"
                  value={form.transactionId}
                  onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="donorPhone" className="block text-sm font-semibold text-slate-700 mb-1">
                প্রেরকের নম্বর (ঐচ্ছিক)
              </label>
              <input
                id="donorPhone"
                type="tel"
                placeholder="01XXXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'জমা হচ্ছে...' : 'ডোনেশন তথ্য জমা দিন'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
