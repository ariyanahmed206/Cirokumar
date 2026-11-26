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

const TOKEN_KEY = 'chirakumar_admin_token';
const USERNAME_KEY = 'chirakumar_admin_username';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdminUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setAdminAuth(token: string, username: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearAdminAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'সার্ভারে সমস্যা হয়েছে');
  }
  return data as T;
}

export const api = {
  getSettings: () => request<SiteSettings>('/api/settings'),
  updateSettings: (payload: Partial<SiteSettings>) =>
    request<SiteSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  uploadImage: (dataUrl: string, filename: string) =>
    request<{ url: string }>('/api/upload', { method: 'POST', body: JSON.stringify({ dataUrl, filename }) }),

  getMembers: () => request<Member[]>('/api/members'),
  getMember: (id: number) => request<Member>(`/api/members/${id}`),
  createMember: (payload: Omit<Member, 'id' | 'memberNumber' | 'joinDate'> & { memberNumber?: string }) =>
    request<Member>('/api/members', { method: 'POST', body: JSON.stringify(payload) }),
  updateMember: (id: number, payload: Partial<Member>) =>
    request<Member>(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteMember: (id: number) => request<{ ok: true }>(`/api/members/${id}`, { method: 'DELETE' }),

  getCommittees: () => request<Committee[]>('/api/committees'),
  getCommittee: (id: number) => request<Committee>(`/api/committees/${id}`),
  createCommittee: (payload: { name: string; description?: string | null }) =>
    request<Committee>('/api/committees', { method: 'POST', body: JSON.stringify(payload) }),
  deleteCommittee: (id: number) => request<{ ok: true }>(`/api/committees/${id}`, { method: 'DELETE' }),

  addCommitteeMember: (payload: {
    committeeId: number;
    memberId?: number | null;
    memberName?: string;
    position: string;
  }) =>
    request<CommitteeMember>('/api/committee-members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCommitteeMember: (id: number, position: string) =>
    request<CommitteeMember>(`/api/committee-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ position }),
    }),
  deleteCommitteeMember: (id: number) =>
    request<{ ok: true }>(`/api/committee-members/${id}`, { method: 'DELETE' }),

  getEvents: () => request<ClubEvent[]>('/api/events'),
  createEvent: (payload: Omit<ClubEvent, 'id' | 'createdAt'>) =>
    request<ClubEvent>('/api/events', { method: 'POST', body: JSON.stringify(payload) }),
  deleteEvent: (id: number) => request<{ ok: true }>(`/api/events/${id}`, { method: 'DELETE' }),

  getNotices: () => request<Notice[]>('/api/notices'),
  createNotice: (payload: Omit<Notice, 'id' | 'createdAt' | 'documentUrl' | 'documentName'>) =>
    request<Notice>('/api/notices', { method: 'POST', body: JSON.stringify(payload) }),
  deleteNotice: (id: number) => request<{ ok: true }>(`/api/notices/${id}`, { method: 'DELETE' }),

  getNotifications: () => request<ClubNotification[]>('/api/notifications'),
  createNotification: (payload: { title: string; message: string; type: 'announcement' | 'alert' | 'info' }) =>
    request<ClubNotification>('/api/notifications', { method: 'POST', body: JSON.stringify(payload) }),
  markNotificationRead: (id: number) =>
    request<ClubNotification>(`/api/notifications/${id}/read`, { method: 'POST' }),
  deleteNotification: (id: number) => request<{ ok: true }>(`/api/notifications/${id}`, { method: 'DELETE' }),

  getDonations: () => request<DonationRecord[]>('/api/donations'),
  submitDonation: (payload: {
    donorName: string;
    method: 'বিকাশ' | 'নগদ' | 'রকেট';
    amount: number;
    transactionId: string;
    phone?: string;
    note?: string;
  }) => request<DonationRecord>('/api/donations', { method: 'POST', body: JSON.stringify(payload) }),
  updateDonationStatus: (id: number, status: 'pending' | 'verified') =>
    request<DonationRecord>(`/api/donations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteDonation: (id: number) => request<{ ok: true }>(`/api/donations/${id}`, { method: 'DELETE' }),

  getMessages: () => request<ContactMessage[]>('/api/messages'),
  submitMessage: (payload: { name: string; email: string; message: string }) =>
    request<ContactMessage>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMessage: (id: number) => request<{ ok: true }>(`/api/messages/${id}`, { method: 'DELETE' }),

  adminLogin: (username: string, password: string) =>
    request<{ token: string; username: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  checkAdminSession: () => request<{ authenticated: boolean; username?: string }>('/api/admin/session'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  addAdminUser: (username: string, password: string) =>
    request<{ id: number; username: string }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};
