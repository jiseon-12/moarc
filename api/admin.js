// /api/admin?r=... — 관리자 API (Google 로그인 세션 필요)
import { send, ok, fail, readJson, query, baseUrl, originAllowed, clean, EMAIL_RE } from '../lib/http.js';
import { requireAdmin } from '../lib/session.js';
import * as G from '../lib/google.js';
import * as D from '../lib/data.js';
import { composeMail, TYPE_LABELS } from '../lib/mail.js';

const STATUSES = ['접수', '검토중', '선정', '보류', '미선정', '완료'];
const SCORE_KEYS = ['tech', 'market', 'biz', 'invest'];

async function need(connected) {
  if (!connected) throw Object.assign(new Error('Google 계정 연동이 필요합니다. [연동 설정]에서 연결해 주세요.'), { status: 409, code: 'NOT_CONNECTED' });
}

const routes = {
  /* ------------------------- 상태 / 대시보드 ------------------------- */
  async status(req, res, { connected }) {
    const out = { connected, folders: null, calendar: null, checks: {} };
    if (connected) {
      const f = await D.getFolders();
      out.folders = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { id: v.id, link: v.webViewLink }]));
      out.checks.drive = true;
      const calId = await D.getCalendarId().catch(() => null);
      out.calendar = calId ? { id: calId, link: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calId)}` } : null;
      out.checks.calendar = !!calId;
    }
    return ok(res, out);
  },

  async dashboard(req, res, { connected }) {
    await need(connected);
    const [apps, posts, events] = await Promise.all([
      D.listApplications(),
      D.getPosts(),
      D.listEvents({ from: new Date().toISOString(), to: new Date(Date.now() + 60 * 86400e3).toISOString() }).catch(() => [])
    ]);
    const byStatus = {}; const byType = {};
    apps.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; byType[a.type] = (byType[a.type] || 0) + 1; });
    const weekAgo = Date.now() - 7 * 86400e3;
    return ok(res, {
      totals: { apps: apps.length, newWeek: apps.filter(a => Date.parse(a.receivedAt) > weekAgo).length, posts: posts.length, events: events.length },
      byStatus, byType, recent: apps.slice(0, 8), upcoming: events.slice(0, 6),
      leaderboard: apps.filter(a => a.total != null).sort((a, b) => b.total - a.total).slice(0, 10)
    });
  },

  /* ------------------------- 온라인 접수 ------------------------- */
  async apps(req, res, { connected }) { await need(connected); return ok(res, { apps: await D.listApplications(), statuses: STATUSES, types: TYPE_LABELS }); },
  async app(req, res, { connected, q }) { await need(connected); return ok(res, { app: await D.getApplication(q.id) }); },
  async 'app-update'(req, res, { connected, body, user }) {
    await need(connected);
    const app = await D.updateApplication(String(body.id), (a) => {
      const log = [];
      if (body.status && STATUSES.includes(body.status) && body.status !== a.status) { log.push(`상태: ${a.status} → ${body.status}`); a.status = body.status; }
      if (body.scores && typeof body.scores === 'object') {
        a.scores = Object.fromEntries(SCORE_KEYS.map(k => [k, Math.max(0, Math.min(25, Number(body.scores[k]) || 0))]));
        log.push(`채점: ${Object.values(a.scores).reduce((x, y) => x + y, 0)}점`);
      }
      if (typeof body.memo === 'string') { a.memo = body.memo.slice(0, 5000); log.push('메모 수정'); }
      if (log.length) a.history = [...(a.history || []), { at: new Date().toISOString(), by: user.email, action: log.join(' · ') }];
      return a;
    });
    return ok(res, { app });
  },
  async 'app-delete'(req, res, { connected, body }) { await need(connected); await D.deleteApplication(String(body.id)); return ok(res); },

  /* ------------------------- 게시판 ------------------------- */
  async posts(req, res, { connected }) { return ok(res, { posts: await D.getPosts({ fresh: true }), boards: D.BOARDS, connected }); },
  async 'post-save'(req, res, { connected, body, user }) { await need(connected); return ok(res, { post: await D.savePost(body.post || {}, user.email) }); },
  async 'post-delete'(req, res, { connected, body }) { await need(connected); await D.deletePost(String(body.id)); return ok(res); },

  /* ------------------------- 일정 (Calendar) ------------------------- */
  async events(req, res, { connected, q }) {
    await need(connected);
    const calId = await D.getCalendarId({ create: true });
    const from = q.from ? new Date(q.from).toISOString() : new Date(Date.now() - 31 * 86400e3).toISOString();
    const to = q.to ? new Date(q.to).toISOString() : new Date(Date.now() + 365 * 86400e3).toISOString();
    D.invalidate();
    const items = (await G.eventsList(calId, { timeMin: from, timeMax: to })).map(D.mapEvent);
    return ok(res, { events: items, calendarId: calId });
  },
  async 'event-save'(req, res, { connected, body }) {
    await need(connected);
    const e = body.event || {};
    if (!e.title || !/^\d{4}-\d{2}-\d{2}$/.test(e.startDate || '')) return fail(res, 400, '제목과 시작일을 입력해 주세요.');
    const calId = await D.getCalendarId({ create: true });
    const ev = D.toGoogleEvent(e);
    const saved = e.id ? await G.eventPatch(calId, e.id, ev) : await G.eventInsert(calId, ev);
    D.invalidate();
    return ok(res, { event: D.mapEvent(saved) });
  },
  async 'event-delete'(req, res, { connected, body }) {
    await need(connected);
    const calId = await D.getCalendarId({ create: true });
    await G.eventDelete(calId, String(body.id));
    D.invalidate();
    return ok(res);
  },

  /* ------------------------- 자료실 (Drive) ------------------------- */
  async files(req, res, { connected }) { await need(connected); D.invalidate('library'); return ok(res, { files: await D.listLibrary() }); },
  async 'upload-session'(req, res, { connected, body }) {
    await need(connected);
    const size = Number(body.size);
    if (!(size > 0 && size <= 200 * 1024 * 1024)) return fail(res, 400, '파일은 200MB 이하만 업로드할 수 있습니다.');
    const { library } = await D.getFolders();
    const uploadUrl = await G.driveUploadSession({
      name: clean(body.name, 200) || 'file', mimeType: String(body.mimeType || 'application/octet-stream'), size,
      parentId: library.id, origin: req.headers.origin || baseUrl(req),
      description: clean(body.description, 500), appProperties: { category: clean(body.category, 30) || '일반', public: body.public ? '1' : '0' }
    });
    return ok(res, { uploadUrl });
  },
  async 'file-finalize'(req, res, { connected, body }) {
    await need(connected);
    const meta = await G.driveGet(String(body.id), 'id,parents,appProperties');
    const { library } = await D.getFolders();
    if (!(meta.parents || []).includes(library.id)) return fail(res, 404, '파일을 찾을 수 없습니다.');
    const isPublic = !!body.public;
    await G.driveSetPublic(meta.id, isPublic);
    await G.driveUpdateMeta(meta.id, {
      appProperties: { public: isPublic ? '1' : '0', ...(body.category ? { category: clean(body.category, 30) } : {}) },
      ...(typeof body.description === 'string' ? { description: clean(body.description, 500) } : {})
    });
    D.invalidate('library');
    return ok(res);
  },
  async 'file-delete'(req, res, { connected, body }) {
    await need(connected);
    const meta = await G.driveGet(String(body.id), 'id,parents');
    const f = await D.getFolders();
    if (!(meta.parents || []).some(p => [f.library.id, f.uploads.id].includes(p))) return fail(res, 404, '파일을 찾을 수 없습니다.');
    await G.driveDelete(meta.id);
    D.invalidate('library');
    return ok(res);
  },

  /* ------------------------- 메일 (Gmail) ------------------------- */
  async 'mail-send'(req, res, { connected, body, user }) {
    await need(connected);
    const subject = clean(body.subject, 200);
    const text = String(body.body || '').slice(0, 20000);
    if (!subject || !text.trim()) return fail(res, 400, '제목과 내용을 입력해 주세요.');
    const targets = [];
    for (const id of (Array.isArray(body.appIds) ? body.appIds : []).slice(0, 200)) {
      const app = await D.getApplication(String(id)).catch(() => null);
      if (app && EMAIL_RE.test(app.data.email || '')) targets.push({ email: app.data.email, name: app.data.name, appId: id });
    }
    for (const raw of String(body.to || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 200)) {
      if (!EMAIL_RE.test(raw)) return fail(res, 400, `이메일 주소 형식 오류: ${raw}`);
      targets.push({ email: raw, name: '' });
    }
    if (!targets.length) return fail(res, 400, '받는 사람을 지정해 주세요.');
    const settings = await D.getSettings();
    const results = [];
    for (const t of targets) {
      try {
        const m = composeMail({ subject, body: text, name: t.name });
        await G.gmailSend({ to: t.email, cc: body.cc ? String(body.cc).split(',').map(s => s.trim()).filter(e => EMAIL_RE.test(e)) : undefined, replyTo: settings.contactEmail, ...m });
        results.push({ email: t.email, ok: true });
        if (t.appId) {
          await D.updateApplication(t.appId, (a) => {
            a.history = [...(a.history || []), { at: new Date().toISOString(), by: user.email, action: `메일 발송: ${subject}` }];
            return a;
          }).catch(() => {});
        }
      } catch (e) { results.push({ email: t.email, ok: false, error: e.message }); }
    }
    return ok(res, { sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), total: results.length });
  },

  /* ------------------------- 설정 ------------------------- */
  async settings(req, res) { return ok(res, { settings: await D.getSettings({ fresh: true }) }); },
  async 'settings-save'(req, res, { connected, body }) {
    await need(connected);
    const s = body.settings || {};
    const patch = {};
    if (s.forumName != null) patch.forumName = clean(s.forumName, 120);
    if (s.forumDeadline != null) { if (isNaN(Date.parse(s.forumDeadline))) return fail(res, 400, '마감 일시 형식이 올바르지 않습니다.'); patch.forumDeadline = s.forumDeadline; }
    if (s.forumCapacity != null) patch.forumCapacity = Math.max(1, Math.min(999, parseInt(s.forumCapacity, 10) || 7));
    if (s.applicantBase != null) patch.applicantBase = Math.max(0, Math.min(99999, parseInt(s.applicantBase, 10) || 0));
    if (s.applyOpen != null) patch.applyOpen = !!s.applyOpen;
    if (s.autoReply != null) patch.autoReply = !!s.autoReply;
    if (s.notifyEmails != null) patch.notifyEmails = String(s.notifyEmails).split(',').map(x => x.trim()).filter(e => EMAIL_RE.test(e)).join(', ');
    if (s.contactEmail != null) { if (!EMAIL_RE.test(s.contactEmail)) return fail(res, 400, '대표 이메일 형식을 확인해 주세요.'); patch.contactEmail = s.contactEmail.trim(); }
    if (s.mainNotice != null) patch.mainNotice = clean(s.mainNotice, 200);
    return ok(res, { settings: await D.saveSettings(patch) });
  },

  async 'test-mail'(req, res, { connected, user }) {
    await need(connected);
    await G.gmailSend({ to: user.email, ...composeMail({ subject: 'MOARC 관리자 — Gmail 연동 테스트', body: 'Gmail 연동이 정상적으로 동작합니다.\n\n이 메일은 관리자 모드의 [연동 설정 > 테스트 메일]에서 발송되었습니다.' }) });
    return ok(res);
  }
};

const WRITE = new Set(['app-update', 'app-delete', 'post-save', 'post-delete', 'event-save', 'event-delete', 'upload-session', 'file-finalize', 'file-delete', 'mail-send', 'settings-save', 'test-mail']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const q = query(req);
  const fn = routes[q.r];
  if (!fn) return fail(res, 404, 'unknown route');
  if (WRITE.has(q.r) && req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' }, { Allow: 'POST' });
  if (!originAllowed(req)) return fail(res, 403, '허용되지 않은 요청입니다.');
  try {
    const user = requireAdmin(req);
    const body = req.method === 'POST' ? await readJson(req, 256 * 1024) : {};
    const connected = await G.isConnected().catch(() => false);
    return await fn(req, res, { q, body, user, connected });
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    if (status >= 500) console.error('[admin]', q.r, e);
    const msg = e instanceof G.GoogleError && e.status === 401 ? 'Google 인증이 만료되었습니다. [연동 설정]에서 다시 연결해 주세요.' : e.message;
    const finalStatus = e instanceof G.GoogleError && (status === 401 || status === 403 && /invalid_grant|insufficient/i.test(e.message)) ? 502 : status;
    return fail(res, finalStatus, msg, e.code ? { code: e.code } : (e.detail && e.detail.code ? { code: e.detail.code } : {}));
  }
}
