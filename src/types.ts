export interface Member {
  id: number;
  memberNumber: string;
  name: string;
  age: number;
  profession: string;
  area: string;
  education?: string | null;
  phone?: string | null;
  email?: string | null;
  hobbies?: string | null;
  about?: string | null;
  photoUrl?: string | null;
  photoVisibility: 'show' | 'hide';
  joinDate: string;
}

export interface CommitteeMember {
  id: number;
  committeeId: number;
  memberId?: number | null;
  memberName: string;
  memberNumber?: string | null;
  position: string;
  photoUrl?: string | null;
}

export interface Committee {
  id: number;
  name: string;
  description?: string | null;
  previousCommitteeId?: number | null;
  createdAt: string;
  committeeMembers: CommitteeMember[];
}

export interface ClubEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string | null;
  createdAt: string;
}

export interface Notice {
  id: number;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
  createdAt: string;
}

export interface ClubNotification {
  id: number;
  title: string;
  message: string;
  type: 'announcement' | 'alert' | 'info';
  isRead: boolean;
  createdAt: string;
}

export interface DonationRecord {
  id: number;
  donorName: string;
  method: 'বিকাশ' | 'নগদ' | 'রকেট';
  amount: number;
  transactionId: string;
  phone?: string | null;
  note?: string | null;
  status: 'pending' | 'verified';
  createdAt: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

export interface SiteSettings {
  logoUrl?: string | null;
  appDownloadLink?: string | null;
}
