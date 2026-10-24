// Google REST 클라이언트 (의존성 없음): OAuth · Drive · Gmail · Calendar
import { getRefreshToken } from './token-store.js';

const BASE = {
  auth: process.env.GOOGLE_AUTH_BASE || 'https://accounts.google.com',
  oauth: process.env.GOOGLE_OAUTH_BASE || 'https://oauth2.googleapis.com',
  api: process.env.GOOGLE_API_BASE || 'https://www.googleapis.com',
  gmail: process.env.GOOGLE_GMAIL_BASE || 'https://gmail.googleapis.com'
};

export const SCOPES_LOGIN = ['openid', 'email', 'profile'];
export const SCOPES_CONNECT = [
  ...SCOPES_LOGIN,
  'https://www.googleapis.com/auth/gmail.send',            // 메일 발송만 (받은편지함 접근 X)
  'https://www.googleapis.com/auth/drive.file',            // 이 앱이 만든 파일만
  'https://www.googleapis.com/auth/calendar.app.created'   // 이 앱이 만든 캘린더만
];

export class GoogleError extends Error {
  constructor(message, status, detail) { super(message); this.status = status; this.detail = detail; }
}

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/* ------------------------------ OAuth ------------------------------ */
export function authUrl({ redirectUri, state, connect = false, loginHint }) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: (connect ? SCOPES_CONNECT : SCOPES_LOGIN).join(' '),
    state,
    include_granted_scopes: 'true',
    prompt: connect ? 'consent' : 'select_account'
  });
  if (connect) p.set('access_type', 'offline');
  if (loginHint) p.set('login_hint', loginHint);
  return `${BASE.auth}/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(params) {
  const res = await fetch(`${BASE.oauth}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...params
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(`token ${res.status}: ${data.error || ''} ${data.error_description || ''}`.trim(), res.status, data);
  return data;
}

export const exchangeCode = (code, redirectUri) =>
  tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });

export async function userInfo(accessToken) {
  const res = await fetch(`${BASE.api}/oauth2/v3/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new GoogleError(`userinfo ${res.status}`, res.status);
  return res.json();
}

let cached = { token: null, exp: 0, refresh: null };

export async function isConnected() {
  if (!googleConfigured()) return false;
  const { token } = await getRefreshToken();
  return !!token;
}

export async function accessToken() {
  const { token: refresh } = await getRefreshToken();
  if (!refresh) throw new GoogleError('Google 계정이 연동되지 않았습니다.', 503, { code: 'NOT_CONNECTED' });
  if (cached.token && cached.refresh === refresh && cached.exp - 60 > Date.now() / 1000) return cached.token;
  const data = await tokenRequest({ refresh_token: refresh, grant_type: 'refresh_token' });
  cached = { token: data.access_token, exp: Date.now() / 1000 + (data.expires_in || 3600), refresh };
  return cached.token;
}

export function resetTokenCache() { cached = { token: null, exp: 0, refresh: null }; }

async function g(url, { method = 'GET', json, body, headers = {}, raw = false } = {}) {
  const token = await accessToken();
  const h = { Authorization: `Bearer ${token}`, ...headers };
  if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const res = await fetch(url, { method, headers: h, body });
  if (raw) return res;
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.error && (data.error.message || data.error)) || text || res.statusText;
    throw new GoogleError(`Google API ${res.status}: ${msg}`, res.status, data);
  }
  return data;
}

/* ------------------------------ Drive ------------------------------ */
const DRIVE = () => `${BASE.api}/drive/v3`;
const UPLOAD = () => `${BASE.api}/upload/drive/v3`;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,mimeType,size,createdTime,modifiedTime,description,webViewLink,webContentLink,parents,appProperties';

const qEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function driveList(q, { fields = FILE_FIELDS, orderBy = 'createdTime desc', pageSize = 200 } = {}) {
  const out = [];
  let pageToken;
  do {
    const p = new URLSearchParams({ q, fields: `nextPageToken,files(${fields})`, orderBy, pageSize: String(pageSize), spaces: 'drive' });
    if (pageToken) p.set('pageToken', pageToken);
    const data = await g(`${DRIVE()}/files?${p}`);
    out.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken && out.length < 2000);
  return out;
}

export const driveGet = (id, fields = FILE_FIELDS) => g(`${DRIVE()}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`);

export async function driveDownloadText(id) {
  const res = await g(`${DRIVE()}/files/${encodeURIComponent(id)}?alt=media`, { raw: true });
  if (!res.ok) throw new GoogleError(`download ${res.status}`, res.status);
  return res.text();
}

export async function driveCreateFolder(name, parentId, appProperties = {}) {
  return g(`${DRIVE()}/files?fields=${encodeURIComponent(FILE_FIELDS)}`, {
    method: 'POST',
    json: { name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined, appProperties }
  });
}

function multipart(meta, content, mime) {
  const boundary = 'moarc' + Math.random().toString(36).slice(2);
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--`;
  return { body, type: `multipart/related; boundary=${boundary}` };
}

export async function driveCreateText(meta, content, mime = 'application/json') {
  const m = multipart(meta, content, mime);
  return g(`${UPLOAD()}/files?uploadType=multipart&fields=${encodeURIComponent(FILE_FIELDS)}`, {
    method: 'POST', body: m.body, headers: { 'Content-Type': m.type }
  });
}

export async function driveUpdateText(id, content, meta = {}, mime = 'application/json') {
  const m = multipart(meta, content, mime);
  return g(`${UPLOAD()}/files/${encodeURIComponent(id)}?uploadType=multipart&fields=${encodeURIComponent(FILE_FIELDS)}`, {
    method: 'PATCH', body: m.body, headers: { 'Content-Type': m.type }
  });
}

export const driveUpdateMeta = (id, meta, extra = '') =>
  g(`${DRIVE()}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(FILE_FIELDS)}${extra}`, { method: 'PATCH', json: meta });

export const driveDelete = (id) => g(`${DRIVE()}/files/${encodeURIComponent(id)}`, { method: 'DELETE' });

export async function driveSetPublic(id, makePublic) {
  if (makePublic) {
    return g(`${DRIVE()}/files/${encodeURIComponent(id)}/permissions`, { method: 'POST', json: { type: 'anyone', role: 'reader' } });
  }
  const perms = await g(`${DRIVE()}/files/${encodeURIComponent(id)}/permissions?fields=permissions(id,type)`);
  for (const p of (perms.permissions || []).filter(p => p.type === 'anyone')) {
    await g(`${DRIVE()}/files/${encodeURIComponent(id)}/permissions/${p.id}`, { method: 'DELETE' });
  }
  return null;
}

/** 브라우저가 직접 업로드할 수 있는 Resumable 세션 URL 생성 (CORS: origin 지정) */
export async function driveUploadSession({ name, mimeType, size, parentId, origin, appProperties, description }) {
  const res = await g(`${UPLOAD()}/files?uploadType=resumable&fields=${encodeURIComponent('id,name,size,mimeType,webViewLink')}`, {
    method: 'POST',
    raw: true,
    json: { name, mimeType, parents: [parentId], appProperties, description },
    headers: { 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size), ...(origin ? { Origin: origin } : {}) }
  });
  if (!res.ok) throw new GoogleError(`upload session ${res.status}: ${await res.text()}`, res.status);
  return res.headers.get('location');
}

