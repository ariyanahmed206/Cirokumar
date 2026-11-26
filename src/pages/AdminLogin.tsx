import { useEffect, useState } from 'react';
import { Loader2, Lock, LogIn } from 'lucide-react';
import { api } from '../lib/api';
import { useRouter } from '../lib/router';
import { useToast } from '../lib/toast';

export function AdminLogin() {
  const toast = useToast();
  const { navigate } = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .checkAdminSession()
      .then(() => navigate('/admin'))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await api.signInWithGoogleAdmin();
      toast.success('সফলভাবে লগইন হয়েছেন!');
      navigate('/admin');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('auth/unauthorized-domain')) {
        toast.error(
          `এই ডোমেইনটি (${window.location.hostname}) Firebase Authorized Domains-এ যোগ করা নেই।`
        );
      } else if (msg.includes('auth/popup-closed-by-user')) {
        toast.info('লগইন পপআপটি বন্ধ করা হয়েছে');
      } else if (msg.includes('Missing or insufficient permissions')) {
        toast.error('Firestore অনুমতিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } else {
        toast.error(msg || 'লগইন করতে সমস্যা হয়েছে');
      }
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
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5">
          এডমিন প্যানেল
        </h1>
        <p className="text-slate-600 mb-7 text-sm sm:text-base">
          Firebase Google অ্যাকাউন্ট দিয়ে লগইন করুন
        </p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 shadow-xs"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          {loading ? 'লগইন করছি...' : 'Google দিয়ে এডমিন লগইন করুন'}
        </button>

        <div className="mt-6 pt-5 border-t border-slate-200 text-xs text-slate-500">
          অনুমোদিত এডমিন Google অ্যাকাউন্ট দিয়ে সাইন-ইন করলে Firestore ডেটাবেস সরাসরি পরিচালনা করতে পারবেন।
        </div>
      </div>
    </div>
  );
}
