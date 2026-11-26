import { signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
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
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  waitForAuthReady,
} from './firebase';

const BOOTSTRAP_ADMIN_EMAIL = 'ariyanahmed220066@gmail.com';
const ADMIN_FLAG_KEY = 'chirakumar_admin_email';
const READ_NOTIFS_KEY = 'chirakumar_read_notifications';

export function getAdminToken(): string | null {
  return auth.currentUser?.email || localStorage.getItem(ADMIN_FLAG_KEY);
}

export function getAdminUsername(): string | null {
  return auth.currentUser?.displayName || auth.currentUser?.email || localStorage.getItem(ADMIN_FLAG_KEY);
}

export function clearAdminAuth() {
  localStorage.removeItem(ADMIN_FLAG_KEY);
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
  const set = getLocalReadIds();
  set.add(id);
  localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...set]));
}

function truncateStr(val: string | null | undefined, maxLen: number): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function toIsoString(val: unknown, fallback = new Date().toISOString()): string {
  if (!val) return fallback;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return fallback;
}

function generateNumericId(): number {
  return Date.now() * 100 + Math.floor(Math.random() * 90 + 10);
}

async function isSeededInFirestore(): Promise<boolean> {
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
    if (settingsSnap.exists()) return true;
    const membersSnap = await getDocs(query(collection(db, 'members'), where('id', '>', 0)));
    return !membersSnap.empty;
  } catch {
    return true;
  }
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await waitForAuthReady();
  if (!user || !user.emailVerified) return false;
  if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) return true;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

let seedingPromise: Promise<void> | null = null;

