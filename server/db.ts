import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
} from '../src/types.ts';

export interface AdminUser {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface DatabaseSchema {
  nextId: number;
  members: Member[];
  committees: Committee[];
  events: ClubEvent[];
  notices: Notice[];
  notifications: ClubNotification[];
  donations: DonationRecord[];
  messages: ContactMessage[];
  settings: SiteSettings;
  admins: AdminUser[];
}

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_SERVERLESS
  ? path.join('/tmp', 'chirakumar-data')
  : path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function resolveCsvPath(filename: string): string {
  const candidates = [
    path.resolve(process.cwd(), 'public/assets/aistudio', filename),
    path.resolve(process.cwd(), 'dist/assets/aistudio', filename),
    path.resolve(import.meta.dirname || process.cwd(), '../public/assets/aistudio', filename),
    path.resolve(import.meta.dirname || process.cwd(), '../dist/assets/aistudio', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const SEED_CSV_PATH = resolveCsvPath('members_20261126_063435_31f3cddf.csv');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const candidate = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHash, 'hex');
  if (candidate.length !== original.length) return false;
  return crypto.timingSafeEqual(candidate, original);
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizePhone(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^1[3-9]\d{8}$/.test(s)) return `0${s}`;
  return s;
}

function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (!s) return new Date().toISOString();
  const parsed = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function loadMembersFromCsv(): Member[] {
  if (!fs.existsSync(SEED_CSV_PATH)) return [];
  const raw = fs.readFileSync(SEED_CSV_PATH, 'utf8');
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  const members: Member[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length < 5) continue;
    const id = Number(cols[idx('id')]) || r;
    const memberNumber = (cols[idx('memberNumber')] || String(id)).trim();
    const name = (cols[idx('name')] || '').trim();
    if (!name) continue;
    const age = Number(cols[idx('age')]) || 20;
    const profession = (cols[idx('profession')] || 'শিক্ষার্থী').trim();
    const area = (cols[idx('area')] || 'বাংলাদেশ').trim();
    const education = (cols[idx('education')] || '').trim() || null;
    const phone = normalizePhone(cols[idx('phone')] || '');
    const email = (cols[idx('email')] || '').trim() || null;
    const hobbies = (cols[idx('hobbies')] || '').trim() || null;
    const about = (cols[idx('about')] || '').trim() || null;
    const photoUrl = (cols[idx('photoUrl')] || '').trim() || null;
    const joinDate = normalizeDate(cols[idx('joinDate')] || '');
    const visRaw = (cols[idx('photoVisibility')] || 'show').trim().toLowerCase();
    const photoVisibility = visRaw === 'hide' ? 'hide' : 'show';

    members.push({
      id,
      memberNumber,
      name,
      age,
      profession,
      area,
      education,
      phone,
      email,
      hobbies,
      about,
      photoUrl,
      photoVisibility,
      joinDate,
    });
  }
  return members;
}

const COMMITTEES_CSV_PATH = resolveCsvPath('committees_20261126_065250_84e9fe2c.csv');

const COMMITTEE_MEMBERS_CSV_PATH = resolveCsvPath('committeeMembers_20261126_065221_3f2544ec.csv');

function loadCommitteeMembersFromCsv(
  initialMembers: Member[]
): Record<number, CommitteeMember[]> {
  const byCommittee: Record<number, CommitteeMember[]> = {};
  if (!fs.existsSync(COMMITTEE_MEMBERS_CSV_PATH)) return byCommittee;

  const raw = fs.readFileSync(COMMITTEE_MEMBERS_CSV_PATH, 'utf8');
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return byCommittee;

  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const memberById = new Map<number, Member>(initialMembers.map((m) => [m.id, m]));

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length < 5) continue;

    const id = Number(cols[idx('id')]) || r;
    const committeeId = Number(cols[idx('committeeId')]);
    if (!committeeId) continue;

    const rawMemberId = Number(cols[idx('memberId')]);
    const matched = rawMemberId ? memberById.get(rawMemberId) : undefined;
    const position = (cols[idx('position')] || '').trim() || 'সদস্য';
    const csvPhotoUrl = (cols[idx('photoUrl')] || '').trim() || null;
    const csvName = (cols[idx('name')] || '').trim();

    const entry: CommitteeMember = {
      id,
      committeeId,
      memberId: matched ? matched.id : rawMemberId || null,
      memberName: csvName || (matched ? matched.name : ''),
      memberNumber: matched ? matched.memberNumber : rawMemberId ? String(rawMemberId) : null,
      position,
      photoUrl:
        matched && matched.photoVisibility === 'hide'
          ? null
          : csvPhotoUrl || matched?.photoUrl || null,
    };

    if (!byCommittee[committeeId]) {
      byCommittee[committeeId] = [];
    }
    byCommittee[committeeId].push(entry);
  }

  return byCommittee;
}

