import React, { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { api } from '../lib/api';
import { useRouter } from '../lib/router';
import { useToast } from '../lib/toast';

export function Biodata() {
  const toast = useToast();
  const { navigate } = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    age: '',
    profession: '',
    area: '',
    education: '',
    phone: '',
    email: '',
    hobbies: '',
    about: '',
    photoVisibility: 'show' as 'show' | 'hide',
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('ছবির আকার ৪ মেগাবাইটের কম হতে হবে');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('ফাইল পড়তে সমস্যা হয়েছে'));
        reader.readAsDataURL(file);
      });
      const res = await api.uploadImage(dataUrl, file.name);
      setPhotoUrl(res.url);
      toast.success('ছবি আপলোড সম্পন্ন হয়েছে');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ছবি আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ageNum = Number(form.age);
    if (!form.name.trim() || !form.profession.trim() || !form.area.trim() || !Number.isFinite(ageNum)) {
      toast.error('অনুগ্রহ করে নাম, বয়স, পেশা এবং এলাকা সঠিকভাবে পূরণ করুন');
      return;
    }
    if (ageNum < 14 || ageNum > 100) {
      toast.error('বয়স ১৪ থেকে ১০০ বছরের মধ্যে হতে হবে');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createMember({
        name: form.name.trim(),
        age: ageNum,
        profession: form.profession.trim(),
        area: form.area.trim(),
        education: form.education.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        hobbies: form.hobbies.trim() || null,
        about: form.about.trim() || null,
        photoUrl,
        photoVisibility: form.photoVisibility,
      });
      toast.success(`অভিনন্দন! সদস্য নং ${created.memberNumber} হিসেবে নিবন্ধন সম্পন্ন হয়েছে`);
      navigate(`/member/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'নিবন্ধন করতে ত্রুটি হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2 text-center">
            নতুন সদস্য নিবন্ধন
          </h1>
          <p className="text-slate-600 text-center mb-8 text-sm sm:text-base">
            আপনার তথ্য দিয়ে আমাদের সাথে যুক্ত হন
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                নাম *
              </label>
              <input
                type="text"
                id="name"
                placeholder="আপনার পূর্ণ নাম"
                value={form.name}
                onChange={onChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="age" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  বয়স *
                </label>
                <input
                  type="number"
                  id="age"
                  min={14}
                  max={100}
                  placeholder="বছর"
                  value={form.age}
                  onChange={onChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="area" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  এলাকা *
                </label>
                <input
                  type="text"
                  id="area"
                  placeholder="শহর/জেলা"
                  value={form.area}
                  onChange={onChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="profession" className="block text-sm font-semibold text-slate-700 mb-1.5">
                পেশা *
              </label>
              <input
                type="text"
                id="profession"
                placeholder="আপনার পেশা"
                value={form.profession}
                onChange={onChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="education" className="block text-sm font-semibold text-slate-700 mb-1.5">
                শিক্ষাগত যোগ্যতা
              </label>
              <input
                type="text"
                id="education"
                placeholder="ডিগ্রি, প্রতিষ্ঠান"
                value={form.education}
                onChange={onChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  ফোন নম্বর
                </label>
                <input
                  type="tel"
                  id="phone"
                  placeholder="01XXXXXXXXX"
                  value={form.phone}
                  onChange={onChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  ইমেইল
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={onChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="hobbies" className="block text-sm font-semibold text-slate-700 mb-1.5">
                শখ
              </label>
              <input
                type="text"
                id="hobbies"
                placeholder="বই পড়া, ভ্রমণ, গেমিং"
                value={form.hobbies}
                onChange={onChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label htmlFor="about" className="block text-sm font-semibold text-slate-700 mb-1.5">
                আপনার সম্পর্কে
              </label>
              <textarea
                id="about"
                rows={4}
                placeholder="আপনার সম্পর্কে কিছু বলুন..."
                value={form.about}
                onChange={onChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                ছবি আপলোড করুন
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  id="photo"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
                {photoUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={photoUrl}
                      alt="প্রিভিউ"
                      className="h-32 w-32 object-cover rounded-xl border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl(null)}
                      aria-label="ছবি সরান"
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="photo" className="cursor-pointer block">
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 mb-2 text-blue-600 animate-spin" />
                        <p className="text-sm text-slate-600">আপলোড হচ্ছে...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload className="w-8 h-8 mb-2 text-slate-400" />
                        <p className="text-sm text-slate-600">ক্লিক করে ছবি নির্বাচন করুন</p>
                      </div>
                    )}
                  </label>
                )}
              </div>

              <div className="mt-3 flex items-center gap-4 text-sm text-slate-700">
                <span className="font-medium">প্রোফাইলে ছবি প্রদর্শন:</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="photoVisibility"
                    checked={form.photoVisibility === 'show'}
                    onChange={() => setForm((p) => ({ ...p, photoVisibility: 'show' }))}
                  />
                  দেখাবেন
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="photoVisibility"
                    checked={form.photoVisibility === 'hide'}
                    onChange={() => setForm((p) => ({ ...p, photoVisibility: 'hide' }))}
                  />
                  লুকান
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm sm:text-base transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'জমা হচ্ছে...' : 'বায়োডাটা জমা দিন'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
