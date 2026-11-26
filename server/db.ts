import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import {
  SEED_COMMITTEES,
  SEED_EVENTS,
  SEED_MEMBERS,
  SEED_NOTICES,
  SEED_NOTIFICATIONS,
  SEED_SETTINGS,
} from '../src/data/seedData.ts';
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

export interface AdminSessionRecord {
  tokenHash: string;
  adminId: number;
  username: string;
  expiresAt: string;
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
  sessions?: AdminSessionRecord[];
}

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_SERVERLESS
  ? path.join('/tmp', 'chirakumar-data')
  : path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  return url.trim() || null;
}

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

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createInitialData(): DatabaseSchema {
  const initialMembers: Member[] = SEED_MEMBERS.map((m) => ({ ...m }));
  const initialCommittees: Committee[] = SEED_COMMITTEES.map((c) => ({
    ...c,
    committeeMembers: c.committeeMembers.map((cm) => ({ ...cm })),
  }));
  const initialEvents: ClubEvent[] = SEED_EVENTS.map((e) => ({ ...e }));
  const initialNotices: Notice[] = SEED_NOTICES.map((n) => ({ ...n }));
  const initialNotifications: ClubNotification[] = SEED_NOTIFICATIONS.map((n) => ({ ...n }));

  const maxMemberId = initialMembers.reduce((max, m) => Math.max(max, m.id), 0);
  const maxCommitteeId = initialCommittees.reduce((max, c) => Math.max(max, c.id), 0);
  const maxCmId = initialCommittees.reduce(
    (max, c) => c.committeeMembers.reduce((m2, cm) => Math.max(m2, cm.id), max),
    0
  );

  return {
    nextId: Math.max(1000, maxMemberId + 100, maxCommitteeId + 100, maxCmId + 100),
    members: initialMembers,
    committees: initialCommittees,
    events: initialEvents,
    notices: initialNotices,
    notifications: initialNotifications,
    donations: [],
    messages: [],
    settings: {
      logoUrl: SEED_SETTINGS.logoUrl ?? '/src/assets/images/chirakumar_emblem_1795673549264.jpg',
      appDownloadLink: SEED_SETTINGS.appDownloadLink ?? null,
    },
    admins: [
      {
        id: 1,
        username: 'Nazmul',
        passwordHash: hashPassword('chirakumar2025'),
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ],
    sessions: [],
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readLocalDb(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialData();
    writeLocalDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    if (!parsed.sessions) parsed.sessions = [];
    if (!parsed.admins || parsed.admins.length === 0) {
      parsed.admins = [
        {
          id: 1,
          username: 'Nazmul',
          passwordHash: hashPassword('chirakumar2025'),
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];
    }
    return parsed;
  } catch {
    const fallback = createInitialData();
    writeLocalDb(fallback);
    return fallback;
  }
}

function writeLocalDb(data: DatabaseSchema) {
  ensureDataDir();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

type SqlExecutor = ReturnType<typeof neon>;
let cachedSql: { url: string; client: SqlExecutor } | null = null;
let initPromise: Promise<void> | null = null;

function getSql(): SqlExecutor | null {
  const url = getDatabaseUrl();
  if (!url) return null;
  if (!cachedSql || cachedSql.url !== url) {
    cachedSql = { url, client: neon(url) };
    initPromise = null;
  }
  return cachedSql.client;
}

async function ensurePostgresReady(): Promise<SqlExecutor | null> {
  const sql = getSql();
  if (!sql) return null;

  if (!initPromise) {
    initPromise = (async () => {
      await sql.query(`
        CREATE TABLE IF NOT EXISTS meta_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY,
          logo_url TEXT,
          app_download_link TEXT
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS members (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          member_number TEXT NOT NULL,
          name TEXT NOT NULL,
          age INTEGER NOT NULL,
          profession TEXT NOT NULL,
          area TEXT NOT NULL,
          education TEXT,
          phone TEXT,
          email TEXT,
          hobbies TEXT,
          about TEXT,
          photo_url TEXT,
          photo_visibility TEXT NOT NULL DEFAULT 'show',
          join_date TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS committees (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          previous_committee_id INTEGER,
          created_at TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS committee_members (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
          member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
          member_name TEXT NOT NULL,
          member_number TEXT,
          position TEXT NOT NULL,
          photo_url TEXT
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          location TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS notices (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT,
          location TEXT,
          description TEXT,
          document_url TEXT,
          document_name TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS donations (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          donor_name TEXT NOT NULL,
          method TEXT NOT NULL,
          amount INTEGER NOT NULL,
          transaction_id TEXT NOT NULL,
          phone TEXT,
          note TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      await sql.query(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
          token_hash TEXT PRIMARY KEY,
          admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
          username TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);

      const seedCheck = (await sql.query(
        `SELECT value FROM meta_state WHERE key = 'seeded'`
      )) as Array<{ value: string }>;

      if (seedCheck.length === 0) {
        if (SEED_MEMBERS.length > 0) {
          await sql.query(
            `INSERT INTO members (
               id, member_number, name, age, profession, area,
               education, phone, email, hobbies, about, photo_url, photo_visibility, join_date
             )
             SELECT * FROM UNNEST(
               $1::int[], $2::text[], $3::text[], $4::int[], $5::text[], $6::text[],
               $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[]
             )
             ON CONFLICT (id) DO NOTHING`,
            [
              SEED_MEMBERS.map((m) => m.id),
              SEED_MEMBERS.map((m) => m.memberNumber),
              SEED_MEMBERS.map((m) => m.name),
              SEED_MEMBERS.map((m) => m.age),
              SEED_MEMBERS.map((m) => m.profession),
              SEED_MEMBERS.map((m) => m.area),
              SEED_MEMBERS.map((m) => m.education ?? null),
              SEED_MEMBERS.map((m) => m.phone ?? null),
              SEED_MEMBERS.map((m) => m.email ?? null),
              SEED_MEMBERS.map((m) => m.hobbies ?? null),
              SEED_MEMBERS.map((m) => m.about ?? null),
              SEED_MEMBERS.map((m) => m.photoUrl ?? null),
              SEED_MEMBERS.map((m) => m.photoVisibility),
              SEED_MEMBERS.map((m) => m.joinDate),
            ]
          );
        }

        if (SEED_COMMITTEES.length > 0) {
          await sql.query(
            `INSERT INTO committees (id, name, description, previous_committee_id, created_at)
             SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::int[], $5::text[])
             ON CONFLICT (id) DO NOTHING`,
            [
              SEED_COMMITTEES.map((c) => c.id),
              SEED_COMMITTEES.map((c) => c.name),
              SEED_COMMITTEES.map((c) => c.description ?? null),
              SEED_COMMITTEES.map((c) => c.previousCommitteeId ?? null),
              SEED_COMMITTEES.map((c) => c.createdAt),
            ]
          );

          const allCm = SEED_COMMITTEES.flatMap((c) => c.committeeMembers);
          if (allCm.length > 0) {
            await sql.query(
              `INSERT INTO committee_members (
                 id, committee_id, member_id, member_name, member_number, position, photo_url
               )
               SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[])
               ON CONFLICT (id) DO NOTHING`,
              [
                allCm.map((cm) => cm.id),
                allCm.map((cm) => cm.committeeId),
                allCm.map((cm) => cm.memberId ?? null),
                allCm.map((cm) => cm.memberName),
                allCm.map((cm) => cm.memberNumber ?? null),
                allCm.map((cm) => cm.position),
                allCm.map((cm) => cm.photoUrl ?? null),
              ]
            );
          }
        }

        if (SEED_EVENTS.length > 0) {
          await sql.query(
            `INSERT INTO events (id, title, date, time, location, description, created_at)
             SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
             ON CONFLICT (id) DO NOTHING`,
            [
              SEED_EVENTS.map((e) => e.id),
              SEED_EVENTS.map((e) => e.title),
              SEED_EVENTS.map((e) => e.date),
              SEED_EVENTS.map((e) => e.time),
              SEED_EVENTS.map((e) => e.location),
              SEED_EVENTS.map((e) => e.description ?? null),
              SEED_EVENTS.map((e) => e.createdAt),
            ]
          );
        }

        if (SEED_NOTICES.length > 0) {
          await sql.query(
            `INSERT INTO notices (id, title, date, time, location, description, document_url, document_name, created_at)
             SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[])
             ON CONFLICT (id) DO NOTHING`,
            [
              SEED_NOTICES.map((n) => n.id),
              SEED_NOTICES.map((n) => n.title),
              SEED_NOTICES.map((n) => n.date),
              SEED_NOTICES.map((n) => n.time ?? null),
              SEED_NOTICES.map((n) => n.location ?? null),
              SEED_NOTICES.map((n) => n.description ?? null),
              SEED_NOTICES.map((n) => n.documentUrl ?? null),
              SEED_NOTICES.map((n) => n.documentName ?? null),
              SEED_NOTICES.map((n) => n.createdAt),
            ]
          );
        }

        if (SEED_NOTIFICATIONS.length > 0) {
          await sql.query(
            `INSERT INTO notifications (id, title, message, type, is_read, created_at)
             SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::boolean[], $6::text[])
             ON CONFLICT (id) DO NOTHING`,
            [
              SEED_NOTIFICATIONS.map((n) => n.id),
              SEED_NOTIFICATIONS.map((n) => n.title),
              SEED_NOTIFICATIONS.map((n) => n.message),
              SEED_NOTIFICATIONS.map((n) => n.type),
              SEED_NOTIFICATIONS.map((n) => Boolean(n.isRead)),
              SEED_NOTIFICATIONS.map((n) => n.createdAt),
            ]
          );
        }

        await sql.query(
          `INSERT INTO settings (id, logo_url, app_download_link)
           VALUES (1, $1, $2)
           ON CONFLICT (id) DO NOTHING`,
          [
            SEED_SETTINGS.logoUrl ?? '/src/assets/images/chirakumar_emblem_1795673549264.jpg',
            SEED_SETTINGS.appDownloadLink ?? null,
          ]
        );

        await sql.query(
          `INSERT INTO admins (username, password_hash, created_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (username) DO NOTHING`,
          ['Nazmul', hashPassword('chirakumar2025'), '2025-01-01T00:00:00.000Z']
        );

        for (const table of [
          'members',
          'committees',
          'committee_members',
          'events',
          'notices',
          'notifications',
          'donations',
          'messages',
          'admins',
        ]) {
          await sql.query(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`
          );
        }

        await sql.query(
          `INSERT INTO meta_state (key, value) VALUES ('seeded', '1') ON CONFLICT (key) DO NOTHING`
        );
      }
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
  return sql;
}

function mapMemberRow(r: Record<string, unknown>, includePrivate: boolean): Member {
  return {
    id: Number(r.id),
    memberNumber: String(r.member_number),
    name: String(r.name),
    age: Number(r.age),
    profession: String(r.profession),
    area: String(r.area),
    education: (r.education as string | null) ?? null,
    phone: includePrivate ? ((r.phone as string | null) ?? null) : null,
    email: includePrivate ? ((r.email as string | null) ?? null) : null,
    hobbies: (r.hobbies as string | null) ?? null,
    about: (r.about as string | null) ?? null,
    photoUrl: (r.photo_url as string | null) ?? null,
    photoVisibility: r.photo_visibility === 'hide' ? 'hide' : 'show',
    joinDate: String(r.join_date),
  };
}

function hydrateCommitteeMember(
  cm: CommitteeMember,
  memberById: Map<number, Member>
): CommitteeMember {
  const matched = cm.memberId ? memberById.get(cm.memberId) : undefined;
  return {
    ...cm,
    memberName: matched ? matched.name : cm.memberName,
    memberNumber: matched ? matched.memberNumber : cm.memberNumber ?? null,
    photoUrl:
      matched && matched.photoVisibility === 'hide'
        ? null
        : cm.photoUrl || matched?.photoUrl || null,
  };
}

export const store = {
  async isPostgresActive(): Promise<boolean> {
    return Boolean(getDatabaseUrl());
  },

  async getSettings(): Promise<SiteSettings> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      return readLocalDb().settings;
    }
    const rows = (await sql.query(
      `SELECT logo_url, app_download_link FROM settings WHERE id = 1`
    )) as Array<{ logo_url: string | null; app_download_link: string | null }>;
    if (rows.length === 0) {
      return {
        logoUrl: SEED_SETTINGS.logoUrl ?? null,
        appDownloadLink: null,
      };
    }
    return {
      logoUrl: rows[0].logo_url,
      appDownloadLink: rows[0].app_download_link,
    };
  },

  async updateSettings(payload: {
    logoUrl?: string | null;
    appDownloadLink?: string | null;
  }): Promise<SiteSettings> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      if (payload.logoUrl !== undefined) db.settings.logoUrl = payload.logoUrl;
      if (payload.appDownloadLink !== undefined) {
        db.settings.appDownloadLink = payload.appDownloadLink;
      }
      writeLocalDb(db);
      return db.settings;
    }
    const current = await store.getSettings();
    const nextLogo = payload.logoUrl !== undefined ? payload.logoUrl : current.logoUrl ?? null;
    const nextLink =
      payload.appDownloadLink !== undefined
        ? payload.appDownloadLink
        : current.appDownloadLink ?? null;
    await sql.query(
      `INSERT INTO settings (id, logo_url, app_download_link)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET logo_url = EXCLUDED.logo_url, app_download_link = EXCLUDED.app_download_link`,
      [nextLogo, nextLink]
    );
    return { logoUrl: nextLogo, appDownloadLink: nextLink };
  },

  async getMembers(includePrivate: boolean): Promise<Member[]> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      return [...db.members]
        .map((m) => ({
          ...m,
          phone: includePrivate ? m.phone : null,
          email: includePrivate ? m.email : null,
        }))
        .sort((a, b) => Number(a.memberNumber) - Number(b.memberNumber));
    }
    const rows = (await sql.query(`SELECT * FROM members`)) as Array<Record<string, unknown>>;
    return rows
      .map((r) => mapMemberRow(r, includePrivate))
      .sort((a, b) => Number(a.memberNumber) - Number(b.memberNumber));
  },

  async getMember(id: number, includePrivate: boolean): Promise<Member | null> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const found = db.members.find((m) => m.id === id);
      if (!found) return null;
      return {
        ...found,
        phone: includePrivate ? found.phone : null,
        email: includePrivate ? found.email : null,
      };
    }
    const rows = (await sql.query(`SELECT * FROM members WHERE id = $1`, [id])) as Array<
      Record<string, unknown>
    >;
    return rows.length > 0 ? mapMemberRow(rows[0], includePrivate) : null;
  },

  async createMember(input: {
    memberNumber?: string;
    name: string;
    age: number;
    profession: string;
    area: string;
    education: string | null;
    phone: string | null;
    email: string | null;
    hobbies: string | null;
    about: string | null;
    photoUrl: string | null;
    photoVisibility: 'show' | 'hide';
  }): Promise<Member> {
    const joinDate = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const maxNumber = db.members.reduce(
        (max, m) => Math.max(max, Number(m.memberNumber) || 0),
        0
      );
      const id = ++db.nextId;
      const newMember: Member = {
        id,
        memberNumber: input.memberNumber || String(maxNumber + 1),
        name: input.name,
        age: input.age,
        profession: input.profession,
        area: input.area,
        education: input.education,
        phone: input.phone,
        email: input.email,
        hobbies: input.hobbies,
        about: input.about,
        photoUrl: input.photoUrl,
        photoVisibility: input.photoVisibility,
        joinDate,
      };
      db.members.push(newMember);
      writeLocalDb(db);
      return newMember;
    }

    let memberNumber = input.memberNumber;
    if (!memberNumber) {
      const numRows = (await sql.query(
        `SELECT member_number FROM members`
      )) as Array<{ member_number: string }>;
      const maxNumber = numRows.reduce(
        (max, r) => Math.max(max, Number(r.member_number) || 0),
        0
      );
      memberNumber = String(maxNumber + 1);
    }

    const rows = (await sql.query(
      `INSERT INTO members (
         member_number, name, age, profession, area, education,
         phone, email, hobbies, about, photo_url, photo_visibility, join_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        memberNumber,
        input.name,
        input.age,
        input.profession,
        input.area,
        input.education,
        input.phone,
        input.email,
        input.hobbies,
        input.about,
        input.photoUrl,
        input.photoVisibility,
        joinDate,
      ]
    )) as Array<Record<string, unknown>>;

    return mapMemberRow(rows[0], true);
  },

  async updateMember(id: number, body: Partial<Member>): Promise<Member | null> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const idx = db.members.findIndex((m) => m.id === id);
      if (idx === -1) return null;
      const prev = db.members[idx];
      db.members[idx] = {
        ...prev,
        name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : prev.name,
        age: body.age !== undefined && Number.isFinite(Number(body.age)) ? Number(body.age) : prev.age,
        profession:
          typeof body.profession === 'string' && body.profession.trim()
            ? body.profession.trim()
            : prev.profession,
        area: typeof body.area === 'string' && body.area.trim() ? body.area.trim() : prev.area,
        education: body.education !== undefined ? body.education || null : prev.education,
        phone: body.phone !== undefined ? body.phone || null : prev.phone,
        email: body.email !== undefined ? body.email || null : prev.email,
        hobbies: body.hobbies !== undefined ? body.hobbies || null : prev.hobbies,
        about: body.about !== undefined ? body.about || null : prev.about,
        photoUrl: body.photoUrl !== undefined ? body.photoUrl || null : prev.photoUrl,
        photoVisibility:
          body.photoVisibility === 'hide' || body.photoVisibility === 'show'
            ? body.photoVisibility
            : prev.photoVisibility,
        memberNumber:
          typeof body.memberNumber === 'string' && body.memberNumber.trim()
            ? body.memberNumber.trim()
            : prev.memberNumber,
      };
      writeLocalDb(db);
      return db.members[idx];
    }

    const prev = await store.getMember(id, true);
    if (!prev) return null;

    const next = {
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : prev.name,
      age: body.age !== undefined && Number.isFinite(Number(body.age)) ? Number(body.age) : prev.age,
      profession:
        typeof body.profession === 'string' && body.profession.trim()
          ? body.profession.trim()
          : prev.profession,
      area: typeof body.area === 'string' && body.area.trim() ? body.area.trim() : prev.area,
      education: body.education !== undefined ? body.education || null : prev.education,
      phone: body.phone !== undefined ? body.phone || null : prev.phone,
      email: body.email !== undefined ? body.email || null : prev.email,
      hobbies: body.hobbies !== undefined ? body.hobbies || null : prev.hobbies,
      about: body.about !== undefined ? body.about || null : prev.about,
      photoUrl: body.photoUrl !== undefined ? body.photoUrl || null : prev.photoUrl,
      photoVisibility:
        body.photoVisibility === 'hide' || body.photoVisibility === 'show'
          ? body.photoVisibility
          : prev.photoVisibility,
      memberNumber:
        typeof body.memberNumber === 'string' && body.memberNumber.trim()
          ? body.memberNumber.trim()
          : prev.memberNumber,
    };

    const rows = (await sql.query(
      `UPDATE members
       SET member_number = $1, name = $2, age = $3, profession = $4, area = $5,
           education = $6, phone = $7, email = $8, hobbies = $9, about = $10,
           photo_url = $11, photo_visibility = $12
       WHERE id = $13
       RETURNING *`,
      [
        next.memberNumber,
        next.name,
        next.age,
        next.profession,
        next.area,
        next.education,
        next.phone,
        next.email,
        next.hobbies,
        next.about,
        next.photoUrl,
        next.photoVisibility,
        id,
      ]
    )) as Array<Record<string, unknown>>;

    return rows.length > 0 ? mapMemberRow(rows[0], true) : null;
  },

  async deleteMember(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const before = db.members.length;
      db.members = db.members.filter((m) => m.id !== id);
      if (db.members.length === before) return false;
      for (const c of db.committees) {
        c.committeeMembers = c.committeeMembers.filter((cm) => cm.memberId !== id);
      }
      writeLocalDb(db);
      return true;
    }
    const deleted = (await sql.query(
      `DELETE FROM members WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return deleted.length > 0;
  },

  async getCommittees(): Promise<Committee[]> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const memberById = new Map(db.members.map((m) => [m.id, m]));
      return db.committees.map((c) => ({
        ...c,
        committeeMembers: c.committeeMembers.map((cm) => hydrateCommitteeMember(cm, memberById)),
      }));
    }
    const cRows = (await sql.query(
      `SELECT * FROM committees ORDER BY id ASC`
    )) as Array<Record<string, unknown>>;
    const cmRows = (await sql.query(
      `SELECT * FROM committee_members ORDER BY id ASC`
    )) as Array<Record<string, unknown>>;
    const mRows = (await sql.query(
      `SELECT id, member_number, name, photo_url, photo_visibility FROM members`
    )) as Array<Record<string, unknown>>;

    const memberById = new Map<number, Member>();
    for (const r of mRows) {
      memberById.set(Number(r.id), {
        id: Number(r.id),
        memberNumber: String(r.member_number),
        name: String(r.name),
        age: 20,
        profession: '',
        area: '',
        education: null,
        phone: null,
        email: null,
        hobbies: null,
        about: null,
        photoUrl: (r.photo_url as string | null) ?? null,
        photoVisibility: r.photo_visibility === 'hide' ? 'hide' : 'show',
        joinDate: '',
      });
    }

    const cmByCommittee = new Map<number, CommitteeMember[]>();
    for (const r of cmRows) {
      const cId = Number(r.committee_id);
      const entry = hydrateCommitteeMember(
        {
          id: Number(r.id),
          committeeId: cId,
          memberId: r.member_id ? Number(r.member_id) : null,
          memberName: String(r.member_name),
          memberNumber: (r.member_number as string | null) ?? null,
          position: String(r.position),
          photoUrl: (r.photo_url as string | null) ?? null,
        },
        memberById
      );
      const list = cmByCommittee.get(cId) || [];
      list.push(entry);
      cmByCommittee.set(cId, list);
    }

    return cRows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      previousCommitteeId: r.previous_committee_id ? Number(r.previous_committee_id) : null,
      createdAt: String(r.created_at),
      committeeMembers: cmByCommittee.get(Number(r.id)) || [],
    }));
  },

  async getCommittee(id: number): Promise<Committee | null> {
    const all = await store.getCommittees();
    return all.find((c) => c.id === id) || null;
  },

  async createCommittee(name: string, description: string | null): Promise<Committee> {
    const createdAt = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const committee: Committee = {
        id: ++db.nextId,
        name,
        description,
        previousCommitteeId: null,
        createdAt,
        committeeMembers: [],
      };
      db.committees.push(committee);
      writeLocalDb(db);
      return committee;
    }
    const rows = (await sql.query(
      `INSERT INTO committees (name, description, previous_committee_id, created_at)
       VALUES ($1, $2, NULL, $3)
       RETURNING *`,
      [name, description, createdAt]
    )) as Array<Record<string, unknown>>;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      previousCommitteeId: null,
      createdAt: String(r.created_at),
      committeeMembers: [],
    };
  },

  async deleteCommittee(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const before = db.committees.length;
      db.committees = db.committees.filter((c) => c.id !== id);
      if (db.committees.length === before) return false;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `DELETE FROM committees WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async addCommitteeMember(input: {
    committeeId: number;
    memberId: number | null;
    memberName: string;
    position: string;
  }): Promise<CommitteeMember | { error: string; status: number }> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const committee = db.committees.find((c) => c.id === input.committeeId);
      if (!committee) return { error: 'কমিটি পাওয়া যায়নি', status: 404 };
      const matched = input.memberId
        ? db.members.find((m) => m.id === input.memberId) ?? null
        : null;
      const resolvedName = matched ? matched.name : input.memberName;
      if (!resolvedName) return { error: 'সদস্যের নাম বা নির্বাচন প্রয়োজন', status: 400 };
      const entry: CommitteeMember = {
        id: ++db.nextId,
        committeeId: input.committeeId,
        memberId: matched ? matched.id : null,
        memberName: resolvedName,
        memberNumber: matched ? matched.memberNumber : null,
        position: input.position,
        photoUrl: matched && matched.photoVisibility === 'show' ? matched.photoUrl ?? null : null,
      };
      committee.committeeMembers.push(entry);
      writeLocalDb(db);
      return entry;
    }

    const cRows = (await sql.query(
      `SELECT id FROM committees WHERE id = $1`,
      [input.committeeId]
    )) as Array<{ id: number }>;
    if (cRows.length === 0) return { error: 'কমিটি পাওয়া যায়নি', status: 404 };

    const matched = input.memberId ? await store.getMember(input.memberId, false) : null;
    const resolvedName = matched ? matched.name : input.memberName;
    if (!resolvedName) return { error: 'সদস্যের নাম বা নির্বাচন প্রয়োজন', status: 400 };

    const memberNumber = matched ? matched.memberNumber : null;
    const photoUrl = matched && matched.photoVisibility === 'show' ? matched.photoUrl ?? null : null;

    const rows = (await sql.query(
      `INSERT INTO committee_members (
         committee_id, member_id, member_name, member_number, position, photo_url
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.committeeId,
        matched ? matched.id : null,
        resolvedName,
        memberNumber,
        input.position,
        photoUrl,
      ]
    )) as Array<Record<string, unknown>>;

    const r = rows[0];
    return {
      id: Number(r.id),
      committeeId: Number(r.committee_id),
      memberId: r.member_id ? Number(r.member_id) : null,
      memberName: String(r.member_name),
      memberNumber: (r.member_number as string | null) ?? null,
      position: String(r.position),
      photoUrl: (r.photo_url as string | null) ?? null,
    };
  },

  async updateCommitteeMember(id: number, position: string): Promise<CommitteeMember | null> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      for (const c of db.committees) {
        const target = c.committeeMembers.find((cm) => cm.id === id);
        if (target) {
          target.position = position;
          writeLocalDb(db);
          return target;
        }
      }
      return null;
    }
    const rows = (await sql.query(
      `UPDATE committee_members SET position = $1 WHERE id = $2 RETURNING *`,
      [position, id]
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      committeeId: Number(r.committee_id),
      memberId: r.member_id ? Number(r.member_id) : null,
      memberName: String(r.member_name),
      memberNumber: (r.member_number as string | null) ?? null,
      position: String(r.position),
      photoUrl: (r.photo_url as string | null) ?? null,
    };
  },

  async deleteCommitteeMember(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      let removed = false;
      for (const c of db.committees) {
        const before = c.committeeMembers.length;
        c.committeeMembers = c.committeeMembers.filter((cm) => cm.id !== id);
        if (c.committeeMembers.length !== before) removed = true;
      }
      if (!removed) return false;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `DELETE FROM committee_members WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async getEvents(): Promise<ClubEvent[]> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      return [...readLocalDb().events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const rows = (await sql.query(
      `SELECT * FROM events ORDER BY created_at DESC`
    )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      date: String(r.date),
      time: String(r.time),
      location: String(r.location),
      description: (r.description as string | null) ?? null,
      createdAt: String(r.created_at),
    }));
  },

  async createEvent(input: {
    title: string;
    date: string;
    time: string;
    location: string;
    description: string | null;
  }): Promise<ClubEvent> {
    const createdAt = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const item: ClubEvent = { id: ++db.nextId, ...input, createdAt };
      db.events.unshift(item);
      writeLocalDb(db);
      return item;
    }
    const rows = (await sql.query(
      `INSERT INTO events (title, date, time, location, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.title, input.date, input.time, input.location, input.description, createdAt]
    )) as Array<Record<string, unknown>>;
    const r = rows[0];
    return {
      id: Number(r.id),
      title: String(r.title),
      date: String(r.date),
      time: String(r.time),
      location: String(r.location),
      description: (r.description as string | null) ?? null,
      createdAt: String(r.created_at),
    };
  },

  async deleteEvent(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const before = db.events.length;
      db.events = db.events.filter((e) => e.id !== id);
      if (db.events.length === before) return false;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `DELETE FROM events WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async getNotices(): Promise<Notice[]> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      return [...readLocalDb().notices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const rows = (await sql.query(
      `SELECT * FROM notices ORDER BY created_at DESC`
    )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      date: String(r.date),
      time: (r.time as string | null) ?? null,
      location: (r.location as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      documentUrl: (r.document_url as string | null) ?? null,
      documentName: (r.document_name as string | null) ?? null,
      createdAt: String(r.created_at),
    }));
  },

  async createNotice(input: {
    title: string;
    date: string;
    time: string | null;
    location: string | null;
    description: string | null;
  }): Promise<Notice> {
    const createdAt = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const notice: Notice = {
        id: ++db.nextId,
        ...input,
        documentUrl: null,
        documentName: null,
        createdAt,
      };
      db.notices.unshift(notice);
      writeLocalDb(db);
      return notice;
    }
    const rows = (await sql.query(
      `INSERT INTO notices (title, date, time, location, description, document_url, document_name, created_at)
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6) RETURNING *`,
      [input.title, input.date, input.time, input.location, input.description, createdAt]
    )) as Array<Record<string, unknown>>;
    const r = rows[0];
    return {
      id: Number(r.id),
      title: String(r.title),
      date: String(r.date),
      time: (r.time as string | null) ?? null,
      location: (r.location as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      documentUrl: null,
      documentName: null,
      createdAt: String(r.created_at),
    };
  },

  async deleteNotice(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const before = db.notices.length;
      db.notices = db.notices.filter((n) => n.id !== id);
      if (db.notices.length === before) return false;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `DELETE FROM notices WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async getNotifications(): Promise<ClubNotification[]> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      return [...readLocalDb().notifications].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
    }
    const rows = (await sql.query(
      `SELECT * FROM notifications ORDER BY created_at DESC`
    )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      message: String(r.message),
      type: (r.type === 'alert' || r.type === 'info' ? r.type : 'announcement') as
        | 'announcement'
        | 'alert'
        | 'info',
      isRead: Boolean(r.is_read),
      createdAt: String(r.created_at),
    }));
  },

  async createNotification(input: {
    title: string;
    message: string;
    type: 'announcement' | 'alert' | 'info';
  }): Promise<ClubNotification> {
    const createdAt = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const notif: ClubNotification = {
        id: ++db.nextId,
        title: input.title,
        message: input.message,
        type: input.type,
        isRead: false,
        createdAt,
      };
      db.notifications.unshift(notif);
      writeLocalDb(db);
      return notif;
    }
    const rows = (await sql.query(
      `INSERT INTO notifications (title, message, type, is_read, created_at)
       VALUES ($1, $2, $3, FALSE, $4) RETURNING *`,
      [input.title, input.message, input.type, createdAt]
    )) as Array<Record<string, unknown>>;
    const r = rows[0];
    return {
      id: Number(r.id),
      title: String(r.title),
      message: String(r.message),
      type: (r.type === 'alert' || r.type === 'info' ? r.type : 'announcement') as
        | 'announcement'
        | 'alert'
        | 'info',
      isRead: Boolean(r.is_read),
      createdAt: String(r.created_at),
    };
  },

  async markNotificationRead(id: number): Promise<ClubNotification | null> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const target = db.notifications.find((n) => n.id === id);
      if (!target) return null;
      target.isRead = true;
      writeLocalDb(db);
      return target;
    }
    const rows = (await sql.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *`,
      [id]
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      title: String(r.title),
      message: String(r.message),
      type: (r.type === 'alert' || r.type === 'info' ? r.type : 'announcement') as
        | 'announcement'
        | 'alert'
        | 'info',
      isRead: Boolean(r.is_read),
      createdAt: String(r.created_at),
    };
  },

  async deleteNotification(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const before = db.notifications.length;
      db.notifications = db.notifications.filter((n) => n.id !== id);
      if (db.notifications.length === before) return false;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `DELETE FROM notifications WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async getDonations(): Promise<DonationRecord[]> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      return [...readLocalDb().donations].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
    }
    const rows = (await sql.query(
      `SELECT * FROM donations ORDER BY created_at DESC`
    )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      donorName: String(r.donor_name),
      method: (r.method === 'নগদ' || r.method === 'রকেট' ? r.method : 'বিকাশ') as
        | 'বিকাশ'
        | 'নগদ'
        | 'রকেট',
      amount: Number(r.amount),
      transactionId: String(r.transaction_id),
      phone: (r.phone as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      status: (r.status === 'verified' ? 'verified' : 'pending') as 'pending' | 'verified',
      createdAt: String(r.created_at),
    }));
  },

  async createDonation(input: {
    donorName: string;
    method: 'বিকাশ' | 'নগদ' | 'রকেট';
    amount: number;
    transactionId: string;
    phone: string | null;
    note: string | null;
  }): Promise<DonationRecord> {
    const createdAt = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const record: DonationRecord = {
        id: ++db.nextId,
        ...input,
        status: 'pending',
        createdAt,
      };
      db.donations.unshift(record);
      writeLocalDb(db);
      return record;
    }
    const rows = (await sql.query(
      `INSERT INTO donations (donor_name, method, amount, transaction_id, phone, note, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [
        input.donorName,
        input.method,
        Math.round(input.amount),
        input.transactionId,
        input.phone,
        input.note,
        createdAt,
      ]
    )) as Array<Record<string, unknown>>;
    const r = rows[0];
    return {
      id: Number(r.id),
      donorName: String(r.donor_name),
      method: (r.method === 'নগদ' || r.method === 'রকেট' ? r.method : 'বিকাশ') as
        | 'বিকাশ'
        | 'নগদ'
        | 'রকেট',
      amount: Number(r.amount),
      transactionId: String(r.transaction_id),
      phone: (r.phone as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      status: 'pending',
      createdAt: String(r.created_at),
    };
  },

  async updateDonationStatus(
    id: number,
    status: 'pending' | 'verified'
  ): Promise<DonationRecord | null> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const target = db.donations.find((d) => d.id === id);
      if (!target) return null;
      target.status = status;
      writeLocalDb(db);
      return target;
    }
    const rows = (await sql.query(
      `UPDATE donations SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      donorName: String(r.donor_name),
      method: (r.method === 'নগদ' || r.method === 'রকেট' ? r.method : 'বিকাশ') as
        | 'বিকাশ'
        | 'নগদ'
        | 'রকেট',
      amount: Number(r.amount),
      transactionId: String(r.transaction_id),
      phone: (r.phone as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      status: (r.status === 'verified' ? 'verified' : 'pending') as 'pending' | 'verified',
      createdAt: String(r.created_at),
    };
  },

  async deleteDonation(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const before = db.donations.length;
      db.donations = db.donations.filter((d) => d.id !== id);
      if (db.donations.length === before) return false;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `DELETE FROM donations WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async getMessages(): Promise<ContactMessage[]> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      return [...readLocalDb().messages].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
    }
    const rows = (await sql.query(
      `SELECT * FROM messages ORDER BY created_at DESC`
    )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      message: String(r.message),
      createdAt: String(r.created_at),
    }));
  },

  async createMessage(input: {
    name: string;
    email: string;
    message: string;
  }): Promise<ContactMessage> {
    const createdAt = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const entry: ContactMessage = { id: ++db.nextId, ...input, createdAt };
      db.messages.unshift(entry);
      writeLocalDb(db);
      return entry;
    }
    const rows = (await sql.query(
      `INSERT INTO messages (name, email, message, created_at) VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.name, input.email, input.message, createdAt]
    )) as Array<Record<string, unknown>>;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      message: String(r.message),
      createdAt: String(r.created_at),
    };
  },

  async deleteMessage(id: number): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const before = db.messages.length;
      db.messages = db.messages.filter((m) => m.id !== id);
      if (db.messages.length === before) return false;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `DELETE FROM messages WHERE id = $1 RETURNING id`,
      [id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async findAdminByUsername(username: string): Promise<AdminUser | null> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      return db.admins.find((a) => a.username === username) || null;
    }
    const rows = (await sql.query(
      `SELECT id, username, password_hash, created_at FROM admins WHERE username = $1`,
      [username]
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      username: String(r.username),
      passwordHash: String(r.password_hash),
      createdAt: String(r.created_at),
    };
  },

  async findAdminById(id: number): Promise<AdminUser | null> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      return db.admins.find((a) => a.id === id) || null;
    }
    const rows = (await sql.query(
      `SELECT id, username, password_hash, created_at FROM admins WHERE id = $1`,
      [id]
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      username: String(r.username),
      passwordHash: String(r.password_hash),
      createdAt: String(r.created_at),
    };
  },

  async listAdmins(): Promise<Array<{ id: number; username: string; createdAt: string }>> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      return readLocalDb().admins.map((a) => ({
        id: a.id,
        username: a.username,
        createdAt: a.createdAt,
      }));
    }
    const rows = (await sql.query(
      `SELECT id, username, created_at FROM admins ORDER BY id ASC`
    )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      username: String(r.username),
      createdAt: String(r.created_at),
    }));
  },

  async updateAdminPassword(id: number, newPasswordHash: string): Promise<boolean> {
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const admin = db.admins.find((a) => a.id === id);
      if (!admin) return false;
      admin.passwordHash = newPasswordHash;
      writeLocalDb(db);
      return true;
    }
    const rows = (await sql.query(
      `UPDATE admins SET password_hash = $1 WHERE id = $2 RETURNING id`,
      [newPasswordHash, id]
    )) as Array<{ id: number }>;
    return rows.length > 0;
  },

  async createAdminUser(
    username: string,
    passwordHash: string
  ): Promise<{ id: number; username: string } | { conflict: true }> {
    const createdAt = new Date().toISOString();
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      if (db.admins.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
        return { conflict: true };
      }
      const newAdmin: AdminUser = {
        id: ++db.nextId,
        username,
        passwordHash,
        createdAt,
      };
      db.admins.push(newAdmin);
      writeLocalDb(db);
      return { id: newAdmin.id, username: newAdmin.username };
    }

    const existing = (await sql.query(
      `SELECT id FROM admins WHERE LOWER(username) = LOWER($1)`,
      [username]
    )) as Array<{ id: number }>;
    if (existing.length > 0) return { conflict: true };

    const rows = (await sql.query(
      `INSERT INTO admins (username, password_hash, created_at) VALUES ($1, $2, $3) RETURNING id, username`,
      [username, passwordHash, createdAt]
    )) as Array<{ id: number; username: string }>;
    return { id: Number(rows[0].id), username: String(rows[0].username) };
  },

  async createSession(adminId: number, username: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const now = Date.now();
      db.sessions = (db.sessions || []).filter((s) => new Date(s.expiresAt).getTime() > now);
      db.sessions.push({ tokenHash, adminId, username, expiresAt });
      writeLocalDb(db);
      return rawToken;
    }

    await sql.query(`DELETE FROM admin_sessions WHERE expires_at <= NOW()`);
    await sql.query(
      `INSERT INTO admin_sessions (token_hash, admin_id, username, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [tokenHash, adminId, username, expiresAt]
    );
    return rawToken;
  },

  async verifySession(rawToken: string): Promise<{ adminId: number; username: string } | null> {
    const tokenHash = hashToken(rawToken);
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      const found = (db.sessions || []).find((s) => s.tokenHash === tokenHash);
      if (!found) return null;
      if (new Date(found.expiresAt).getTime() <= Date.now()) {
        db.sessions = (db.sessions || []).filter((s) => s.tokenHash !== tokenHash);
        writeLocalDb(db);
        return null;
      }
      return { adminId: found.adminId, username: found.username };
    }

    const rows = (await sql.query(
      `SELECT admin_id, username, expires_at FROM admin_sessions WHERE token_hash = $1`,
      [tokenHash]
    )) as Array<{ admin_id: number; username: string; expires_at: string }>;
    if (rows.length === 0) return null;
    if (new Date(rows[0].expires_at).getTime() <= Date.now()) {
      await sql.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [tokenHash]);
      return null;
    }
    return { adminId: Number(rows[0].admin_id), username: String(rows[0].username) };
  },

  async deleteSession(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const sql = await ensurePostgresReady();
    if (!sql) {
      const db = readLocalDb();
      db.sessions = (db.sessions || []).filter((s) => s.tokenHash !== tokenHash);
      writeLocalDb(db);
      return;
    }
    await sql.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [tokenHash]);
  },
};
