// 데이터 계층 — 저장소: Google Drive (MOARC Portal 폴더), 일정: Google Calendar
import * as G from './google.js';
import { DEFAULT_SETTINGS, SEED_POSTS, BOARDS } from './seed.js';

export { BOARDS, DEFAULT_SETTINGS };

const ROOT_NAME = 'MOARC Portal (홈페이지 데이터)';
let folders = null;
let cache = {};
const TTL = 60 * 1000;

function cached(key, ttl, fn) {
  const c = cache[key];
  if (c && Date.now() - c.at < ttl) return c.value;
  const p = fn().then(v => { cache[key] = { value: Promise.resolve(v), at: Date.now() }; return v; })
    .catch(e => { delete cache[key]; throw e; });
  cache[key] = { value: p, at: Date.now() };
  return p;
}
export function invalidate(...keys) { keys.length ? keys.forEach(k => delete cache[k]) : (cache = {}); }
export function resetFolders() { folders = null; invalidate(); }

/** Drive 폴더 구조 보장: 루트 / 접수 / 접수첨부 / 공개자료실 */
export async function getFolders() {
  if (folders) return folders;
  const root = await G.ensureFolder('root', ROOT_NAME);
  const [apps, uploads, library] = await Promise.all([
    G.ensureFolder('applications', '01_온라인접수', root.id),
    G.ensureFolder('uploads', '02_접수첨부파일', root.id),
    G.ensureFolder('library', '03_공개자료실', root.id)
  ]);
  folders = { root, apps, uploads, library };
  return folders;
}

async function readData(key, fallback) {
  const { root } = await getFolders();
  const f = await G.findDataFile(key, root.id);
  if (!f) return fallback;
  try { return JSON.parse(await G.driveDownloadText(f.id)); } catch { return fallback; }
}
async function writeData(key, value) {
  const { root } = await getFolders();
  const f = await G.findDataFile(key, root.id);
  const content = JSON.stringify(value, null, 2);
  if (f) return G.driveUpdateText(f.id, content);
  return G.driveCreateText({ name: `${key}.json`, parents: [root.id], appProperties: { moarcData: key } }, content);
}

/* ---------------------------- 설정 ---------------------------- */
export async function getSettings({ fresh = false } = {}) {
  if (!(await G.isConnected())) return { ...DEFAULT_SETTINGS };
  if (fresh) invalidate('settings');
  return cached('settings', TTL, async () => ({ ...DEFAULT_SETTINGS, ...(await readData('settings', {})) }));
}
export async function saveSettings(patch) {
  const cur = await getSettings({ fresh: true });
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in patch) next[k] = patch[k];
  await writeData('settings', next);
  invalidate('settings');
  return next;
}
export function publicSettings(s) {
  const { forumName, forumDeadline, forumCapacity, applicantBase, applyOpen, contactEmail, mainNotice } = s;
  return { forumName, forumDeadline, forumCapacity, applicantBase, applyOpen, contactEmail, mainNotice };
}

