// 공통 HTTP 유틸 (Vercel Node 함수용)

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined) return res.end();
  if (typeof body === 'string') {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(body);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

export const ok = (res, data = {}, headers) => send(res, 200, { ok: true, ...data }, headers);
export const fail = (res, status, error, extra = {}) => send(res, status, { ok: false, error, ...extra });

export function redirect(res, location, headers = {}) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end();
}

export async function readJson(req, limit = 64 * 1024) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://local').searchParams);
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown';
}

/** 사이트 기준 URL (PUBLIC_BASE_URL 우선, 없으면 요청 호스트) */
export function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = String(req.headers['x-forwarded-proto'] || (local ? 'http' : 'https')).split(',')[0];
  return `${proto}://${host}`;
}

/** 동일 출처 또는 허용 Origin 인지 */
export function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const allowed = (process.env.MOARC_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  try {
    const o = new URL(origin);
    if (o.host === host) return true;
    if (process.env.PUBLIC_BASE_URL && origin === process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')) return true;
    return allowed.includes(origin);
  } catch { return false; }
}

// 인스턴스 단위 best-effort 속도 제한
const buckets = new Map();
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 10000) buckets.clear();
  return list.length > max;
}

export const clean = (v, max = 2000) =>
  String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

export const escHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
export const PHONE_RE = /^[0-9+\-\s()]{8,20}$/;
export const URL_RE = /^https?:\/\/[^\s<>"]+$/i;

export function kstNow() {
  return new Date(Date.now() + 9 * 3600 * 1000);
}
