import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, LogIn } from 'lucide-react';
import { api } from '../lib/api';
import { useRouter } from '../lib/router';
import { useToast } from '../lib/toast';

export function AdminLogin() {
  const toast = useToast();
  const { navigate } = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    api
      .checkAdminSession()
      .then(() => navigate('/admin'))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('ইউজারনেম এবং পাসওয়ার্ড দিন');
      return;
    }
    setLoading(true);
    try {
      await api.loginAdmin(username.trim(), password);
      toast.success('সফলভাবে লগইন হয়েছেন!');
      navigate('/admin');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'লগইন করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5 text-center">
          এডমিন প্যানেল
        </h1>
        <p className="text-slate-600 mb-6 text-sm sm:text-base text-center">
          আপনার এডমিন ইউজারনেম ও পাসওয়ার্ড দিয়ে লগইন করুন
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="block text-sm font-semibold text-slate-700 mb-1.5">
              ইউজারনেম
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              placeholder="ইউজারনেম লিখুন"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
              পাসওয়ার্ড
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="পাসওয়ার্ড লিখুন"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-11 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-xs"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {loading ? 'যাচাই করছি...' : 'এডমিন লগইন করুন'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 text-center">
          লগইন করার পর এডমিন সেটিংস থেকে পাসওয়ার্ড পরিবর্তন ও নতুন এডমিন যোগ করতে পারবেন।
        </div>
      </div>
    </div>
  );
}