/* ---------------------------- 게시판 ---------------------------- */
export async function getPosts({ fresh = false } = {}) {
  if (!(await G.isConnected())) return SEED_POSTS;
  if (fresh) invalidate('posts');
  return cached('posts', TTL, async () => {
    const data = await readData('posts', null);
    if (data) return data;
    await writeData('posts', SEED_POSTS); // 최초 연동 시 시드 이관
    return SEED_POSTS;
  });
}
export async function savePost(input, author) {
  const posts = [...(await getPosts({ fresh: true }))];
  if (!BOARDS[input.board]) throw Object.assign(new Error('게시판을 선택해 주세요.'), { status: 400 });
  const post = {
    id: input.id || 'p' + Date.now().toString(36),
    board: input.board,
    title: String(input.title || '').trim().slice(0, 200),
    summary: String(input.summary || '').trim().slice(0, 400),
    body: String(input.body || '').slice(0, 20000),
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
    pinned: !!input.pinned,
    attachments: Array.isArray(input.attachments) ? input.attachments.slice(0, 10).map(a => ({ name: String(a.name || '').slice(0, 200), url: String(a.url || '').slice(0, 500) })).filter(a => /^https?:\/\//.test(a.url)) : [],
    author: author || '',
    updatedAt: new Date().toISOString()
  };
  if (!post.title) throw Object.assign(new Error('제목을 입력해 주세요.'), { status: 400 });
  const i = posts.findIndex(p => p.id === post.id);
  if (i >= 0) posts[i] = { ...posts[i], ...post }; else posts.unshift(post);
  await writeData('posts', posts);
  invalidate('posts');
  return post;
}
export async function deletePost(id) {
  const posts = (await getPosts({ fresh: true })).filter(p => p.id !== id);
  await writeData('posts', posts);
  invalidate('posts');
}

/* ---------------------------- 온라인 접수 ---------------------------- */
function summaryOf(app) {
  const d = app.data || {};
  return {
    receipt: app.receipt, type: app.type, status: app.status, receivedAt: app.receivedAt,
    title: d.company || d.org || d.name || '', name: d.name || '', email: d.email || '', phone: d.phone || '',
    category: d.category || d.field || '', total: app.scores ? Object.values(app.scores).reduce((a, b) => a + (Number(b) || 0), 0) : null,
    files: (app.attachments || []).length
  };
}

export async function createApplication(app) {
  const { apps } = await getFolders();
  const file = await G.driveCreateText({
    name: `${app.receipt}_${(app.data.company || app.data.org || app.data.name || '').slice(0, 40)}.json`,
    parents: [apps.id],
    description: JSON.stringify(summaryOf(app)),
    appProperties: { moarcApp: '1', receipt: app.receipt }
  }, JSON.stringify(app, null, 2));
  invalidate('apps');
  return file;
}

export async function listApplications() {
  const { apps } = await getFolders();
  return cached('apps', 15 * 1000, async () => {
    const files = await G.driveList(`'${apps.id}' in parents and trashed=false`, { fields: 'id,name,createdTime,description,webViewLink' });
    return files.map(f => {
      let s = {};
      try { s = JSON.parse(f.description || '{}'); } catch { /* ignore */ }
      return { id: f.id, link: f.webViewLink, createdTime: f.createdTime, ...s };
    });
  });
}

export async function getApplication(id) {
  const { apps } = await getFolders();
  const meta = await G.driveGet(id, 'id,parents,webViewLink');
  if (!(meta.parents || []).includes(apps.id)) throw Object.assign(new Error('접수 건을 찾을 수 없습니다.'), { status: 404 });
  const app = JSON.parse(await G.driveDownloadText(id));
  return { id, link: meta.webViewLink, ...app };
}

export async function updateApplication(id, mutate) {
  const app = await getApplication(id);
  const { id: _i, link: _l, ...plain } = app;
  const next = mutate(plain) || plain;
  await G.driveUpdateText(id, JSON.stringify(next, null, 2), { description: JSON.stringify(summaryOf(next)) });
  invalidate('apps');
  return { id, ...next };
}

export async function deleteApplication(id) {
  await getApplication(id); // 소속 확인
  await G.driveDelete(id);
  invalidate('apps');
}

/* ---------------------------- 자료실 (공개 파일) ---------------------------- */
export async function listLibrary({ publicOnly = false } = {}) {
  if (!(await G.isConnected())) return [];
  const { library } = await getFolders();
  const files = await cached('library', TTL, () =>
    G.driveList(`'${library.id}' in parents and trashed=false`, { fields: 'id,name,mimeType,size,createdTime,description,webViewLink,webContentLink,appProperties' }));
  const list = files.map(f => ({
    id: f.id, name: f.name, mimeType: f.mimeType, size: Number(f.size || 0), createdTime: f.createdTime,
    description: f.description || '', category: (f.appProperties && f.appProperties.category) || '일반',
    public: !!(f.appProperties && f.appProperties.public === '1'),
    viewUrl: f.webViewLink, downloadUrl: f.webContentLink || `https://drive.google.com/uc?id=${f.id}&export=download`
  }));
  return publicOnly ? list.filter(f => f.public) : list;
}

/* ---------------------------- 일정 (Google Calendar) ---------------------------- */
export async function getCalendarId({ create = false } = {}) {
  const s = await getSettings();
  if (s.calendarId) return s.calendarId;
  if (!create) return null;
  const cal = await G.calendarCreate('MOARC PARTNERS 공개일정');
  await saveSettings({ calendarId: cal.id });
  return cal.id;
}

function mapEvent(e) {
  const allDay = !!(e.start && e.start.date);
  return {
    id: e.id,
    title: e.summary || '(제목 없음)',
    description: e.description || '',
    location: e.location || '',
    allDay,
    start: allDay ? e.start.date : (e.start && e.start.dateTime),
    end: allDay ? e.end.date : (e.end && e.end.dateTime),
    category: (e.extendedProperties && e.extendedProperties.shared && e.extendedProperties.shared.category) || '일정',
    link: e.htmlLink
  };
}

export async function listEvents({ from, to } = {}) {
  if (!(await G.isConnected())) return [];
  const calId = await getCalendarId();
  if (!calId) return [];
  const key = `events:${from}:${to}`;
  return cached(key, TTL, async () => (await G.eventsList(calId, { timeMin: from, timeMax: to })).map(mapEvent));
}

export function toGoogleEvent(input) {
  const ev = {
    summary: String(input.title || '').slice(0, 200),
    description: String(input.description || '').slice(0, 4000),
    location: String(input.location || '').slice(0, 300),
    extendedProperties: { shared: { category: String(input.category || '일정').slice(0, 30), moarc: '1' } }
  };
  if (input.allDay) {
    const endDate = input.endDate && input.endDate >= input.startDate ? input.endDate : input.startDate;
    const next = new Date(endDate + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
    ev.start = { date: input.startDate };
    ev.end = { date: next.toISOString().slice(0, 10) };
  } else {
    ev.start = { dateTime: `${input.startDate}T${input.startTime || '09:00'}:00+09:00`, timeZone: 'Asia/Seoul' };
    ev.end = { dateTime: `${input.endDate || input.startDate}T${input.endTime || input.startTime || '10:00'}:00+09:00`, timeZone: 'Asia/Seoul' };
  }
  return ev;
}
export { mapEvent };
