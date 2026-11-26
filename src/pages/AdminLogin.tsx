import React, { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { api, getAdminToken, setAdminAuth } from '../lib/api';
import { useRouter } from '../lib/router';
import { useToast } from '../lib/toast';

export function AdminLogin() {
  const toast = useToast();
  const { navigate } = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getAdminToken()) {
      api
        .checkAdminSession()
        .then(() => navigate('/admin'))
        .catch(() => {});
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('অনুগ্রহ করে সকল ক্ষেত্র পূরণ করুন');
      return;
    }
    setLoading(true);
    try {
      const res = await api.adminLogin(username.trim(), password);
      setAdminAuth(res.token, res.username);
      toast.success('সফলভাবে লগইন হয়েছেন!');
      navigate('/admin');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ব্যবহারকারীর নাম বা পাসওয়ার্ড ভুল');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5 text-center">
          এডমিন প্যানেল
        </h1>
        <p className="text-slate-600 text-center mb-7 text-sm sm:text-base">লগইন করুন</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-1.5">
              ব্যবহারকারীর নাম
            </label>
            <input
              id="username"
              type="text"
              placeholder="ব্যবহারকারীর নাম"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
              পাসওয়ার্ড
            </label>
            <input
              id="password"
              type="password"
              placeholder="পাসওয়ার্ড"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'লগইন করছি...' : 'লগইন'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 text-xs text-slate-500 text-center">
          ডিফল্ট এডমিন: <span className="font-mono font-semibold text-slate-700">Nazmul</span> /{' '}
          <span className="font-mono font-semibold text-slate-700">chirakumar2025</span>
        </div>
      </div>
    </div>
  );
}