/** appProperties 로 찾고 없으면 폴더 생성 */
export async function ensureFolder(key, name, parentId) {
  const q = `mimeType='${FOLDER_MIME}' and trashed=false and appProperties has { key='moarc' and value='${qEsc(key)}' }`;
  const found = await driveList(q, { fields: 'id,name,webViewLink', orderBy: 'createdTime' });
  if (found.length) return found[0];
  return driveCreateFolder(name, parentId, { moarc: key });
}

export async function findDataFile(key, parentId) {
  const q = `'${qEsc(parentId)}' in parents and trashed=false and appProperties has { key='moarcData' and value='${qEsc(key)}' }`;
  const found = await driveList(q, { fields: 'id,name,modifiedTime', orderBy: 'modifiedTime desc' });
  return found[0] || null;
}

/* ------------------------------ Gmail ------------------------------ */
const hdr = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim();
const encWord = (v) => `=?UTF-8?B?${Buffer.from(hdr(v), 'utf8').toString('base64')}?=`;

export function buildMime({ to, cc, bcc, subject, html, text, replyTo, fromName, fromEmail }) {
  const list = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map(hdr).join(', ');
  const boundary = 'moarcmail' + Math.random().toString(36).slice(2);
  const lines = [];
  if (fromEmail) lines.push(`From: ${fromName ? encWord(fromName) + ' ' : ''}<${hdr(fromEmail)}>`);
  lines.push(`To: ${list(to)}`);
  if (cc && list(cc)) lines.push(`Cc: ${list(cc)}`);
  if (bcc && list(bcc)) lines.push(`Bcc: ${list(bcc)}`);
  if (replyTo) lines.push(`Reply-To: ${hdr(replyTo)}`);
  lines.push(`Subject: ${encWord(subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '');
  const part = (type, content) => [
    `--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '',
    Buffer.from(content, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'), ''
  ].join('\r\n');
  return lines.join('\r\n') + '\r\n' + part('text/plain', text || html.replace(/<[^>]+>/g, '')) + part('text/html', html) + `--${boundary}--`;
}

export async function gmailSend(msg) {
  const raw = Buffer.from(buildMime(msg), 'utf8').toString('base64url');
  return g(`${BASE.gmail}/gmail/v1/users/me/messages/send`, { method: 'POST', json: { raw } });
}

/* ----------------------------- Calendar ----------------------------- */
const CAL = () => `${BASE.api}/calendar/v3`;

export const calendarCreate = (summary, timeZone = 'Asia/Seoul') =>
  g(`${CAL()}/calendars`, { method: 'POST', json: { summary, timeZone, description: 'MOARC PARTNERS 홈페이지 공개 일정 (관리자 모드에서 관리)' } });

export const calendarGet = (id) => g(`${CAL()}/calendars/${encodeURIComponent(id)}`);

export async function eventsList(calendarId, { timeMin, timeMax, max = 250 } = {}) {
  const p = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: String(max) });
  if (timeMin) p.set('timeMin', timeMin);
  if (timeMax) p.set('timeMax', timeMax);
  const data = await g(`${CAL()}/calendars/${encodeURIComponent(calendarId)}/events?${p}`);
  return data.items || [];
}
export const eventInsert = (calendarId, ev) => g(`${CAL()}/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', json: ev });
export const eventPatch = (calendarId, id, ev) => g(`${CAL()}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`, { method: 'PATCH', json: ev });
export const eventDelete = (calendarId, id) => g(`${CAL()}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