export async function seedFirestoreIfEmpty(force = false): Promise<void> {
  if (seedingPromise) return seedingPromise;
  seedingPromise = (async () => {
    const adminOk = await isCurrentUserAdmin();
    if (!adminOk) return;

    if (!force) {
      const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
      if (settingsSnap.exists()) {
        return;
      }
    }

    type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;
    const baseOps: BatchOp[] = [];
    const relationalOps: BatchOp[] = [];

    for (const m of SEED_MEMBERS) {
      const docId = String(m.id);
      const memberRef = doc(db, 'members', docId);
      const contactRef = doc(db, 'members', docId, 'private', 'contact');
      baseOps.push((batch) =>
        batch.set(memberRef, {
          id: m.id,
          memberNumber: truncateStr(m.memberNumber, 32) || docId,
          name: truncateStr(m.name, 150) || 'সদস্য',
          age: Math.min(100, Math.max(14, Number(m.age) || 20)),
          profession: truncateStr(m.profession, 120) || 'শিক্ষার্থী',
          area: truncateStr(m.area, 150) || 'বাংলাদেশ',
          education: truncateStr(m.education, 200),
          hobbies: truncateStr(m.hobbies, 300),
          about: truncateStr(m.about, 1000),
          photoUrl: truncateStr(m.photoUrl, 250000),
          photoVisibility: m.photoVisibility === 'hide' ? 'hide' : 'show',
          joinDate: truncateStr(m.joinDate, 64) || new Date().toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      relationalOps.push((batch) =>
        batch.set(contactRef, {
          phone: truncateStr(m.phone, 40),
          email: truncateStr(m.email, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    for (const c of SEED_COMMITTEES) {
      const cId = String(c.id);
      const cRef = doc(db, 'committees', cId);
      baseOps.push((batch) =>
        batch.set(cRef, {
          id: c.id,
          name: truncateStr(c.name, 150) || 'কমিটি',
          description: truncateStr(c.description, 1000),
          previousCommitteeId: c.previousCommitteeId ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      for (const cm of c.committeeMembers) {
        const cmRef = doc(db, 'committees', cId, 'members', String(cm.id));
        relationalOps.push((batch) =>
          batch.set(cmRef, {
            id: cm.id,
            committeeId: c.id,
            memberId: cm.memberId ?? null,
            memberName: truncateStr(cm.memberName, 150) || 'সদস্য',
            memberNumber: truncateStr(cm.memberNumber, 32),
            position: truncateStr(cm.position, 150) || 'সদস্য',
            photoUrl: truncateStr(cm.photoUrl, 250000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
    }

    for (const ev of SEED_EVENTS) {
      const evRef = doc(db, 'events', String(ev.id));
      baseOps.push((batch) =>
        batch.set(evRef, {
          id: ev.id,
          title: truncateStr(ev.title, 200) || 'ইভেন্ট',
          date: truncateStr(ev.date, 64) || '2026-12-15',
          time: truncateStr(ev.time, 64) || 'বিকাল ৪:০০ টা',
          location: truncateStr(ev.location, 200) || 'বাংলাদেশ',
          description: truncateStr(ev.description, 2000),
          createdAt: serverTimestamp(),
        })
      );
    }

    for (const n of SEED_NOTICES) {
      const nRef = doc(db, 'notices', String(n.id));
      baseOps.push((batch) =>
        batch.set(nRef, {
          id: n.id,
          title: truncateStr(n.title, 200) || 'নোটিশ',
          date: truncateStr(n.date, 64) || '2026-02-18',
          time: truncateStr(n.time, 64),
          location: truncateStr(n.location, 200),
          description: truncateStr(n.description, 3000),
          documentUrl: truncateStr(n.documentUrl, 2000),
          documentName: truncateStr(n.documentName, 200),
          createdAt: serverTimestamp(),
        })
      );
    }

    for (const notif of SEED_NOTIFICATIONS) {
      const notifRef = doc(db, 'notifications', String(notif.id));
      baseOps.push((batch) =>
        batch.set(notifRef, {
          id: notif.id,
          title: truncateStr(notif.title, 200) || 'বিজ্ঞপ্তি',
          message: truncateStr(notif.message, 2000) || '',
          type: notif.type,
          isRead: Boolean(notif.isRead),
          createdAt: serverTimestamp(),
        })
      );
    }

    const BASE_CHUNK = 300;
    const RELATIONAL_CHUNK = 8;
    try {
      for (let i = 0; i < baseOps.length; i += BASE_CHUNK) {
        const batch = writeBatch(db);
        for (const fn of baseOps.slice(i, i + BASE_CHUNK)) fn(batch);
        await batch.commit();
      }
      for (let i = 0; i < relationalOps.length; i += RELATIONAL_CHUNK) {
        const batch = writeBatch(db);
        for (const fn of relationalOps.slice(i, i + RELATIONAL_CHUNK)) fn(batch);
        await batch.commit();
      }
      await setDoc(doc(db, 'settings', 'site'), {
        logoUrl: truncateStr(SEED_SETTINGS.logoUrl, 250000),
        appDownloadLink: truncateStr(SEED_SETTINGS.appDownloadLink, 500),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seed');
    }
  })();

  try {
    await seedingPromise;
  } finally {
    seedingPromise = null;
  }
}

function mapMemberDoc(data: Record<string, unknown>, contact?: { phone?: string | null; email?: string | null }): Member {
  return {
    id: Number(data.id),
    memberNumber: String(data.memberNumber || data.id),
    name: String(data.name || ''),
    age: Number(data.age || 20),
    profession: String(data.profession || ''),
    area: String(data.area || ''),
    education: (data.education as string | null) ?? null,
    phone: contact?.phone ?? null,
    email: contact?.email ?? null,
    hobbies: (data.hobbies as string | null) ?? null,
    about: (data.about as string | null) ?? null,
    photoUrl: (data.photoUrl as string | null) ?? null,
    photoVisibility: data.photoVisibility === 'hide' ? 'hide' : 'show',
    joinDate: toIsoString(data.joinDate || data.createdAt),
  };
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
      const snap = await getDoc(doc(db, 'settings', 'site'));
      if (!snap.exists()) {
        return { ...SEED_SETTINGS };
      }
      const d = snap.data();
      return {
        logoUrl: (d.logoUrl as string | null) ?? SEED_SETTINGS.logoUrl ?? null,
        appDownloadLink: (d.appDownloadLink as string | null) ?? null,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings/site');
    }
  },

  updateSettings: async (payload: Partial<SiteSettings>): Promise<SiteSettings> => {
    const path = 'settings/site';
    try {
      await seedFirestoreIfEmpty();
      const ref = doc(db, 'settings', 'site');
      const existing = await getDoc(ref);
      const curr = existing.exists() ? existing.data() : SEED_SETTINGS;
      const nextLogo =
        payload.logoUrl !== undefined
          ? truncateStr(payload.logoUrl, 250000)
          : truncateStr(curr.logoUrl as string | null, 250000);
      const nextAppLink =
        payload.appDownloadLink !== undefined
          ? truncateStr(payload.appDownloadLink, 500)
          : truncateStr(curr.appDownloadLink as string | null, 500);

      await setDoc(ref, {
        logoUrl: nextLogo,
        appDownloadLink: nextAppLink,
        updatedAt: serverTimestamp(),
      });
      return { logoUrl: nextLogo, appDownloadLink: nextAppLink };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  uploadImage: async (dataUrl: string, _filename: string): Promise<{ url: string }> => {
    const url = await compressImageDataUrl(dataUrl);
    if (url.length > 250000) {
      throw new Error('ছবির আকার আরও ছোট হতে হবে');
    }
    return { url };
  },

  getMembers: async (includePrivateForAdmin = false): Promise<Member[]> => {
    const path = 'members';
    try {
      const snap = await getDocs(query(collection(db, 'members'), where('id', '>', 0)));
      if (snap.empty && !(await isSeededInFirestore())) {
        return [...SEED_MEMBERS].sort((a, b) => Number(a.memberNumber) - Number(b.memberNumber));
      }
      const list = snap.docs.map((d) => mapMemberDoc(d.data()));
      if (includePrivateForAdmin && (await isCurrentUserAdmin())) {
        const enriched = await Promise.all(
          list.map(async (m) => {
            try {
              const pSnap = await getDoc(doc(db, 'members', String(m.id), 'private', 'contact'));
              if (pSnap.exists()) {
                const pd = pSnap.data();
                return {
                  ...m,
                  phone: (pd.phone as string | null) ?? null,
                  email: (pd.email as string | null) ?? null,
                };
              }
            } catch {
              // ignore individual contact lookup failure
            }
            return m;
          })
        );
        return enriched.sort((a, b) => Number(a.memberNumber) - Number(b.memberNumber));
      }
      return list.sort((a, b) => Number(a.memberNumber) - Number(b.memberNumber));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  getMember: async (id: number): Promise<Member> => {
    const path = `members/${id}`;
    try {
      const snap = await getDoc(doc(db, 'members', String(id)));
      if (!snap.exists()) {
        if (!(await isSeededInFirestore())) {
          const seeded = SEED_MEMBERS.find((m) => m.id === id);
          if (seeded) return seeded;
        }
        throw new Error('সদস্য পাওয়া যায়নি');
      }
      let contact: { phone?: string | null; email?: string | null } | undefined;
      if (await isCurrentUserAdmin()) {
        try {
          const cSnap = await getDoc(doc(db, 'members', String(id), 'private', 'contact'));
          if (cSnap.exists()) {
            const cd = cSnap.data();
            contact = {
              phone: (cd.phone as string | null) ?? null,
              email: (cd.email as string | null) ?? null,
            };
          }
        } catch {
          // ignore if non-admin
        }
      }
      return mapMemberDoc(snap.data(), contact);
    } catch (error) {
      if (error instanceof Error && error.message === 'সদস্য পাওয়া যায়নি') throw error;
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  createMember: async (
    payload: Omit<Member, 'id' | 'memberNumber' | 'joinDate'> & { memberNumber?: string }
  ): Promise<Member> => {
    const membersPath = 'members';
    try {
      const existingMembers = await api.getMembers();
      const maxId = existingMembers.reduce((max, m) => Math.max(max, m.id), 0);
      const maxNumber = existingMembers.reduce((max, m) => Math.max(max, Number(m.memberNumber) || 0), 0);
      const id = Math.max(maxId + 1, generateNumericId());
      const memberNumber = truncateStr(payload.memberNumber, 32) || String(maxNumber + 1);
      const joinDate = new Date().toISOString();

      const ageNum = Math.min(100, Math.max(14, Number(payload.age) || 20));
      const publicDoc = {
        id,
        memberNumber,
        name: truncateStr(payload.name, 150) || 'সদস্য',
        age: ageNum,
        profession: truncateStr(payload.profession, 120) || 'শিক্ষার্থী',
        area: truncateStr(payload.area, 150) || 'বাংলাদেশ',
        education: truncateStr(payload.education, 200),
        hobbies: truncateStr(payload.hobbies, 300),
        about: truncateStr(payload.about, 1000),
        photoUrl: truncateStr(payload.photoUrl, 250000),
        photoVisibility: payload.photoVisibility === 'hide' ? ('hide' as const) : ('show' as const),
        joinDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'members', String(id)), publicDoc);
      batch.set(doc(db, 'members', String(id), 'private', 'contact'), {
        phone: truncateStr(payload.phone, 40),
        email: truncateStr(payload.email, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      return {
        id,
        memberNumber,
        name: publicDoc.name,
        age: publicDoc.age,
        profession: publicDoc.profession,
        area: publicDoc.area,
        education: publicDoc.education,
        phone: truncateStr(payload.phone, 40),
        email: truncateStr(payload.email, 120),
        hobbies: publicDoc.hobbies,
        about: publicDoc.about,
        photoUrl: publicDoc.photoUrl,
        photoVisibility: publicDoc.photoVisibility,
        joinDate,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, membersPath);
    }
  },

  updateMember: async (id: number, payload: Partial<Member>): Promise<Member> => {
    const path = `members/${id}`;
    try {
      await seedFirestoreIfEmpty();
      const memberRef = doc(db, 'members', String(id));
      const snap = await getDoc(memberRef);
      if (!snap.exists()) {
        throw new Error('সদস্য পাওয়া যায়নি');
      }
      const prev = snap.data();
      const nextPublic = {
        id: prev.id,
        memberNumber:
          payload.memberNumber !== undefined
            ? truncateStr(payload.memberNumber, 32) || String(prev.memberNumber)
            : String(prev.memberNumber),
        name:
          payload.name !== undefined
            ? truncateStr(payload.name, 150) || String(prev.name)
            : String(prev.name),
        age:
          payload.age !== undefined && Number.isFinite(Number(payload.age))
            ? Math.min(100, Math.max(14, Number(payload.age)))
            : Number(prev.age),
        profession:
          payload.profession !== undefined
            ? truncateStr(payload.profession, 120) || String(prev.profession)
            : String(prev.profession),
        area:
          payload.area !== undefined
            ? truncateStr(payload.area, 150) || String(prev.area)
            : String(prev.area),
        education:
          payload.education !== undefined
            ? truncateStr(payload.education, 200)
            : (prev.education as string | null) ?? null,
        hobbies:
          payload.hobbies !== undefined
            ? truncateStr(payload.hobbies, 300)
            : (prev.hobbies as string | null) ?? null,
        about:
          payload.about !== undefined
            ? truncateStr(payload.about, 1000)
            : (prev.about as string | null) ?? null,
        photoUrl:
          payload.photoUrl !== undefined
            ? truncateStr(payload.photoUrl, 250000)
            : (prev.photoUrl as string | null) ?? null,
        photoVisibility:
          payload.photoVisibility === 'hide' || payload.photoVisibility === 'show'
            ? payload.photoVisibility
            : prev.photoVisibility === 'hide'
            ? 'hide'
            : 'show',
        joinDate: prev.joinDate,
        createdAt: prev.createdAt,
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.update(memberRef, {
        memberNumber: nextPublic.memberNumber,
        name: nextPublic.name,
        age: nextPublic.age,
        profession: nextPublic.profession,
        area: nextPublic.area,
        education: nextPublic.education,
        hobbies: nextPublic.hobbies,
        about: nextPublic.about,
        photoUrl: nextPublic.photoUrl,
        photoVisibility: nextPublic.photoVisibility,
        updatedAt: serverTimestamp(),
      });

      if (payload.phone !== undefined || payload.email !== undefined) {
        const contactRef = doc(db, 'members', String(id), 'private', 'contact');
        const cSnap = await getDoc(contactRef);
        if (cSnap.exists()) {
          const prevC = cSnap.data();
          batch.update(contactRef, {
            phone:
              payload.phone !== undefined
                ? truncateStr(payload.phone, 40)
                : (prevC.phone as string | null) ?? null,
            email:
              payload.email !== undefined
                ? truncateStr(payload.email, 120)
                : (prevC.email as string | null) ?? null,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(contactRef, {
            phone: truncateStr(payload.phone, 40),
            email: truncateStr(payload.email, 120),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      return api.getMember(id);
    } catch (error) {
      if (error instanceof Error && error.message === 'সদস্য পাওয়া যায়নি') throw error;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteMember: async (id: number): Promise<{ ok: true }> => {
    const path = `members/${id}`;
    try {
      await seedFirestoreIfEmpty();
      const refsToDelete: ReturnType<typeof doc>[] = [];
      const contactRef = doc(db, 'members', String(id), 'private', 'contact');
      const contactSnap = await getDoc(contactRef);
      if (contactSnap.exists()) {
        refsToDelete.push(contactRef);
      }
      refsToDelete.push(doc(db, 'members', String(id)));

      const committeesSnap = await getDocs(query(collection(db, 'committees'), where('id', '>', 0)));
      for (const cDoc of committeesSnap.docs) {
        const cmSnap = await getDocs(
          query(collection(db, 'committees', cDoc.id, 'members'), where('committeeId', '>', 0))
        );
        for (const cmDoc of cmSnap.docs) {
          if (Number(cmDoc.data().memberId) === id) {
            refsToDelete.push(cmDoc.ref);
          }
        }
      }
      for (let i = 0; i < refsToDelete.length; i += 15) {
        const batch = writeBatch(db);
        for (const ref of refsToDelete.slice(i, i + 15)) batch.delete(ref);
        await batch.commit();
      }
      return { ok: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  getCommittees: async (): Promise<Committee[]> => {
    const path = 'committees';
    try {
      const committeesSnap = await getDocs(query(collection(db, 'committees'), where('id', '>', 0)));
      if (committeesSnap.empty && !(await isSeededInFirestore())) {
        return SEED_COMMITTEES;
      }

      const membersList = await api.getMembers();
      const memberMap = new Map(membersList.map((m) => [m.id, m]));

      const hydrated = await Promise.all(
        committeesSnap.docs.map(async (cDoc) => {
          const cd = cDoc.data();
          const cId = Number(cd.id);
          const cmSnap = await getDocs(
            query(collection(db, 'committees', cDoc.id, 'members'), where('committeeId', '>', 0))
          );
          const cmList: CommitteeMember[] = cmSnap.docs
            .map((d) => {
              const cm = d.data();
              const mId = cm.memberId ? Number(cm.memberId) : null;
              const matched = mId ? memberMap.get(mId) : undefined;
              return {
                id: Number(cm.id),
                committeeId: cId,
                memberId: mId,
                memberName: matched ? matched.name : String(cm.memberName || ''),
                memberNumber: matched ? matched.memberNumber : (cm.memberNumber as string | null) ?? null,
                position: String(cm.position || ''),
                photoUrl:
                  matched && matched.photoVisibility === 'hide'
                    ? null
                    : ((cm.photoUrl as string | null) || matched?.photoUrl || null),
              };
            })
            .sort((a, b) => a.id - b.id);

          return {
            id: cId,
            name: String(cd.name || ''),
            description: (cd.description as string | null) ?? null,
            previousCommitteeId: cd.previousCommitteeId ? Number(cd.previousCommitteeId) : null,
            createdAt: toIsoString(cd.createdAt),
            committeeMembers: cmList,
          };
        })
      );

      return hydrated.sort((a, b) => a.id - b.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  getCommittee: async (id: number): Promise<Committee> => {
    const path = `committees/${id}`;
    try {
      const cSnap = await getDoc(doc(db, 'committees', String(id)));
      if (!cSnap.exists()) {
        if (!(await isSeededInFirestore())) {
          const seeded = SEED_COMMITTEES.find((c) => c.id === id);
          if (seeded) return seeded;
        }
        throw new Error('কমিটি পাওয়া যায়নি');
      }
      const cd = cSnap.data();
      const membersList = await api.getMembers();
      const memberMap = new Map(membersList.map((m) => [m.id, m]));
      const cmSnap = await getDocs(
        query(collection(db, 'committees', String(id), 'members'), where('committeeId', '>', 0))
      );
      const cmList: CommitteeMember[] = cmSnap.docs
        .map((d) => {
          const cm = d.data();
          const mId = cm.memberId ? Number(cm.memberId) : null;
          const matched = mId ? memberMap.get(mId) : undefined;
          return {
            id: Number(cm.id),
            committeeId: id,
            memberId: mId,
            memberName: matched ? matched.name : String(cm.memberName || ''),
            memberNumber: matched ? matched.memberNumber : (cm.memberNumber as string | null) ?? null,
            position: String(cm.position || ''),
            photoUrl:
              matched && matched.photoVisibility === 'hide'
                ? null
                : ((cm.photoUrl as string | null) || matched?.photoUrl || null),
          };
        })
        .sort((a, b) => a.id - b.id);

      return {
        id,
        name: String(cd.name || ''),
        description: (cd.description as string | null) ?? null,
        previousCommitteeId: cd.previousCommitteeId ? Number(cd.previousCommitteeId) : null,
        createdAt: toIsoString(cd.createdAt),
        committeeMembers: cmList,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'কমিটি পাওয়া যায়নি') throw error;
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  createCommittee: async (payload: { name: string; description?: string | null }): Promise<Committee> => {
    const path = 'committees';
    try {
      await seedFirestoreIfEmpty();
      const existing = await api.getCommittees();
      const maxId = existing.reduce((max, c) => Math.max(max, c.id), 0);
      const id = maxId + 1;
      const name = truncateStr(payload.name, 150) || 'কমিটি';
      const description = truncateStr(payload.description, 1000);
      await setDoc(doc(db, 'committees', String(id)), {
        id,
        name,
        description,
        previousCommitteeId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id,
        name,
        description,
        previousCommitteeId: null,
        createdAt: new Date().toISOString(),
        committeeMembers: [],
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  deleteCommittee: async (id: number): Promise<{ ok: true }> => {
    const path = `committees/${id}`;
    try {
      await seedFirestoreIfEmpty();
      const cmSnap = await getDocs(
        query(collection(db, 'committees', String(id), 'members'), where('committeeId', '>', 0))
      );
      const refsToDelete = [...cmSnap.docs.map((d) => d.ref), doc(db, 'committees', String(id))];
      for (let i = 0; i < refsToDelete.length; i += 15) {
        const batch = writeBatch(db);
        for (const ref of refsToDelete.slice(i, i + 15)) batch.delete(ref);
        await batch.commit();
      }
      return { ok: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  addCommitteeMember: async (payload: {
    committeeId: number;
    memberId?: number | null;
    memberName?: string;
    position: string;
  }): Promise<CommitteeMember> => {
    const path = `committees/${payload.committeeId}/members`;
    try {
      await seedFirestoreIfEmpty();
      let matched: Member | null = null;
      if (payload.memberId) {
        try {
          matched = await api.getMember(payload.memberId);
        } catch {
          matched = null;
        }
      }
      const resolvedName =
        truncateStr(matched ? matched.name : payload.memberName, 150) || '';
      if (!resolvedName) {
        throw new Error('সদস্যের নাম বা নির্বাচন প্রয়োজন');
      }
      const id = generateNumericId();
      const position = truncateStr(payload.position, 150) || 'সদস্য';
      const photoUrl =
        matched && matched.photoVisibility === 'show' ? truncateStr(matched.photoUrl, 250000) : null;
      const memberNumber = matched ? truncateStr(matched.memberNumber, 32) : null;

      await setDoc(doc(db, 'committees', String(payload.committeeId), 'members', String(id)), {
        id,
        committeeId: payload.committeeId,
        memberId: matched ? matched.id : null,
        memberName: resolvedName,
        memberNumber,
        position,
        photoUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        id,
        committeeId: payload.committeeId,
        memberId: matched ? matched.id : null,
        memberName: resolvedName,
        memberNumber,
        position,
        photoUrl,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'সদস্যের নাম বা নির্বাচন প্রয়োজন') throw error;
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateCommitteeMember: async (
    id: number,
    position: string,
    committeeIdHint?: number
  ): Promise<CommitteeMember> => {
    const pos = truncateStr(position, 150);
    if (!pos) throw new Error('পদবি আবশ্যক');
    try {
      await seedFirestoreIfEmpty();
      const committeesSnap = committeeIdHint
        ? [await getDoc(doc(db, 'committees', String(committeeIdHint)))]
        : (await getDocs(query(collection(db, 'committees'), where('id', '>', 0)))).docs;

      for (const cDoc of committeesSnap) {
        if (!cDoc.exists()) continue;
        const ref = doc(db, 'committees', cDoc.id, 'members', String(id));
        const cmSnap = await getDoc(ref);
        if (cmSnap.exists()) {
          const prev = cmSnap.data();
          await updateDoc(ref, {
            position: pos,
            updatedAt: serverTimestamp(),
          });
          return {
            id: Number(prev.id),
            committeeId: Number(prev.committeeId),
            memberId: prev.memberId ? Number(prev.memberId) : null,
            memberName: String(prev.memberName || ''),
            memberNumber: (prev.memberNumber as string | null) ?? null,
            position: pos,
            photoUrl: (prev.photoUrl as string | null) ?? null,
          };
        }
      }
      throw new Error('কমিটি সদস্য পাওয়া যায়নি');
    } catch (error) {
      if (error instanceof Error && error.message === 'কমিটি সদস্য পাওয়া যায়নি') throw error;
      handleFirestoreError(error, OperationType.UPDATE, `committees/*/members/${id}`);
    }
  },

  deleteCommitteeMember: async (id: number, committeeIdHint?: number): Promise<{ ok: true }> => {
    try {
      await seedFirestoreIfEmpty();
      const committeesSnap = committeeIdHint
        ? [await getDoc(doc(db, 'committees', String(committeeIdHint)))]
        : (await getDocs(query(collection(db, 'committees'), where('id', '>', 0)))).docs;

      for (const cDoc of committeesSnap) {
        if (!cDoc.exists()) continue;
        const ref = doc(db, 'committees', cDoc.id, 'members', String(id));
        const cmSnap = await getDoc(ref);
        if (cmSnap.exists()) {
          await deleteDoc(ref);
          return { ok: true };
        }
      }
      throw new Error('কমিটি সদস্য পাওয়া যায়নি');
    } catch (error) {
      if (error instanceof Error && error.message === 'কমিটি সদস্য পাওয়া যায়নি') throw error;
      handleFirestoreError(error, OperationType.DELETE, `committees/*/members/${id}`);
    }
  },

  getEvents: async (): Promise<ClubEvent[]> => {
    const path = 'events';
    try {
      const snap = await getDocs(query(collection(db, 'events'), where('id', '>', 0)));
      if (snap.empty && !(await isSeededInFirestore())) {
        return SEED_EVENTS;
      }
      return snap.docs
        .map((d) => {
          const ev = d.data();
          return {
            id: Number(ev.id),
            title: String(ev.title || ''),
            date: String(ev.date || ''),
            time: String(ev.time || ''),
            location: String(ev.location || ''),
            description: (ev.description as string | null) ?? null,
            createdAt: toIsoString(ev.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createEvent: async (payload: Omit<ClubEvent, 'id' | 'createdAt'>): Promise<ClubEvent> => {
    const path = 'events';
    try {
      await seedFirestoreIfEmpty();
      const id = generateNumericId();
      const item = {
        id,
        title: truncateStr(payload.title, 200) || 'ইভেন্ট',
        date: truncateStr(payload.date, 64) || '',
        time: truncateStr(payload.time, 64) || '',
        location: truncateStr(payload.location, 200) || '',
        description: truncateStr(payload.description, 2000),
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'events', String(id)), item);
      return {
        ...item,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  deleteEvent: async (id: number): Promise<{ ok: true }> => {
    const path = `events/${id}`;
    try {
      await seedFirestoreIfEmpty();
      await deleteDoc(doc(db, 'events', String(id)));
      return { ok: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  getNotices: async (): Promise<Notice[]> => {
    const path = 'notices';
    try {
      const snap = await getDocs(query(collection(db, 'notices'), where('id', '>', 0)));
      if (snap.empty && !(await isSeededInFirestore())) {
        return SEED_NOTICES;
      }
      return snap.docs
        .map((d) => {
          const n = d.data();
          return {
            id: Number(n.id),
            title: String(n.title || ''),
            date: String(n.date || ''),
            time: (n.time as string | null) ?? null,
            location: (n.location as string | null) ?? null,
            description: (n.description as string | null) ?? null,
            documentUrl: (n.documentUrl as string | null) ?? null,
            documentName: (n.documentName as string | null) ?? null,
            createdAt: toIsoString(n.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createNotice: async (
    payload: Omit<Notice, 'id' | 'createdAt' | 'documentUrl' | 'documentName'>
  ): Promise<Notice> => {
    const path = 'notices';
    try {
      await seedFirestoreIfEmpty();
      const id = generateNumericId();
      const item = {
        id,
        title: truncateStr(payload.title, 200) || 'নোটিশ',
        date: truncateStr(payload.date, 64) || '',
        time: truncateStr(payload.time, 64),
        location: truncateStr(payload.location, 200),
        description: truncateStr(payload.description, 3000),
        documentUrl: null,
        documentName: null,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'notices', String(id)), item);
      return {
        ...item,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  deleteNotice: async (id: number): Promise<{ ok: true }> => {
    const path = `notices/${id}`;
    try {
      await seedFirestoreIfEmpty();
      await deleteDoc(doc(db, 'notices', String(id)));
      return { ok: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  getNotifications: async (): Promise<ClubNotification[]> => {
    const path = 'notifications';
    try {
      const readSet = getLocalReadIds();
      const snap = await getDocs(query(collection(db, 'notifications'), where('id', '>', 0)));
      if (snap.empty && !(await isSeededInFirestore())) {
        return SEED_NOTIFICATIONS.map((n) => ({
          ...n,
          isRead: n.isRead || readSet.has(n.id),
        }));
      }
      return snap.docs
        .map((d) => {
          const n = d.data();
          const id = Number(n.id);
          return {
            id,
            title: String(n.title || ''),
            message: String(n.message || ''),
            type: (n.type === 'alert' || n.type === 'info' ? n.type : 'announcement') as
              | 'announcement'
              | 'alert'
              | 'info',
            isRead: Boolean(n.isRead) || readSet.has(id),
            createdAt: toIsoString(n.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  createNotification: async (payload: {
    title: string;
    message: string;
    type: 'announcement' | 'alert' | 'info';
  }): Promise<ClubNotification> => {
    const path = 'notifications';
    try {
      await seedFirestoreIfEmpty();
      const id = generateNumericId();
      const validType: 'announcement' | 'alert' | 'info' =
        payload.type === 'alert' || payload.type === 'info' ? payload.type : 'announcement';
      const title = truncateStr(payload.title, 200) || 'বিজ্ঞপ্তি';
      const message = truncateStr(payload.message, 2000) || '';
      await setDoc(doc(db, 'notifications', String(id)), {
        id,
        title,
        message,
        type: validType,
        isRead: false,
        createdAt: serverTimestamp(),
      });
      return {
        id,
        title,
        message,
        type: validType,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  markNotificationRead: async (id: number): Promise<void> => {
    addLocalReadId(id);
    if (await isCurrentUserAdmin()) {
      try {
        await seedFirestoreIfEmpty();
        await updateDoc(doc(db, 'notifications', String(id)), { isRead: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
      }
    }
  },

  deleteNotification: async (id: number): Promise<{ ok: true }> => {
    const path = `notifications/${id}`;
    try {
      await seedFirestoreIfEmpty();
      await deleteDoc(doc(db, 'notifications', String(id)));
      return { ok: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  getDonations: async (): Promise<DonationRecord[]> => {
    const path = 'donations';
    try {
      const snap = await getDocs(query(collection(db, 'donations'), where('id', '>', 0)));
      return snap.docs
        .map((d) => {
          const rec = d.data();
          return {
            id: Number(rec.id),
            donorName: String(rec.donorName || ''),
            method: (rec.method === 'নগদ' || rec.method === 'রকেট' ? rec.method : 'বিকাশ') as
              | 'বিকাশ'
              | 'নগদ'
              | 'রকেট',
            amount: Number(rec.amount || 0),
            transactionId: String(rec.transactionId || ''),
            phone: (rec.phone as string | null) ?? null,
            note: (rec.note as string | null) ?? null,
            status: (rec.status === 'verified' ? 'verified' : 'pending') as 'pending' | 'verified',
            createdAt: toIsoString(rec.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  submitDonation: async (payload: {
    donorName: string;
    method: 'বিকাশ' | 'নগদ' | 'রকেট';
    amount: number;
    transactionId: string;
    phone?: string;
    note?: string;
  }): Promise<DonationRecord> => {
    const path = 'donations';
    try {
      const id = generateNumericId();
      const amount = Math.min(10000000, Math.max(1, Number(payload.amount) || 1));
      const validMethod: 'বিকাশ' | 'নগদ' | 'রকেট' =
        payload.method === 'নগদ' || payload.method === 'রকেট' ? payload.method : 'বিকাশ';
      const donorName = truncateStr(payload.donorName, 150) || 'দাতা';
      const transactionId = truncateStr(payload.transactionId, 100) || '';
      const phone = truncateStr(payload.phone, 40);
      const note = truncateStr(payload.note, 500);
      await setDoc(doc(db, 'donations', String(id)), {
        id,
        donorName,
        method: validMethod,
        amount,
        transactionId,
        phone,
        note,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id,
        donorName,
        method: validMethod,
        amount,
        transactionId,
        phone,
        note,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateDonationStatus: async (id: number, status: 'pending' | 'verified'): Promise<void> => {
    const path = `donations/${id}`;
    try {
      await updateDoc(doc(db, 'donations', String(id)), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteDonation: async (id: number): Promise<{ ok: true }> => {
    const path = `donations/${id}`;
    try {
      await deleteDoc(doc(db, 'donations', String(id)));
      return { ok: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  getMessages: async (): Promise<ContactMessage[]> => {
    const path = 'messages';
    try {
      const snap = await getDocs(query(collection(db, 'messages'), where('id', '>', 0)));
      return snap.docs
        .map((d) => {
          const m = d.data();
          return {
            id: Number(m.id),
            name: String(m.name || ''),
            email: String(m.email || ''),
            message: String(m.message || ''),
            createdAt: toIsoString(m.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  submitMessage: async (payload: {
    name: string;
    email: string;
    message: string;
  }): Promise<ContactMessage> => {
    const path = 'messages';
    try {
      const id = generateNumericId();
      const entry = {
        id,
        name: truncateStr(payload.name, 150) || 'ব্যবহারকারী',
        email: truncateStr(payload.email, 120) || 'no-email@example.com',
        message: truncateStr(payload.message, 2000) || '',
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'messages', String(id)), entry);
      return {
        ...entry,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  deleteMessage: async (id: number): Promise<{ ok: true }> => {
    const path = `messages/${id}`;
    try {
      await deleteDoc(doc(db, 'messages', String(id)));
      return { ok: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  signInWithGoogleAdmin: async (): Promise<{ email: string; displayName: string }> => {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (!user.emailVerified) {
      await signOut(auth);
      clearAdminAuth();
      throw new Error('আপনার Google ইমেইলটি ভেরিফাইড নয়');
    }
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      await signOut(auth);
      clearAdminAuth();
      throw new Error('এই অ্যাকাউন্টের এডমিন অনুমোদন নেই');
    }
    localStorage.setItem(ADMIN_FLAG_KEY, user.email || user.uid);
    await seedFirestoreIfEmpty();
    return {
      email: user.email || '',
      displayName: user.displayName || user.email || 'Admin',
    };
  },

  signOutAdmin: async (): Promise<void> => {
    clearAdminAuth();
    await signOut(auth);
  },

  checkAdminSession: async (): Promise<{ authenticated: boolean; username?: string; uid?: string }> => {
    const user = await waitForAuthReady();
    if (!user) {
      clearAdminAuth();
      throw new Error('লগইন করা নেই');
    }
    const ok = await isCurrentUserAdmin();
    if (!ok) {
      clearAdminAuth();
      throw new Error('এডমিন অনুমোদন নেই');
    }
    localStorage.setItem(ADMIN_FLAG_KEY, user.email || user.uid);
    await seedFirestoreIfEmpty();
    return {
      authenticated: true,
      username: user.displayName || user.email || 'Admin',
      uid: user.uid,
    };
  },

  listAdmins: async (): Promise<{ uid: string; email: string }[]> => {
    try {
      const snap = await getDocs(query(collection(db, 'admins'), where('role', '==', 'admin')));
      return snap.docs.map((d) => ({
        uid: String(d.data().uid || d.id),
        email: String(d.data().email || ''),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'admins');
    }
  },

  addAdminUser: async (uid: string, email: string): Promise<{ uid: string; email: string }> => {
    const cleanUid = truncateStr(uid, 128);
    const cleanEmail = truncateStr(email, 120);
    if (!cleanUid || !/^[a-zA-Z0-9_-]+$/.test(cleanUid) || !cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('সঠিক Firebase UID এবং ইমেইল প্রয়োজন');
    }
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        email: cleanEmail,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
      return { uid: cleanUid, email: cleanEmail };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `admins/${cleanUid}`);
    }
  },

  removeAdminUser: async (uid: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'admins', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
    }
  },
};
