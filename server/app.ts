import express, { type NextFunction, type Request, type Response } from 'express';
import { hashPassword, store, verifyPassword } from './db.ts';

interface AdminContext {
  adminId: number;
  username: string;
  token: string;
}

interface AuthenticatedRequest extends Request {
  admin?: AdminContext;
}

function extractBearerToken(req: Request): string {
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

async function resolveOptionalAdmin(req: Request): Promise<AdminContext | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  const session = await store.verifySession(token);
  if (!session) return null;
  return { ...session, token };
}

function asyncRoute(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const requireAdmin = asyncRoute(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const admin = await resolveOptionalAdmin(req);
    if (!admin) {
      res.status(401).json({ error: 'অননুমোদিত প্রবেশাধিকার। অনুগ্রহ করে লগইন করুন।' });
      return;
    }
    req.admin = admin;
    next();
  }
);

function parsePositiveInt(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function sanitizeOptStr(val: unknown, maxLen: number): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

function sanitizeHttpUrl(val: unknown, maxLen = 500): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim().slice(0, maxLen);
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeLogoOrPhotoUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/')) {
    return trimmed.slice(0, 300);
  }
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= 400000 ? trimmed : null;
  }
  return sanitizeHttpUrl(trimmed, 1000);
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get(
    '/api/health',
    asyncRoute(async (_req, res) => {
      const postgres = await store.isPostgresActive();
      res.json({ ok: true, storage: postgres ? 'neon-postgres' : 'local-json' });
    })
  );

  // Public site settings
  app.get(
    '/api/settings',
    asyncRoute(async (_req, res) => {
      const settings = await store.getSettings();
      res.json(settings);
    })
  );

  app.put(
    '/api/settings',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { logoUrl, appDownloadLink } = req.body ?? {};
      const payload: { logoUrl?: string | null; appDownloadLink?: string | null } = {};
      if (logoUrl !== undefined) {
        payload.logoUrl = logoUrl ? sanitizeLogoOrPhotoUrl(logoUrl) : null;
      }
      if (appDownloadLink !== undefined) {
        if (typeof appDownloadLink === 'string' && appDownloadLink.trim()) {
          const validUrl = sanitizeHttpUrl(appDownloadLink);
          if (!validUrl) {
            res.status(400).json({ error: 'সঠিক http:// বা https:// ডাউনলোড লিংক প্রদান করুন' });
            return;
          }
          payload.appDownloadLink = validUrl;
        } else {
          payload.appDownloadLink = null;
        }
      }
      const updated = await store.updateSettings(payload);
      res.json(updated);
    })
  );

  // Serverless-safe image validation endpoint returning compressed dataUrl for DB storage
  app.post(
    '/api/upload',
    asyncRoute(async (req, res) => {
      const { dataUrl } = req.body ?? {};
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        res.status(400).json({ error: 'সঠিক ফাইল ফরম্যাট প্রদান করুন' });
        return;
      }
      const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
        dataUrl
      );
      if (!match) {
        res.status(400).json({ error: 'কেবলমাত্র PNG, JPG, WEBP বা GIF ছবি আপলোড করা যাবে' });
        return;
      }
      const buf = Buffer.from(match[2], 'base64');
      if (buf.length > 400 * 1024) {
        res.status(400).json({ error: 'ছবির আকার ৪০০ কিলোবাইটের কম হতে হবে' });
        return;
      }
      res.json({ url: dataUrl });
    })
  );

  // Members API
  app.get(
    '/api/members',
    asyncRoute(async (req, res) => {
      const admin = await resolveOptionalAdmin(req);
      const includePrivate = Boolean(admin) && req.query.includePrivate === '1';
      const members = await store.getMembers(includePrivate);
      res.json(members);
    })
  );

  app.get(
    '/api/members/:id',
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'সদস্য আইডি সঠিক নয়' });
        return;
      }
      const admin = await resolveOptionalAdmin(req);
      const member = await store.getMember(id, Boolean(admin));
      if (!member) {
        res.status(404).json({ error: 'সদস্য পাওয়া যায়নি' });
        return;
      }
      res.json(member);
    })
  );

  app.post(
    '/api/members',
    asyncRoute(async (req, res) => {
      const body = req.body ?? {};
      const name = sanitizeOptStr(body.name, 150) || '';
      const profession = sanitizeOptStr(body.profession, 120) || '';
      const area = sanitizeOptStr(body.area, 150) || '';
      const age = Number(body.age);

      if (!name || !profession || !area || !Number.isFinite(age) || age < 14 || age > 100) {
        res.status(400).json({ error: 'নাম, সঠিক বয়স (১৪-১০০), পেশা এবং এলাকা আবশ্যক' });
        return;
      }

      const requestedNumber = sanitizeOptStr(body.memberNumber, 32) ?? undefined;
      const newMember = await store.createMember({
        memberNumber: requestedNumber,
        name,
        age: Math.round(age),
        profession,
        area,
        education: sanitizeOptStr(body.education, 200),
        phone: sanitizeOptStr(body.phone, 40),
        email: sanitizeOptStr(body.email, 120),
        hobbies: sanitizeOptStr(body.hobbies, 300),
        about: sanitizeOptStr(body.about, 1000),
        photoUrl: sanitizeLogoOrPhotoUrl(body.photoUrl),
        photoVisibility: body.photoVisibility === 'hide' ? 'hide' : 'show',
      });
      res.status(201).json(newMember);
    })
  );

  app.put(
    '/api/members/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'সদস্য আইডি সঠিক নয়' });
        return;
      }
      const body = req.body ?? {};
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = sanitizeOptStr(body.name, 150) || undefined;
      if (body.age !== undefined && Number.isFinite(Number(body.age))) {
        patch.age = Math.min(100, Math.max(14, Math.round(Number(body.age))));
      }
      if (body.profession !== undefined) {
        patch.profession = sanitizeOptStr(body.profession, 120) || undefined;
      }
      if (body.area !== undefined) patch.area = sanitizeOptStr(body.area, 150) || undefined;
      if (body.education !== undefined) patch.education = sanitizeOptStr(body.education, 200);
      if (body.phone !== undefined) patch.phone = sanitizeOptStr(body.phone, 40);
      if (body.email !== undefined) patch.email = sanitizeOptStr(body.email, 120);
      if (body.hobbies !== undefined) patch.hobbies = sanitizeOptStr(body.hobbies, 300);
      if (body.about !== undefined) patch.about = sanitizeOptStr(body.about, 1000);
      if (body.photoUrl !== undefined) {
        patch.photoUrl = body.photoUrl ? sanitizeLogoOrPhotoUrl(body.photoUrl) : null;
      }
      if (body.photoVisibility === 'hide' || body.photoVisibility === 'show') {
        patch.photoVisibility = body.photoVisibility;
      }
      if (body.memberNumber !== undefined) {
        patch.memberNumber = sanitizeOptStr(body.memberNumber, 32) || undefined;
      }

      const updated = await store.updateMember(id, patch);
      if (!updated) {
        res.status(404).json({ error: 'সদস্য পাওয়া যায়নি' });
        return;
      }
      res.json(updated);
    })
  );

  app.delete(
    '/api/members/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'সদস্য আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteMember(id);
      if (!ok) {
        res.status(404).json({ error: 'সদস্য পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // Committees API
  app.get(
    '/api/committees',
    asyncRoute(async (_req, res) => {
      const committees = await store.getCommittees();
      res.json(committees);
    })
  );

  app.get(
    '/api/committees/:id',
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'কমিটি আইডি সঠিক নয়' });
        return;
      }
      const committee = await store.getCommittee(id);
      if (!committee) {
        res.status(404).json({ error: 'কমিটি পাওয়া যায়নি' });
        return;
      }
      res.json(committee);
    })
  );

  app.post(
    '/api/committees',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const name = sanitizeOptStr(req.body?.name, 150) || '';
      const description = sanitizeOptStr(req.body?.description, 1000);
      if (!name) {
        res.status(400).json({ error: 'কমিটির নাম প্রয়োজন' });
        return;
      }
      const committee = await store.createCommittee(name, description);
      res.status(201).json(committee);
    })
  );

  app.delete(
    '/api/committees/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'কমিটি আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteCommittee(id);
      if (!ok) {
        res.status(404).json({ error: 'কমিটি পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/committee-members',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { committeeId, memberId, memberName, position } = req.body ?? {};
      const cId = parsePositiveInt(committeeId);
      const pos = sanitizeOptStr(position, 150) || '';
      if (!cId || !pos) {
        res.status(400).json({ error: 'কমিটি এবং পদবি আবশ্যক' });
        return;
      }
      const mId = memberId ? parsePositiveInt(memberId) : null;
      const result = await store.addCommitteeMember({
        committeeId: cId,
        memberId: mId,
        memberName: sanitizeOptStr(memberName, 150) || '',
        position: pos,
      });
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(201).json(result);
    })
  );

  app.put(
    '/api/committee-members/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      const pos = sanitizeOptStr(req.body?.position, 150) || '';
      if (!id || !pos) {
        res.status(400).json({ error: 'সঠিক তথ্য প্রদান করুন' });
        return;
      }
      const updated = await store.updateCommitteeMember(id, pos);
      if (!updated) {
        res.status(404).json({ error: 'কমিটি সদস্য পাওয়া যায়নি' });
        return;
      }
      res.json(updated);
    })
  );

  app.delete(
    '/api/committee-members/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteCommitteeMember(id);
      if (!ok) {
        res.status(404).json({ error: 'কমিটি সদস্য পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // Events API
  app.get(
    '/api/events',
    asyncRoute(async (_req, res) => {
      res.json(await store.getEvents());
    })
  );

  app.post(
    '/api/events',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const title = sanitizeOptStr(req.body?.title, 200) || '';
      const date = sanitizeOptStr(req.body?.date, 64) || '';
      const time = sanitizeOptStr(req.body?.time, 64) || '';
      const location = sanitizeOptStr(req.body?.location, 200) || '';
      const description = sanitizeOptStr(req.body?.description, 2000);
      if (!title || !date || !time || !location) {
        res.status(400).json({ error: 'শিরোনাম, তারিখ, সময় এবং স্থান আবশ্যক' });
        return;
      }
      const created = await store.createEvent({ title, date, time, location, description });
      res.status(201).json(created);
    })
  );

  app.delete(
    '/api/events/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteEvent(id);
      if (!ok) {
        res.status(404).json({ error: 'ইভেন্ট পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // Notices API
  app.get(
    '/api/notices',
    asyncRoute(async (_req, res) => {
      res.json(await store.getNotices());
    })
  );

  app.post(
    '/api/notices',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const title = sanitizeOptStr(req.body?.title, 200) || '';
      const date = sanitizeOptStr(req.body?.date, 64) || '';
      const time = sanitizeOptStr(req.body?.time, 64);
      const location = sanitizeOptStr(req.body?.location, 200);
      const description = sanitizeOptStr(req.body?.description, 3000);
      if (!title || !date) {
        res.status(400).json({ error: 'নোটিশের শিরোনাম ও তারিখ আবশ্যক' });
        return;
      }
      const created = await store.createNotice({ title, date, time, location, description });
      res.status(201).json(created);
    })
  );

  app.delete(
    '/api/notices/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteNotice(id);
      if (!ok) {
        res.status(404).json({ error: 'নোটিশ পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // Notifications API
  app.get(
    '/api/notifications',
    asyncRoute(async (_req, res) => {
      res.json(await store.getNotifications());
    })
  );

  app.post(
    '/api/notifications',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const title = sanitizeOptStr(req.body?.title, 200) || '';
      const message = sanitizeOptStr(req.body?.message, 2000) || '';
      if (!title || !message) {
        res.status(400).json({ error: 'শিরোনাম ও বার্তা আবশ্যক' });
        return;
      }
      const type =
        req.body?.type === 'alert' || req.body?.type === 'info'
          ? req.body.type
          : 'announcement';
      const created = await store.createNotification({ title, message, type });
      res.status(201).json(created);
    })
  );

  app.post(
    '/api/notifications/:id/read',
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const updated = await store.markNotificationRead(id);
      if (!updated) {
        res.status(404).json({ error: 'বিজ্ঞপ্তি পাওয়া যায়নি' });
        return;
      }
      res.json(updated);
    })
  );

  app.delete(
    '/api/notifications/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteNotification(id);
      if (!ok) {
        res.status(404).json({ error: 'বিজ্ঞপ্তি পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // Donations API
  app.get(
    '/api/donations',
    requireAdmin,
    asyncRoute(async (_req, res) => {
      res.json(await store.getDonations());
    })
  );

  app.post(
    '/api/donations',
    asyncRoute(async (req, res) => {
      const donorName = sanitizeOptStr(req.body?.donorName, 150) || '';
      const transactionId = sanitizeOptStr(req.body?.transactionId, 100) || '';
      const parsedAmount = Number(req.body?.amount);
      if (
        !donorName ||
        !transactionId ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0 ||
        parsedAmount > 10000000
      ) {
        res.status(400).json({ error: 'দাতার নাম, সঠিক পরিমাণ এবং ট্রানজেকশন আইডি আবশ্যক' });
        return;
      }
      const validMethod =
        req.body?.method === 'নগদ' || req.body?.method === 'রকেট' ? req.body.method : 'বিকাশ';
      const created = await store.createDonation({
        donorName,
        method: validMethod,
        amount: Math.round(parsedAmount),
        transactionId,
        phone: sanitizeOptStr(req.body?.phone, 40),
        note: sanitizeOptStr(req.body?.note, 500),
      });
      res.status(201).json(created);
    })
  );

  app.patch(
    '/api/donations/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const status = req.body?.status === 'verified' ? 'verified' : 'pending';
      const updated = await store.updateDonationStatus(id, status);
      if (!updated) {
        res.status(404).json({ error: 'ডোনেশন তথ্য পাওয়া যায়নি' });
        return;
      }
      res.json(updated);
    })
  );

  app.delete(
    '/api/donations/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteDonation(id);
      if (!ok) {
        res.status(404).json({ error: 'ডোনেশন তথ্য পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // Contact messages API
  app.get(
    '/api/messages',
    requireAdmin,
    asyncRoute(async (_req, res) => {
      res.json(await store.getMessages());
    })
  );

  app.post(
    '/api/messages',
    asyncRoute(async (req, res) => {
      const name = sanitizeOptStr(req.body?.name, 150) || '';
      const email = sanitizeOptStr(req.body?.email, 120) || '';
      const message = sanitizeOptStr(req.body?.message, 2000) || '';
      if (!name || !email.includes('@') || !message) {
        res.status(400).json({ error: 'সঠিক নাম, ইমেইল এবং বার্তা লিখুন' });
        return;
      }
      const created = await store.createMessage({ name, email, message });
      res.status(201).json(created);
    })
  );

  app.delete(
    '/api/messages/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'আইডি সঠিক নয়' });
        return;
      }
      const ok = await store.deleteMessage(id);
      if (!ok) {
        res.status(404).json({ error: 'বার্তা পাওয়া যায়নি' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // Admin Auth API
  app.post(
    '/api/admin/login',
    asyncRoute(async (req, res) => {
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!username || !password) {
        res.status(400).json({ error: 'অনুগ্রহ করে সকল ক্ষেত্র পূরণ করুন' });
        return;
      }
      const admin = await store.findAdminByUsername(username);
      if (!admin || !verifyPassword(password, admin.passwordHash)) {
        res.status(401).json({ error: 'ব্যবহারকারীর নাম বা পাসওয়ার্ড ভুল' });
        return;
      }
      const token = await store.createSession(admin.id, admin.username);
      res.json({ token, username: admin.username });
    })
  );

  app.post(
    '/api/admin/logout',
    asyncRoute(async (req, res) => {
      const token = extractBearerToken(req);
      if (token) {
        await store.deleteSession(token);
      }
      res.json({ ok: true });
    })
  );

  app.get('/api/admin/session', requireAdmin, (req: AuthenticatedRequest, res) => {
    res.json({ authenticated: true, username: req.admin?.username });
  });

  app.get(
    '/api/admin/users',
    requireAdmin,
    asyncRoute(async (_req, res) => {
      res.json(await store.listAdmins());
    })
  );

  app.post(
    '/api/admin/change-password',
    requireAdmin,
    asyncRoute(async (req: AuthenticatedRequest, res) => {
      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!currentPassword || newPassword.length < 6 || newPassword.length > 128) {
        res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
        return;
      }
      const admin = req.admin ? await store.findAdminById(req.admin.adminId) : null;
      if (!admin || !verifyPassword(currentPassword, admin.passwordHash)) {
        res.status(401).json({ error: 'বর্তমান পাসওয়ার্ড সঠিক নয়' });
        return;
      }
      await store.updateAdminPassword(admin.id, hashPassword(newPassword));
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/admin/users',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const username = sanitizeOptStr(req.body?.username, 64) || '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!username || !/^[a-zA-Z0-9_.-]+$/.test(username) || password.length < 6 || password.length > 128) {
        res.status(400).json({ error: 'সঠিক ইউজারনেম এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড প্রয়োজন' });
        return;
      }
      const result = await store.createAdminUser(username, hashPassword(password));
      if ('conflict' in result) {
        res.status(409).json({ error: 'এই ইউজারনেম ইতিমধ্যে বিদ্যমান' });
        return;
      }
      res.status(201).json(result);
    })
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({ error: 'সার্ভারে সাময়িক ত্রুটি হয়েছে' });
  });

  return app;
}
