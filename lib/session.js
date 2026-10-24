// 관리자 세션 (HMAC 서명 쿠키) · OAuth state
import crypto from 'node:crypto';

const COOKIE = 'moarc_admin';
const STATE_COOKIE = 'moarc_oauth';
const TTL_SEC = 12 * 3600;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw Object.assign(new Error('SESSION_SECRET 환경변수(16자 이상)가 필요합니다.'), { status: 500, code: 'NO_SECRET' });
  return s;
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function seal(obj) {
  const data = b64u(JSON.stringify(obj));
  return data + '.' + sign(data);
}
export function unseal(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expect = sign(data);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const obj = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (obj.exp && obj.exp < Date.now() / 1000) return null;
    return obj;
  } catch { return null; }
}

export function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function cookie(name, value, maxAge, req) {
  const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') || process.env.NODE_ENV === 'production';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
/** 아이디·비밀번호 로그인 (ADMIN_ID / ADMIN_PASSWORD 환경변수) */
export function passwordLoginConfigured() {
  return !!(process.env.ADMIN_ID && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8);
}
export function checkPassword(id, password) {
  if (!passwordLoginConfigured()) return false;
  const h = (v) => crypto.createHash('sha256').update(String(v || '')).digest();
  const idOk = crypto.timingSafeEqual(h(id), h(process.env.ADMIN_ID));
  const pwOk = crypto.timingSafeEqual(h(password), h(process.env.ADMIN_PASSWORD));
  return idOk && pwOk;
}

export function isAdminEmail(email) {
  return !!email && adminEmails().includes(String(email).toLowerCase());
}

export function createSessionCookie(req, user, method = 'google') {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  return cookie(COOKIE, seal({ email: user.email, name: user.name || '', method, exp }), TTL_SEC, req);
}
export function clearSessionCookie(req) {
  return cookie(COOKIE, '', 0, req);
}
export function getSession(req) {
  const s = unseal(parseCookies(req)[COOKIE]);
  if (!s) return null;
  if (s.method === 'password') return passwordLoginConfigured() && s.email === process.env.ADMIN_ID ? s : null;
  return isAdminEmail(s.email) ? s : null;
}

export function createStateCookie(req, payload) {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const nonce = crypto.randomBytes(16).toString('base64url');
  return { nonce, header: cookie(STATE_COOKIE, seal({ ...payload, nonce, exp }), 600, req) };
}
export function readStateCookie(req) {
  return unseal(parseCookies(req)[STATE_COOKIE]);
}
export function clearStateCookie(req) {
  return cookie(STATE_COOKIE, '', 0, req);
}

/** 관리자 API 요청 검증: 세션 + CSRF 헤더 + Origin */
export function requireAdmin(req) {
  const s = getSession(req);
  if (!s) throw Object.assign(new Error('관리자 로그인이 필요합니다.'), { status: 401 });
  if (req.method !== 'GET' && req.headers['x-moarc-admin'] !== '1') {
    throw Object.assign(new Error('잘못된 요청입니다.'), { status: 403 });
  }
  return s;
}