function createInitialData(): DatabaseSchema {
  const initialMembers = loadMembersFromCsv();
  const committeeMembersByCommittee = loadCommitteeMembersFromCsv(initialMembers);

  let initialCommittees: Committee[] = [];
  if (fs.existsSync(COMMITTEES_CSV_PATH)) {
    const raw = fs.readFileSync(COMMITTEES_CSV_PATH, 'utf8');
    const rows = parseCsvRows(raw);
    if (rows.length >= 2) {
      const header = rows[0].map((h) => h.trim());
      const idx = (name: string) => header.indexOf(name);
      for (let r = 1; r < rows.length; r++) {
        const cols = rows[r];
        const id = Number(cols[idx('id')]);
        const name = (cols[idx('name')] || '').trim();
        if (!id || !name) continue;
        const description = (cols[idx('description')] || '').trim() || null;
        const createdAt = normalizeDate(cols[idx('createdAt')] || '');
        const prevRaw = (cols[idx('previousCommitteeId')] || '').trim();
        const previousCommitteeId = prevRaw ? Number(prevRaw) || null : null;
        initialCommittees.push({
          id,
          name,
          description,
          previousCommitteeId,
          createdAt,
          committeeMembers: committeeMembersByCommittee[id] || [],
        });
      }
    }
  }

  if (initialCommittees.length === 0) {
    initialCommittees = [
      {
        id: 1,
        name: 'আদর্শ নেতা',
        description: null,
        previousCommitteeId: null,
        createdAt: '2026-02-08T03:35:11.000Z',
        committeeMembers: committeeMembersByCommittee[1] || [],
      },
      {
        id: 2,
        name: 'উপদেষ্টা',
        description: null,
        previousCommitteeId: null,
        createdAt: '2026-02-08T03:35:20.000Z',
        committeeMembers: committeeMembersByCommittee[2] || [],
      },
      {
        id: 3,
        name: 'কেন্দ্রীয় কমিটি',
        description: null,
        previousCommitteeId: null,
        createdAt: '2026-02-08T03:35:26.000Z',
        committeeMembers: committeeMembersByCommittee[3] || [],
      },
    ];
  }

  const initialNotices: Notice[] = [
    {
      id: 401,
      title: 'সকল কমিটি ভেঙ্গে দেওয়ার বিষয়ে',
      description:
        'নতুন কেন্দ্রীয় কমিটির সদস্যদের মতামতের ভিত্তিতে পূর্ববর্তী সকল আঞ্চলিক কমিটি ভেঙ্গে দেওয়া হলো। খুব দ্রুত বিভাগীয় ও অন্যান্য শাখা কমিটি ঘোষণা করা হবে।',
      date: '2026-02-18',
      time: '19:00',
      location: 'কেন্দ্রীয় কার্যালয় (অনলাইন)',
      documentUrl: null,
      documentName: null,
      createdAt: '2026-02-18T13:10:13.000Z',
    },
    {
      id: 402,
      title: 'নতুন সদস্য নিবন্ধন ও বায়োডাটা আপডেট প্রসঙ্গে',
      description:
        'সকল আগ্রহী চিরকুমার ভাইদের বায়োডাটা ফর্মের মাধ্যমে সঠিক তথ্য দিয়ে নিবন্ধন সম্পন্ন করার জন্য অনুরোধ করা যাচ্ছে।',
      date: '2026-02-10',
      time: '18:00',
      location: 'সারাদেশ',
      documentUrl: null,
      documentName: null,
      createdAt: '2026-02-10T12:00:00.000Z',
    },
  ];

  const initialEvents: ClubEvent[] = [
    {
      id: 501,
      title: 'বার্ষিক চিরকুমার মিলনমেলা ও সাধারণ সভা ২০২৬',
      date: '2026-12-15',
      time: 'বিকাল ৪:০০ টা',
      location: 'টিএসসি চত্বর, ঢাকা বিশ্ববিদ্যালয়',
      description:
        'সকল কেন্দ্রীয় ও বিভাগীয় সদস্যদের উপস্থিতিতে বার্ষিক সাধারণ সভা, আড্ডা এবং আগামী বছরের কর্মপরিকল্পনা নির্ধারণ।',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ];

  const initialNotifications: ClubNotification[] = [
    {
      id: 601,
      title: 'নতুন কেন্দ্রীয় কমিটি ঘোষণা',
      message:
        'চিরকুমার সংঘ বাংলাদেশ এর ২০২৬-২৭ সেশনের নতুন কেন্দ্রীয় কমিটি অনুমোদিত হয়েছে। কমিটি পাতায় বিস্তারিত দেখুন।',
      type: 'announcement',
      isRead: false,
      createdAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 602,
      title: 'বায়োডাটা যাচাইকরণ বিজ্ঞপ্তি',
      message:
        'সদস্য প্রোফাইলে ছবি ও এলাকা সংক্রান্ত তথ্য সঠিকভাবে সংযুক্ত করার জন্য সদস্যদের অনুরোধ করা হচ্ছে।',
      type: 'info',
      isRead: false,
      createdAt: '2026-11-18T14:30:00.000Z',
    },
    {
      id: 603,
      title: 'সংগঠনের শৃঙ্খলা রক্ষা সংক্রান্ত সতর্কতা',
      message:
        'সংগঠনের মূলনীতি অনুযায়ী সকল সদস্যকে শৃঙ্খলা ও ভ্রাতৃত্ববোধ বজায় রাখার জন্য বিশেষভাবে জানানো যাচ্ছে।',
      type: 'alert',
      isRead: true,
      createdAt: '2026-11-10T11:00:00.000Z',
    },
  ];

  const initialAdmins: AdminUser[] = [
    {
      id: 1,
      username: 'Nazmul',
      passwordHash: hashPassword('chirakumar2025'),
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  const maxMemberId = initialMembers.reduce((max, m) => Math.max(max, m.id), 0);

  return {
    nextId: Math.max(1000, maxMemberId + 100),
    members: initialMembers,
    committees: initialCommittees,
    events: initialEvents,
    notices: initialNotices,
    notifications: initialNotifications,
    donations: [],
    messages: [],
    settings: {
      logoUrl: '/src/assets/images/chirakumar_emblem_1795673549264.jpg',
      appDownloadLink: null,
    },
    admins: initialAdmins,
  };
}

export function ensureDataDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function readDb(): DatabaseSchema {
  ensureDataDirs();
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialData();
    writeDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    const fallback = createInitialData();
    writeDb(fallback);
    return fallback;
  }
}

export function writeDb(data: DatabaseSchema) {
  ensureDataDirs();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}
