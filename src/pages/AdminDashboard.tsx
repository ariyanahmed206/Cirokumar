import React, { useEffect, useState } from 'react';
import {
  Check,
  Edit2,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { api, clearAdminAuth, getAdminToken, getAdminUsername } from '../lib/api';
import { useRouter } from '../lib/router';
import { useToast } from '../lib/toast';
import type {
  ClubEvent,
  ClubNotification,
  Committee,
  ContactMessage,
  DonationRecord,
  Member,
  Notice,
  SiteSettings,
} from '../types';

type AdminTab =
  | 'members'
  | 'notices'
  | 'events'
  | 'committees'
  | 'donations'
  | 'notifications'
  | 'messages'
  | 'admin'
  | 'settings';

export function AdminDashboard({
  onSettingsUpdated,
  onNotificationsUpdated,
}: {
  onSettingsUpdated?: () => void;
  onNotificationsUpdated?: () => void;
}) {
  const toast = useToast();
  const { navigate } = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('members');

  const [members, setMembers] = useState<Member[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [notifications, setNotifications] = useState<ClubNotification[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});

  // Member form state
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState({
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

  // Notice form state
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
  });

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
  });

  // Committee management state
  const [newCommittee, setNewCommittee] = useState({ name: '', description: '' });
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(null);
  const [cmMode, setCmMode] = useState<'existing' | 'custom'>('existing');
  const [cmForm, setCmForm] = useState({ memberId: '', memberName: '', position: '' });
  const [editingCmId, setEditingCmId] = useState<number | null>(null);
  const [editingCmPosition, setEditingCmPosition] = useState('');

  // Notification form state
  const [notifForm, setNotifForm] = useState({
    title: '',
    message: '',
    type: 'announcement' as 'announcement' | 'alert' | 'info',
  });

  // Admin settings state
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [newAdminForm, setNewAdminForm] = useState({ username: '', password: '' });
  const [appLinkInput, setAppLinkInput] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadAll = async () => {
    try {
      const [m, n, e, c, d, notifs, msgs, s] = await Promise.all([
        api.getMembers(),
        api.getNotices(),
        api.getEvents(),
        api.getCommittees(),
        api.getDonations(),
        api.getNotifications(),
        api.getMessages(),
        api.getSettings(),
      ]);
      setMembers(m);
      setNotices(n);
      setEvents(e);
      setCommittees(c);
      setDonations(d);
      setNotifications(notifs);
      setMessages(msgs);
      setSettings(s);
      setAppLinkInput(s.appDownloadLink || '');
      if (c.length > 0 && !selectedCommitteeId) {
        setSelectedCommitteeId(c[0].id);
      }
    } catch {
      toast.error('তথ্য লোড করতে সমস্যা হয়েছে');
    }
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      navigate('/admin/login');
      return;
    }
    api
      .checkAdminSession()
      .then(() => {
        setCheckingAuth(false);
        loadAll();
      })
      .catch(() => {
        clearAdminAuth();
        navigate('/admin/login');
      });
  }, []);

  const handleLogout = () => {
    clearAdminAuth();
    toast.info('সফলভাবে লগআউট হয়েছেন');
    navigate('/admin/login');
  };

  const resetMemberForm = () => {
    setEditingMemberId(null);
    setMemberForm({
      name: '',
      age: '',
      profession: '',
      area: '',
      education: '',
      phone: '',
      email: '',
      hobbies: '',
      about: '',
      photoVisibility: 'show',
    });
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const ageNum = Number(memberForm.age);
    if (!memberForm.name.trim() || !memberForm.profession.trim() || !memberForm.area.trim() || !Number.isFinite(ageNum)) {
      toast.error('নাম, বয়স, পেশা এবং এলাকা আবশ্যক');
      return;
    }
    try {
      if (editingMemberId) {
        await api.updateMember(editingMemberId, {
          name: memberForm.name.trim(),
          age: ageNum,
          profession: memberForm.profession.trim(),
          area: memberForm.area.trim(),
          education: memberForm.education.trim() || null,
          phone: memberForm.phone.trim() || null,
          email: memberForm.email.trim() || null,
          hobbies: memberForm.hobbies.trim() || null,
          about: memberForm.about.trim() || null,
          photoVisibility: memberForm.photoVisibility,
        });
        toast.success('সদস্যের তথ্য হালনাগাদ হয়েছে');
      } else {
        await api.createMember({
          name: memberForm.name.trim(),
          age: ageNum,
          profession: memberForm.profession.trim(),
          area: memberForm.area.trim(),
          education: memberForm.education.trim() || null,
          phone: memberForm.phone.trim() || null,
          email: memberForm.email.trim() || null,
          hobbies: memberForm.hobbies.trim() || null,
          about: memberForm.about.trim() || null,
          photoUrl: null,
          photoVisibility: memberForm.photoVisibility,
        });
        toast.success('নতুন সদস্য যোগ করা হয়েছে');
      }
      resetMemberForm();
      setShowMemberForm(false);
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে');
    }
  };

  const startEditMember = (m: Member) => {
    setEditingMemberId(m.id);
    setMemberForm({
      name: m.name,
      age: String(m.age),
      profession: m.profession,
      area: m.area,
      education: m.education || '',
      phone: m.phone || '',
      email: m.email || '',
      hobbies: m.hobbies || '',
      about: m.about || '',
      photoVisibility: m.photoVisibility,
    });
    setShowMemberForm(true);
  };

  const handleDeleteMember = async (id: number) => {
    try {
      await api.deleteMember(id);
      toast.success('সদস্য মুছে ফেলা হয়েছে');
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'মুছতে ত্রুটি হয়েছে');
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createNotice({
        title: noticeForm.title.trim(),
        date: noticeForm.date.trim(),
        time: noticeForm.time.trim() || null,
        location: noticeForm.location.trim() || null,
        description: noticeForm.description.trim() || null,
      });
      toast.success('নোটিশ প্রকাশ করা হয়েছে');
      setNoticeForm({ title: '', date: '', time: '', location: '', description: '' });
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'নোটিশ যোগ করতে ত্রুটি হয়েছে');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEvent({
        title: eventForm.title.trim(),
        date: eventForm.date.trim(),
        time: eventForm.time.trim(),
        location: eventForm.location.trim(),
        description: eventForm.description.trim() || null,
      });
      toast.success('নতুন ইভেন্ট যোগ করা হয়েছে');
      setEventForm({ title: '', date: '', time: '', location: '', description: '' });
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ইভেন্ট যোগ করতে ত্রুটি হয়েছে');
    }
  };

  const handleCreateCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommittee.name.trim()) {
      toast.error('কমিটির নাম প্রয়োজন');
      return;
    }
    try {
      const created = await api.createCommittee({
        name: newCommittee.name.trim(),
        description: newCommittee.description.trim() || null,
      });
      toast.success('নতুন কমিটি তৈরি হয়েছে');
      setNewCommittee({ name: '', description: '' });
      setSelectedCommitteeId(created.id);
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'কমিটি তৈরি করতে ত্রুটি হয়েছে');
    }
  };

  const handleAddCommitteeMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommitteeId || !cmForm.position.trim()) {
      toast.error('কমিটি এবং পদবি আবশ্যক');
      return;
    }
    try {
      await api.addCommitteeMember({
        committeeId: selectedCommitteeId,
        memberId: cmMode === 'existing' && cmForm.memberId ? Number(cmForm.memberId) : null,
        memberName: cmMode === 'custom' ? cmForm.memberName.trim() : undefined,
        position: cmForm.position.trim(),
      });
      toast.success('কমিটিতে সদস্য যোগ করা হয়েছে');
      setCmForm({ memberId: '', memberName: '', position: '' });
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'সদস্য যোগ করতে ত্রুটি হয়েছে');
    }
  };

  const handleUpdateCmPosition = async (id: number) => {
    if (!editingCmPosition.trim()) return;
    try {
      await api.updateCommitteeMember(id, editingCmPosition.trim());
      toast.success('পদবি হালনাগাদ হয়েছে');
      setEditingCmId(null);
      setEditingCmPosition('');
      await loadAll();
    } catch {
      toast.error('হালনাগাদ করতে ত্রুটি হয়েছে');
    }
  };

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createNotification({
        title: notifForm.title.trim(),
        message: notifForm.message.trim(),
        type: notifForm.type,
      });
      toast.success('নতুন বিজ্ঞপ্তি পাঠানো হয়েছে');
      setNotifForm({ title: '', message: '', type: 'announcement' });
      onNotificationsUpdated?.();
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'বিজ্ঞপ্তি পাঠাতে ত্রুটি হয়েছে');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('ফাইল পড়তে সমস্যা হয়েছে'));
        reader.readAsDataURL(file);
      });
      const up = await api.uploadImage(dataUrl, 'logo');
      const updated = await api.updateSettings({ logoUrl: up.url });
      setSettings(updated);
      onSettingsUpdated?.();
      toast.success('লোগো আপডেট হয়েছে');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'লোগো আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveAppLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.updateSettings({ appDownloadLink: appLinkInput.trim() || null });
      setSettings(updated);
      onSettingsUpdated?.();
      toast.success('অ্যাপ লিংক সংরক্ষণ করা হয়েছে');
    } catch {
      toast.error('সেটিংস সংরক্ষণে ত্রুটি হয়েছে');
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'members', label: 'সদস্য ব্যবস্থাপনা' },
    { id: 'notices', label: 'নোটিশ ব্যবস্থাপনা' },
    { id: 'events', label: 'ইভেন্ট ব্যবস্থাপনা' },
    { id: 'committees', label: 'কমিটি ব্যবস্থাপনা' },
    { id: 'donations', label: 'ডোনেশন ব্যবস্থাপনা' },
    { id: 'notifications', label: 'বিজ্ঞপ্তি ব্যবস্থাপনা' },
    { id: 'messages', label: `বার্তা (${messages.length})` },
    { id: 'admin', label: 'এডমিন সেটিংস' },
    { id: 'settings', label: 'সাইট সেটিংস' },
  ];

  const selectedCommittee = committees.find((c) => c.id === selectedCommitteeId) || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">এডমিন ড্যাশবোর্ড</h1>
            <p className="text-sm text-slate-600">স্বাগতম, {getAdminUsername() || 'এডমিন'}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4" />
            লগআউট
          </button>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                সদস্য তালিকা ({members.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (showMemberForm) {
                    setShowMemberForm(false);
                    resetMemberForm();
                  } else {
                    resetMemberForm();
                    setShowMemberForm(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                {showMemberForm ? 'ফর্ম বন্ধ করুন' : 'নতুন সদস্য'}
              </button>
            </div>

            {showMemberForm && (
              <form
                onSubmit={handleSaveMember}
                className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 space-y-4 shadow-xs"
              >
                <h3 className="text-lg font-bold text-slate-900">
                  {editingMemberId ? 'সদস্য সম্পাদনা করুন' : 'নতুন সদস্য যোগ করুন'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="নাম *"
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                  <input
                    type="number"
                    placeholder="বয়স *"
                    value={memberForm.age}
                    onChange={(e) => setMemberForm({ ...memberForm, age: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="পেশা *"
                    value={memberForm.profession}
                    onChange={(e) => setMemberForm({ ...memberForm, profession: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="এলাকা *"
                    value={memberForm.area}
                    onChange={(e) => setMemberForm({ ...memberForm, area: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="শিক্ষাগত যোগ্যতা"
                    value={memberForm.education}
                    onChange={(e) => setMemberForm({ ...memberForm, education: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="ফোন নম্বর"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    type="email"
                    placeholder="ইমেইল"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="শখ"
                    value={memberForm.hobbies}
                    onChange={(e) => setMemberForm({ ...memberForm, hobbies: e.target.value })}
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <textarea
                  rows={3}
                  placeholder="সদস্যের সম্পর্কে"
                  value={memberForm.about}
                  onChange={(e) => setMemberForm({ ...memberForm, about: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <select
                    value={memberForm.photoVisibility}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        photoVisibility: e.target.value as 'show' | 'hide',
                      })
                    }
                    className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="show">ছবি দেখান</option>
                    <option value="hide">ছবি লুকান</option>
                  </select>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                  >
                    সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      #{m.memberNumber} · {m.name}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600">
                      {m.profession} · {m.area} · {m.age} বছর
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditMember(m)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      সম্পাদনা
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMember(m.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      মুছুন
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTICES TAB */}
        {activeTab === 'notices' && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateNotice}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <h2 className="text-xl font-bold text-slate-900">নতুন নোটিশ প্রকাশ করুন</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="শিরোনাম *"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2"
                  required
                />
                <input
                  type="date"
                  value={noticeForm.date}
                  onChange={(e) => setNoticeForm({ ...noticeForm, date: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="সময় (যেমন: ১৯:০০)"
                  value={noticeForm.time}
                  onChange={(e) => setNoticeForm({ ...noticeForm, time: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="স্থান"
                  value={noticeForm.location}
                  onChange={(e) => setNoticeForm({ ...noticeForm, location: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2"
                />
              </div>
              <textarea
                rows={3}
                placeholder="বিস্তারিত বিবরণ"
                value={noticeForm.description}
                onChange={(e) => setNoticeForm({ ...noticeForm, description: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                নোটিশ যোগ করুন
              </button>
            </form>

            <div className="space-y-3">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <h3 className="font-bold text-slate-900">{n.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {n.date} {n.time ? `· ${n.time}` : ''}
                    </p>
                    {n.description && <p className="text-sm text-slate-600 mt-1">{n.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteNotice(n.id);
                      toast.success('নোটিশ মুছে ফেলা হয়েছে');
                      loadAll();
                    }}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 shrink-0"
                    aria-label="মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateEvent}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <h2 className="text-xl font-bold text-slate-900">নতুন ইভেন্ট যোগ করুন</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="ইভেন্টের শিরোনাম *"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2"
                  required
                />
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="সময় *"
                  value={eventForm.time}
                  onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="স্থান *"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm sm:col-span-2"
                  required
                />
              </div>
              <textarea
                rows={3}
                placeholder="বর্ণনা"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                ইভেন্ট তৈরি করুন
              </button>
            </form>

            <div className="space-y-3">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <h3 className="font-bold text-slate-900">{ev.title}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                      {ev.date} · {ev.time} · {ev.location}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteEvent(ev.id);
                      toast.success('ইভেন্ট মুছে ফেলা হয়েছে');
                      loadAll();
                    }}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 shrink-0"
                    aria-label="মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMMITTEES TAB */}
        {activeTab === 'committees' && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateCommittee}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <h2 className="text-xl font-bold text-slate-900">নতুন কমিটি তৈরি করুন</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="কমিটির নাম *"
                  value={newCommittee.name}
                  onChange={(e) => setNewCommittee({ ...newCommittee, name: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="সংক্ষিপ্ত বিবরণ"
                  value={newCommittee.description}
                  onChange={(e) => setNewCommittee({ ...newCommittee, description: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                কমিটি যোগ করুন
              </button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                {committees.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCommitteeId(c.id)}
                    className={`cursor-pointer rounded-xl border p-4 flex items-center justify-between gap-2 transition-colors ${
                      selectedCommitteeId === c.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {c.committeeMembers.length} জন সদস্য
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await api.deleteCommittee(c.id);
                        toast.success('কমিটি মুছে ফেলা হয়েছে');
                        if (selectedCommitteeId === c.id) setSelectedCommitteeId(null);
                        loadAll();
                      }}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 shrink-0"
                      aria-label="কমিটি মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-2">
                {selectedCommittee ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{selectedCommittee.name}</h3>
                      {selectedCommittee.description && (
                        <p className="text-sm text-slate-600 mt-1">{selectedCommittee.description}</p>
                      )}
                    </div>

                    <form
                      onSubmit={handleAddCommitteeMember}
                      className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-blue-600" />
                          সদস্য যোগ করুন
                        </span>
                        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setCmMode('existing')}
                            className={`px-2.5 py-1 rounded-md font-medium ${
                              cmMode === 'existing' ? 'bg-blue-600 text-white' : 'text-slate-600'
                            }`}
                          >
                            নিবন্ধিত সদস্য
                          </button>
                          <button
                            type="button"
                            onClick={() => setCmMode('custom')}
                            className={`px-2.5 py-1 rounded-md font-medium ${
                              cmMode === 'custom' ? 'bg-blue-600 text-white' : 'text-slate-600'
                            }`}
                          >
                            নতুন নাম
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {cmMode === 'existing' ? (
                          <select
                            value={cmForm.memberId}
                            onChange={(e) => setCmForm({ ...cmForm, memberId: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            required
                          >
                            <option value="">সদস্য নির্বাচন করুন</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                #{m.memberNumber} - {m.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="সদস্যের নাম *"
                            value={cmForm.memberName}
                            onChange={(e) => setCmForm({ ...cmForm, memberName: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            required
                          />
                        )}
                        <input
                          type="text"
                          placeholder="পদবি (যেমন: সভাপতি) *"
                          value={cmForm.position}
                          onChange={(e) => setCmForm({ ...cmForm, position: e.target.value })}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                      >
                        যোগ করুন
                      </button>
                    </form>

                    <div className="space-y-2.5">
                      {selectedCommittee.committeeMembers.map((cm) => (
                        <div
                          key={cm.id}
                          className="border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{cm.memberName}</p>
                            {editingCmId === cm.id ? (
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="text"
                                  value={editingCmPosition}
                                  onChange={(e) => setEditingCmPosition(e.target.value)}
                                  className="px-2.5 py-1 border border-slate-300 rounded text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCmPosition(cm.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs"
                                >
                                  সংরক্ষণ
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-blue-700 font-semibold">{cm.position}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCmId(cm.id);
                                setEditingCmPosition(cm.position);
                              }}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                              aria-label="পদবি সম্পাদনা"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.deleteCommitteeMember(cm.id);
                                toast.success('কমিটি থেকে সরানো হয়েছে');
                                loadAll();
                              }}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                              aria-label="মুছুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
                    বাম পাশ থেকে একটি কমিটি নির্বাচন করুন
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DONATIONS TAB */}
        {activeTab === 'donations' && (
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              ডোনেশন তালিকা ({donations.length})
            </h2>
            {donations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
                এখনও কোনো ডোনেশন রেকর্ড জমা হয়নি
              </div>
            ) : (
              donations.map((d) => (
                <div
                  key={d.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {d.donorName} · {d.amount} টাকা ({d.method})
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                      TrxID: {d.transactionId} {d.phone ? `· ${d.phone}` : ''} ·{' '}
                      <span className={d.status === 'verified' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                        {d.status === 'verified' ? 'যাচাইকৃত' : 'অপেক্ষমান'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status !== 'verified' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await api.updateDonationStatus(d.id, 'verified');
                          toast.success('ডোনেশন যাচাইকৃত হিসেবে চিহ্নিত');
                          loadAll();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                      >
                        <Check className="w-3.5 h-3.5" />
                        যাচাই করুন
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await api.deleteDonation(d.id);
                        toast.success('রেকর্ড মুছে ফেলা হয়েছে');
                        loadAll();
                      }}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      aria-label="মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateNotification}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <h2 className="text-xl font-bold text-slate-900">নতুন বিজ্ঞপ্তি পাঠান</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="শিরোনাম *"
                  value={notifForm.title}
                  onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
                <select
                  value={notifForm.type}
                  onChange={(e) =>
                    setNotifForm({
                      ...notifForm,
                      type: e.target.value as 'announcement' | 'alert' | 'info',
                    })
                  }
                  className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="announcement">ঘোষণা</option>
                  <option value="alert">সতর্কতা</option>
                  <option value="info">তথ্য</option>
                </select>
              </div>
              <textarea
                rows={3}
                placeholder="বিজ্ঞপ্তির বার্তা *"
                value={notifForm.message}
                onChange={(e) => setNotifForm({ ...notifForm, message: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                বিজ্ঞপ্তি পাঠান
              </button>
            </form>

            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteNotification(n.id);
                      toast.success('বিজ্ঞপ্তি মুছে ফেলা হয়েছে');
                      onNotificationsUpdated?.();
                      loadAll();
                    }}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 shrink-0"
                    aria-label="মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">যোগাযোগ বার্তা</h2>
            {messages.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
                কোনো বার্তা নেই
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {msg.name} <span className="text-xs font-normal text-slate-500">({msg.email})</span>
                    </p>
                    <p className="text-sm text-slate-700 mt-1.5">{msg.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteMessage(msg.id);
                      toast.success('বার্তা মুছে ফেলা হয়েছে');
                      loadAll();
                    }}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 shrink-0"
                    aria-label="মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ADMIN SETTINGS TAB */}
        {activeTab === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.changePassword(pwdForm.currentPassword, pwdForm.newPassword);
                  toast.success('পাসওয়ার্ড পরিবর্তন করা হয়েছে');
                  setPwdForm({ currentPassword: '', newPassword: '' });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
                }
              }}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900">পাসওয়ার্ড পরিবর্তন করুন</h3>
              <input
                type="password"
                placeholder="বর্তমান পাসওয়ার্ড"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
              <input
                type="password"
                placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                পাসওয়ার্ড পরিবর্তন করুন
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.addAdminUser(newAdminForm.username, newAdminForm.password);
                  toast.success('নতুন এডমিন যোগ করা হয়েছে');
                  setNewAdminForm({ username: '', password: '' });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
                }
              }}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900">নতুন এডমিন যোগ করুন</h3>
              <input
                type="text"
                placeholder="এডমিন ইউজারনেম"
                value={newAdminForm.username}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
              <input
                type="password"
                placeholder="এডমিন পাসওয়ার্ড"
                value={newAdminForm.password}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                এডমিন যোগ করুন
              </button>
            </form>
          </div>
        )}

        {/* SITE SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">লোগো আপলোড করুন</h3>
              <p className="text-sm text-slate-600 mb-4">
                হেডারে প্রদর্শিত হবে এমন একটি লোগো ইমেজ আপলোড করুন।
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {settings.logoUrl && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-1.5">বর্তমান লোগো:</p>
                  <img
                    src={settings.logoUrl}
                    alt="বর্তমান লোগো"
                    className="w-16 h-16 object-cover rounded-xl border border-slate-200"
                  />
                </div>
              )}
            </div>

            <form
              onSubmit={handleSaveAppLink}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900">অ্যান্ড্রয়েড অ্যাপ ডাউনলোড লিংক</h3>
              <p className="text-sm text-slate-600">
                লিংক যোগ করলে হেডারে &quot;ডাউনলোড অ্যাপ&quot; বোতাম প্রদর্শিত হবে।
              </p>
              <input
                type="url"
                placeholder="https://example.com/chirakumar-app.apk"
                value={appLinkInput}
                onChange={(e) => setAppLinkInput(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                সংরক্ষণ করুন
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
