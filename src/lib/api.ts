import {
  SEED_COMMITTEES,
  SEED_EVENTS,
  SEED_MEMBERS,
  SEED_NOTICES,
  SEED_NOTIFICATIONS,
  SEED_SETTINGS,
} from '../data/seedData';
import type {
  ClubEvent,
  ClubNotification,
  Committee,
  CommitteeMember,
  ContactMessage,
  DonationRecord,
  Member,
  Notice,
  SiteSettings,
} from '../types';

const READ_NOTIFS_KEY = 'chirakumar_read_notifications';

// Admin session is held strictly in JS memory (never localStorage/sessionStorage)
let adminTokenInMemory: string | null = null;
let adminUsernameInMemory: string | null = null;

export function getAdminToken(): string | null {
  return adminTokenInMemory;
}

export function getAdminUsername(): string | null {
  return adminUsernameInMemory;
}

export function clearAdminAuth() {
  adminTokenInMemory = null;
  adminUsernameInMemory = null;
}

function setAdminAuth(token: string, username: string) {
  adminTokenInMemory = token;
  adminUsernameInMemory = username;
}

function getLocalReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(READ_NOTIFS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(Number)) : new Set();
  } catch {
    return new Set();
  }
}

function addLocalReadId(id: number) {
  try {
    const set = getLocalReadIds();
    set.add(id);
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...set]));
  } catch {
    // ignore storage quota errors
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (adminTokenInMemory && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${adminTokenInMemory}`);
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'সার্ভারের সাথে যোগাযোগ করতে সমস্যা হয়েছে';
    if (res.status === 401 && url !== '/api/admin/login') {
      clearAdminAuth();
    }
    throw new Error(errMsg);
  }

  return data as T;
}

async function compressImageDataUrl(dataUrl: string): Promise<string> {
  if (typeof window === 'undefined') return dataUrl.slice(0, 250000);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 380;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl.slice(0, 240000));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const out = canvas.toDataURL('image/jpeg', 0.78);
      if (out.length > 245000) {
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      } else {
        resolve(out);
      }
    };
    img.onerror = () => reject(new Error('ছবি প্রক্রিয়াকরণে সমস্যা হয়েছে'));
    img.src = dataUrl;
  });
}

export const api = {
  getSettings: async (): Promise<SiteSettings> => {
    try {
      return await requestJson<SiteSettings>('/api/settings');
    } catch {
      return { ...SEED_SETTINGS };
    }
  },

  updateSettings: async (payload: Partial<SiteSettings>): Promise<SiteSettings> => {
    return requestJson<SiteSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  uploadImage: async (dataUrl: string, filename: string): Promise<{ url: string }> => {
    const compressed = await compressImageDataUrl(dataUrl);
    return requestJson<{ url: string }>('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ dataUrl: compressed, filename }),
    });
  },

  getMembers: async (includePrivateForAdmin = false): Promise<Member[]> => {
    try {
      const qs = includePrivateForAdmin && adminTokenInMemory ? '?includePrivate=1' : '';
      return await requestJson<Member[]>(`/api/members${qs}`);
    } catch {
      if (includePrivateForAdmin) throw new Error('সদস্য তালিকা লোড করতে সমস্যা হয়েছে');
      return [...SEED_MEMBERS].sort((a, b) => Number(a.memberNumber) - Number(b.memberNumber));
    }
  },

  getMember: async (id: number): Promise<Member> => {
    try {
      return await requestJson<Member>(`/api/members/${id}`);
    } catch (error) {
      if (error instanceof Error && error.message === 'সদস্য পাওয়া যায়নি') throw error;
      const seeded = SEED_MEMBERS.find((m) => m.id === id);
      if (seeded) return { ...seeded, phone: null, email: null };
      throw new Error('সদস্য পাওয়া যায়নি');
    }
  },

  createMember: async (
    payload: Omit<Member, 'id' | 'memberNumber' | 'joinDate'> & { memberNumber?: string }
  ): Promise<Member> => {
    return requestJson<Member>('/api/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMember: async (id: number, payload: Partial<Member>): Promise<Member> => {
    return requestJson<Member>(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteMember: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/members/${id}`, { method: 'DELETE' });
  },

  getCommittees: async (): Promise<Committee[]> => {
    try {
      return await requestJson<Committee[]>('/api/committees');
    } catch {
      return SEED_COMMITTEES;
    }
  },

  getCommittee: async (id: number): Promise<Committee> => {
    try {
      return await requestJson<Committee>(`/api/committees/${id}`);
    } catch (error) {
      if (error instanceof Error && error.message === 'কমিটি পাওয়া যায়নি') throw error;
      const seeded = SEED_COMMITTEES.find((c) => c.id === id);
      if (seeded) return seeded;
      throw new Error('কমিটি পাওয়া যায়নি');
    }
  },

  createCommittee: async (payload: { name: string; description?: string | null }): Promise<Committee> => {
    return requestJson<Committee>('/api/committees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteCommittee: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/committees/${id}`, { method: 'DELETE' });
  },

  addCommitteeMember: async (payload: {
    committeeId: number;
    memberId?: number | null;
    memberName?: string;
    position: string;
  }): Promise<CommitteeMember> => {
    return requestJson<CommitteeMember>('/api/committee-members', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCommitteeMember: async (
    id: number,
    position: string
  ): Promise<CommitteeMember> => {
    return requestJson<CommitteeMember>(`/api/committee-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ position }),
    });
  },

  deleteCommitteeMember: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/committee-members/${id}`, { method: 'DELETE' });
  },

  getEvents: async (): Promise<ClubEvent[]> => {
    try {
      return await requestJson<ClubEvent[]>('/api/events');
    } catch {
      return SEED_EVENTS;
    }
  },

  createEvent: async (payload: Omit<ClubEvent, 'id' | 'createdAt'>): Promise<ClubEvent> => {
    return requestJson<ClubEvent>('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteEvent: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/events/${id}`, { method: 'DELETE' });
  },

  getNotices: async (): Promise<Notice[]> => {
    try {
      return await requestJson<Notice[]>('/api/notices');
    } catch {
      return SEED_NOTICES;
    }
  },

  createNotice: async (
    payload: Omit<Notice, 'id' | 'createdAt' | 'documentUrl' | 'documentName'>
  ): Promise<Notice> => {
    return requestJson<Notice>('/api/notices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteNotice: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/notices/${id}`, { method: 'DELETE' });
  },

  getNotifications: async (): Promise<ClubNotification[]> => {
    const readSet = getLocalReadIds();
    try {
      const list = await requestJson<ClubNotification[]>('/api/notifications');
      return list.map((n) => ({ ...n, isRead: Boolean(n.isRead) || readSet.has(n.id) }));
    } catch {
      return SEED_NOTIFICATIONS.map((n) => ({
        ...n,
        isRead: n.isRead || readSet.has(n.id),
      }));
    }
  },

  createNotification: async (payload: {
    title: string;
    message: string;
    type: 'announcement' | 'alert' | 'info';
  }): Promise<ClubNotification> => {
    return requestJson<ClubNotification>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  markNotificationRead: async (id: number): Promise<void> => {
    addLocalReadId(id);
    try {
      await requestJson(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // keep local read state if offline
    }
  },

  deleteNotification: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/notifications/${id}`, { method: 'DELETE' });
  },

  getDonations: async (): Promise<DonationRecord[]> => {
    return requestJson<DonationRecord[]>('/api/donations');
  },

  submitDonation: async (payload: {
    donorName: string;
    method: 'বিকাশ' | 'নগদ' | 'রকেট';
    amount: number;
    transactionId: string;
    phone?: string;
    note?: string;
  }): Promise<DonationRecord> => {
    return requestJson<DonationRecord>('/api/donations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateDonationStatus: async (id: number, status: 'pending' | 'verified'): Promise<void> => {
    await requestJson(`/api/donations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteDonation: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/donations/${id}`, { method: 'DELETE' });
  },

  getMessages: async (): Promise<ContactMessage[]> => {
    return requestJson<ContactMessage[]>('/api/messages');
  },

  submitMessage: async (payload: {
    name: string;
    email: string;
    message: string;
  }): Promise<ContactMessage> => {
    return requestJson<ContactMessage>('/api/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteMessage: async (id: number): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(`/api/messages/${id}`, { method: 'DELETE' });
  },

  loginAdmin: async (username: string, password: string): Promise<{ token: string; username: string }> => {
    const res = await requestJson<{ token: string; username: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAdminAuth(res.token, res.username);
    return res;
  },

  signOutAdmin: async (): Promise<void> => {
    try {
      if (adminTokenInMemory) {
        await requestJson('/api/admin/logout', { method: 'POST' });
      }
    } catch {
      // ignore network error during logout
    } finally {
      clearAdminAuth();
    }
  },

  checkAdminSession: async (): Promise<{ authenticated: boolean; username?: string }> => {
    if (!adminTokenInMemory) {
      throw new Error('লগইন করা নেই');
    }
    const sess = await requestJson<{ authenticated: boolean; username?: string }>(
      '/api/admin/session'
    );
    if (sess.username) {
      adminUsernameInMemory = sess.username;
    }
    return sess;
  },

  changeAdminPassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await requestJson('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  listAdmins: async (): Promise<Array<{ id: number; username: string; createdAt: string }>> => {
    return requestJson('/api/admin/users');
  },

  createAdminUser: async (
    username: string,
    password: string
  ): Promise<{ id: number; username: string }> => {
    return requestJson('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
};
