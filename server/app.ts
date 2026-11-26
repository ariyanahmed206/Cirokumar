import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { hashPassword, readDb, UPLOADS_DIR, verifyPassword, writeDb } from './db.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface TokenPayload {
  adminId: number;
  username: string;
  exp: number;
}

function signAdminToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAdminToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface AuthenticatedRequest extends Request {
  admin?: TokenPayload;
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const payload = token ? verifyAdminToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'অননুমোদিত প্রবেশাধিকার। অনুগ্রহ করে লগইন করুন।' });
    return;
  }
  req.admin = payload;
  next();
}

function parsePositiveInt(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/api/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Public site settings
  app.get('/api/settings', (_req, res) => {
    const db = readDb();
    res.json(db.settings);
  });

  app.put('/api/settings', requireAdmin, (req, res) => {
    const db = readDb();
    const { logoUrl, appDownloadLink } = req.body ?? {};
    if (logoUrl !== undefined) {
      db.settings.logoUrl = typeof logoUrl === 'string' && logoUrl.trim() ? logoUrl.trim() : null;
    }
    if (appDownloadLink !== undefined) {
      db.settings.appDownloadLink =
        typeof appDownloadLink === 'string' && appDownloadLink.trim() ? appDownloadLink.trim() : null;
    }
    writeDb(db);
    res.json(db.settings);
  });

  // Image / asset upload via JSON dataUrl
  app.post('/api/upload', (req, res) => {
    const { dataUrl, filename } = req.body ?? {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      res.status(400).json({ error: 'সঠিক ফাইল ফরম্যাট প্রদান করুন' });
      return;
    }
    const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'কেবলমাত্র PNG, JPG, WEBP বা GIF ছবি আপলোড করা যাবে' });
      return;
    }
    const mime = match[1];
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 4 * 1024 * 1024) {
      res.status(400).json({ error: 'ছবির আকার ৪ মেগাবাইটের কম হতে হবে' });
      return;
    }
    const safeBase =
      typeof filename === 'string'
        ? filename.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'photo'
        : 'photo';
    const outName = `${Date.now()}-${safeBase}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, outName), buf);
    res.json({ url: `/uploads/${outName}` });
  });

  // Members API
  app.get('/api/members', (_req, res) => {
    const db = readDb();
    const sorted = [...db.members].sort((a, b) => Number(a.memberNumber) - Number(b.memberNumber));
    res.json(sorted);
  });

  app.get('/api/members/:id', (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'সদস্য আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const member = db.members.find((m) => m.id === id);
    if (!member) {
      res.status(404).json({ error: 'সদস্য পাওয়া যায়নি' });
      return;
    }
    res.json(member);
  });

  app.post('/api/members', (req, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const profession = typeof body.profession === 'string' ? body.profession.trim() : '';
    const area = typeof body.area === 'string' ? body.area.trim() : '';
    const age = Number(body.age);

    if (!name || !profession || !area || !Number.isFinite(age) || age < 14 || age > 100) {
      res.status(400).json({ error: 'নাম, সঠিক বয়স (১৪-১০০), পেশা এবং এলাকা আবশ্যক' });
      return;
    }

    const db = readDb();
    const maxNumber = db.members.reduce((max, m) => Math.max(max, Number(m.memberNumber) || 0), 0);
    const id = ++db.nextId;
    const requestedNumber =
      typeof body.memberNumber === 'string' && body.memberNumber.trim()
        ? body.memberNumber.trim()
        : String(maxNumber + 1);

    const newMember = {
      id,
      memberNumber: requestedNumber,
      name,
      age,
      profession,
      area,
      education: typeof body.education === 'string' && body.education.trim() ? body.education.trim() : null,
      phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
      email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null,
      hobbies: typeof body.hobbies === 'string' && body.hobbies.trim() ? body.hobbies.trim() : null,
      about: typeof body.about === 'string' && body.about.trim() ? body.about.trim() : null,
      photoUrl: typeof body.photoUrl === 'string' && body.photoUrl.trim() ? body.photoUrl.trim() : null,
      photoVisibility: body.photoVisibility === 'hide' ? ('hide' as const) : ('show' as const),
      joinDate: new Date().toISOString(),
    };

    db.members.push(newMember);
    writeDb(db);
    res.status(201).json(newMember);
  });

  app.put('/api/members/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'সদস্য আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const idx = db.members.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'সদস্য পাওয়া যায়নি' });
      return;
    }
    const body = req.body ?? {};
    const prev = db.members[idx];
    db.members[idx] = {
      ...prev,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : prev.name,
      age: body.age !== undefined && Number.isFinite(Number(body.age)) ? Number(body.age) : prev.age,
      profession:
        typeof body.profession === 'string' && body.profession.trim() ? body.profession.trim() : prev.profession,
      area: typeof body.area === 'string' && body.area.trim() ? body.area.trim() : prev.area,
      education: body.education !== undefined ? (body.education || null) : prev.education,
      phone: body.phone !== undefined ? (body.phone || null) : prev.phone,
      email: body.email !== undefined ? (body.email || null) : prev.email,
      hobbies: body.hobbies !== undefined ? (body.hobbies || null) : prev.hobbies,
      about: body.about !== undefined ? (body.about || null) : prev.about,
      photoUrl: body.photoUrl !== undefined ? (body.photoUrl || null) : prev.photoUrl,
      photoVisibility:
        body.photoVisibility === 'hide' || body.photoVisibility === 'show'
          ? body.photoVisibility
          : prev.photoVisibility,
      memberNumber:
        typeof body.memberNumber === 'string' && body.memberNumber.trim()
          ? body.memberNumber.trim()
          : prev.memberNumber,
    };
    writeDb(db);
    res.json(db.members[idx]);
  });

  app.delete('/api/members/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'সদস্য আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const before = db.members.length;
    db.members = db.members.filter((m) => m.id !== id);
    if (db.members.length === before) {
      res.status(404).json({ error: 'সদস্য পাওয়া যায়নি' });
      return;
    }
    for (const c of db.committees) {
      c.committeeMembers = c.committeeMembers.filter((cm) => cm.memberId !== id);
    }
    writeDb(db);
    res.json({ ok: true });
  });

  // Committees API
  app.get('/api/committees', (_req, res) => {
    const db = readDb();
    const hydrated = db.committees.map((c) => ({
      ...c,
      committeeMembers: c.committeeMembers.map((cm) => {
        const matched = cm.memberId ? db.members.find((m) => m.id === cm.memberId) : null;
        return {
          ...cm,
          memberName: matched ? matched.name : cm.memberName,
          memberNumber: matched ? matched.memberNumber : cm.memberNumber ?? null,
          photoUrl:
            matched && matched.photoVisibility === 'hide'
              ? null
              : cm.photoUrl || matched?.photoUrl || null,
        };
      }),
    }));
    res.json(hydrated);
  });

  app.get('/api/committees/:id', (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'কমিটি আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const committee = db.committees.find((c) => c.id === id);
    if (!committee) {
      res.status(404).json({ error: 'কমিটি পাওয়া যায়নি' });
      return;
    }
    const members = committee.committeeMembers.map((cm) => {
      const matched = cm.memberId ? db.members.find((m) => m.id === cm.memberId) : null;
      return {
        ...cm,
        memberName: matched ? matched.name : cm.memberName,
        memberNumber: matched ? matched.memberNumber : cm.memberNumber ?? null,
        photoUrl:
          matched && matched.photoVisibility === 'hide'
            ? null
            : cm.photoUrl || matched?.photoUrl || null,
      };
    });
    res.json({ ...committee, committeeMembers: members });
  });

  app.post('/api/committees', requireAdmin, (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;
    if (!name) {
      res.status(400).json({ error: 'কমিটির নাম প্রয়োজন' });
      return;
    }
    const db = readDb();
    const committee = {
      id: ++db.nextId,
      name,
      description,
      previousCommitteeId: null,
      createdAt: new Date().toISOString(),
      committeeMembers: [],
    };
    db.committees.push(committee);
    writeDb(db);
    res.status(201).json(committee);
  });

  app.delete('/api/committees/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'কমিটি আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const before = db.committees.length;
    db.committees = db.committees.filter((c) => c.id !== id);
    if (db.committees.length === before) {
      res.status(404).json({ error: 'কমিটি পাওয়া যায়নি' });
      return;
    }
    writeDb(db);
    res.json({ ok: true });
  });

  app.post('/api/committee-members', requireAdmin, (req, res) => {
    const { committeeId, memberId, memberName, position } = req.body ?? {};
    const cId = parsePositiveInt(committeeId);
    const pos = typeof position === 'string' ? position.trim() : '';
    if (!cId || !pos) {
      res.status(400).json({ error: 'কমিটি এবং পদবি আবশ্যক' });
      return;
    }
    const db = readDb();
    const committee = db.committees.find((c) => c.id === cId);
    if (!committee) {
      res.status(404).json({ error: 'কমিটি পাওয়া যায়নি' });
      return;
    }
    const mId = memberId ? parsePositiveInt(memberId) : null;
    const matched = mId ? db.members.find((m) => m.id === mId) : null;
    const resolvedName = matched ? matched.name : typeof memberName === 'string' ? memberName.trim() : '';
    if (!resolvedName) {
      res.status(400).json({ error: 'সদস্যের নাম বা নির্বাচন প্রয়োজন' });
      return;
    }
    const entry = {
      id: ++db.nextId,
      committeeId: cId,
      memberId: matched ? matched.id : null,
      memberName: resolvedName,
      memberNumber: matched ? matched.memberNumber : null,
      position: pos,
      photoUrl: matched && matched.photoVisibility === 'show' ? matched.photoUrl ?? null : null,
    };
    committee.committeeMembers.push(entry);
    writeDb(db);
    res.status(201).json(entry);
  });

  app.put('/api/committee-members/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const pos = typeof req.body?.position === 'string' ? req.body.position.trim() : '';
    if (!id || !pos) {
      res.status(400).json({ error: 'সঠিক তথ্য প্রদান করুন' });
      return;
    }
    const db = readDb();
    for (const c of db.committees) {
      const target = c.committeeMembers.find((cm) => cm.id === id);
      if (target) {
        target.position = pos;
        writeDb(db);
        res.json(target);
        return;
      }
    }
    res.status(404).json({ error: 'কমিটি সদস্য পাওয়া যায়নি' });
  });

  app.delete('/api/committee-members/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    let removed = false;
    for (const c of db.committees) {
      const before = c.committeeMembers.length;
      c.committeeMembers = c.committeeMembers.filter((cm) => cm.id !== id);
      if (c.committeeMembers.length !== before) removed = true;
    }
    if (!removed) {
      res.status(404).json({ error: 'কমিটি সদস্য পাওয়া যায়নি' });
      return;
    }
    writeDb(db);
    res.json({ ok: true });
  });

  // Events API
  app.get('/api/events', (_req, res) => {
    const db = readDb();
    res.json([...db.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post('/api/events', requireAdmin, (req, res) => {
    const { title, date, time, location, description } = req.body ?? {};
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof date !== 'string' ||
      !date.trim() ||
      typeof time !== 'string' ||
      !time.trim() ||
      typeof location !== 'string' ||
      !location.trim()
    ) {
      res.status(400).json({ error: 'শিরোনাম, তারিখ, সময় এবং স্থান আবশ্যক' });
      return;
    }
    const db = readDb();
    const item = {
      id: ++db.nextId,
      title: title.trim(),
      date: date.trim(),
      time: time.trim(),
      location: location.trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
      createdAt: new Date().toISOString(),
    };
    db.events.unshift(item);
    writeDb(db);
    res.status(201).json(item);
  });

  app.delete('/api/events/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const before = db.events.length;
    db.events = db.events.filter((e) => e.id !== id);
    if (db.events.length === before) {
      res.status(404).json({ error: 'ইভেন্ট পাওয়া যায়নি' });
      return;
    }
    writeDb(db);
    res.json({ ok: true });
  });

  // Notices API
  app.get('/api/notices', (_req, res) => {
    const db = readDb();
    res.json([...db.notices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post('/api/notices', requireAdmin, (req, res) => {
    const { title, date, time, location, description } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || typeof date !== 'string' || !date.trim()) {
      res.status(400).json({ error: 'নোটিশের শিরোনাম ও তারিখ আবশ্যক' });
      return;
    }
    const db = readDb();
    const notice = {
      id: ++db.nextId,
      title: title.trim(),
      date: date.trim(),
      time: typeof time === 'string' && time.trim() ? time.trim() : null,
      location: typeof location === 'string' && location.trim() ? location.trim() : null,
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
      documentUrl: null,
      documentName: null,
      createdAt: new Date().toISOString(),
    };
    db.notices.unshift(notice);
    writeDb(db);
    res.status(201).json(notice);
  });

  app.delete('/api/notices/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const before = db.notices.length;
    db.notices = db.notices.filter((n) => n.id !== id);
    if (db.notices.length === before) {
      res.status(404).json({ error: 'নোটিশ পাওয়া যায়নি' });
      return;
    }
    writeDb(db);
    res.json({ ok: true });
  });

  // Notifications API
  app.get('/api/notifications', (_req, res) => {
    const db = readDb();
    res.json([...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post('/api/notifications', requireAdmin, (req, res) => {
    const { title, message, type } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'শিরোনাম ও বার্তা আবশ্যক' });
      return;
    }
    const validType = type === 'alert' || type === 'info' ? type : 'announcement';
    const db = readDb();
    const notif = {
      id: ++db.nextId,
      title: title.trim(),
      message: message.trim(),
      type: validType as 'announcement' | 'alert' | 'info',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    db.notifications.unshift(notif);
    writeDb(db);
    res.status(201).json(notif);
  });

  app.post('/api/notifications/:id/read', (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const target = db.notifications.find((n) => n.id === id);
    if (!target) {
      res.status(404).json({ error: 'বিজ্ঞপ্তি পাওয়া যায়নি' });
      return;
    }
    target.isRead = true;
    writeDb(db);
    res.json(target);
  });

  app.delete('/api/notifications/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const before = db.notifications.length;
    db.notifications = db.notifications.filter((n) => n.id !== id);
    if (db.notifications.length === before) {
      res.status(404).json({ error: 'বিজ্ঞপ্তি পাওয়া যায়নি' });
      return;
    }
    writeDb(db);
    res.json({ ok: true });
  });

  // Donations API
  app.get('/api/donations', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json([...db.donations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post('/api/donations', (req, res) => {
    const { donorName, method, amount, transactionId, phone, note } = req.body ?? {};
    const parsedAmount = Number(amount);
    if (
      typeof donorName !== 'string' ||
      !donorName.trim() ||
      typeof transactionId !== 'string' ||
      !transactionId.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      res.status(400).json({ error: 'দাতার নাম, পরিমাণ এবং ট্রানজেকশন আইডি আবশ্যক' });
      return;
    }
    const validMethod = method === 'নগদ' || method === 'রকেট' ? method : 'বিকাশ';
    const db = readDb();
    const record = {
      id: ++db.nextId,
      donorName: donorName.trim(),
      method: validMethod as 'বিকাশ' | 'নগদ' | 'রকেট',
      amount: parsedAmount,
      transactionId: transactionId.trim(),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };
    db.donations.unshift(record);
    writeDb(db);
    res.status(201).json(record);
  });

  app.patch('/api/donations/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    const target = db.donations.find((d) => d.id === id);
    if (!target) {
      res.status(404).json({ error: 'ডোনেশন তথ্য পাওয়া যায়নি' });
      return;
    }
    target.status = req.body?.status === 'verified' ? 'verified' : 'pending';
    writeDb(db);
    res.json(target);
  });

  app.delete('/api/donations/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    db.donations = db.donations.filter((d) => d.id !== id);
    writeDb(db);
    res.json({ ok: true });
  });

  // Contact messages API
  app.get('/api/messages', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json([...db.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post('/api/messages', (req, res) => {
    const { name, email, message } = req.body ?? {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof email !== 'string' ||
      !email.includes('@') ||
      typeof message !== 'string' ||
      !message.trim()
    ) {
      res.status(400).json({ error: 'সঠিক নাম, ইমেইল এবং বার্তা লিখুন' });
      return;
    }
    const db = readDb();
    const entry = {
      id: ++db.nextId,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };
    db.messages.unshift(entry);
    writeDb(db);
    res.status(201).json(entry);
  });

  app.delete('/api/messages/:id', requireAdmin, (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'আইডি সঠিক নয়' });
      return;
    }
    const db = readDb();
    db.messages = db.messages.filter((m) => m.id !== id);
    writeDb(db);
    res.json({ ok: true });
  });

  // Admin Auth API
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      res.status(400).json({ error: 'অনুগ্রহ করে সকল ক্ষেত্র পূরণ করুন' });
      return;
    }
    const db = readDb();
    const admin = db.admins.find((a) => a.username === username.trim());
    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      res.status(401).json({ error: 'ব্যবহারকারীর নাম বা পাসওয়ার্ড ভুল' });
      return;
    }
    const token = signAdminToken({
      adminId: admin.id,
      username: admin.username,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ token, username: admin.username });
  });

  app.get('/api/admin/session', requireAdmin, (req: AuthenticatedRequest, res) => {
    res.json({ authenticated: true, username: req.admin?.username });
  });

  app.post('/api/admin/change-password', requireAdmin, (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
      return;
    }
    const db = readDb();
    const admin = db.admins.find((a) => a.id === req.admin?.adminId);
    if (!admin || !verifyPassword(currentPassword, admin.passwordHash)) {
      res.status(401).json({ error: 'বর্তমান পাসওয়ার্ড সঠিক নয়' });
      return;
    }
    admin.passwordHash = hashPassword(newPassword);
    writeDb(db);
    res.json({ ok: true });
  });

  app.post('/api/admin/users', requireAdmin, (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'ইউজারনেম এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড প্রয়োজন' });
      return;
    }
    const db = readDb();
    if (db.admins.some((a) => a.username.toLowerCase() === username.trim().toLowerCase())) {
      res.status(409).json({ error: 'এই ইউজারনেম ইতিমধ্যে বিদ্যমান' });
      return;
    }
    const newAdmin = {
      id: ++db.nextId,
      username: username.trim(),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.admins.push(newAdmin);
    writeDb(db);
    res.status(201).json({ id: newAdmin.id, username: newAdmin.username });
  });

  return app;
}
