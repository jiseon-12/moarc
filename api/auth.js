// /api/auth?a=login|connect|logout|me|disconnect — 관리자 인증 (Google 로그인)
import { send, ok, fail, redirect, query, baseUrl, readJson, clientIp, rateLimited, originAllowed } from '../lib/http.js';
import { createStateCookie, getSession, clearSessionCookie, adminEmails, requireAdmin, createSessionCookie, passwordLoginConfigured, checkPassword } from '../lib/session.js';
import { authUrl, googleConfigured, isConnected, resetTokenCache } from '../lib/google.js';
import { getRefreshToken, clearRefreshToken, kvAvailable, getConnectedAccount } from '../lib/token-store.js';
import { resetFolders } from '../lib/data.js';

export const redirectUri = (req) => baseUrl(req) + '/api/oauth-callback';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = query(req).a;
  try {
    if (a === 'me') {
      const s = getSession(req);
      const setup = {
        googleConfigured: googleConfigured(),
        adminEmailsSet: adminEmails().length > 0,
        sessionSecretSet: !!(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16),
        passwordLogin: passwordLoginConfigured()
      };
      if (!s) return send(res, 401, { ok: false, setup });
      const rt = await getRefreshToken().catch(() => ({}));
      return ok(res, {
        user: { email: s.email, name: s.name, method: s.method || 'google' }, setup,
        google: { connected: await isConnected().catch(() => false), account: await getConnectedAccount().catch(() => null), tokenSource: rt.source || null, kv: kvAvailable() },
        redirectUri: redirectUri(req)
      });
    }
    if (a === 'password') {
      if (req.method !== 'POST') return fail(res, 405, 'POST only');
      if (!originAllowed(req)) return fail(res, 403, '허용되지 않은 요청입니다.');
      if (!passwordLoginConfigured()) return fail(res, 400, '아이디·비밀번호 로그인이 설정되지 않았습니다. (ADMIN_ID / ADMIN_PASSWORD)');
      if (rateLimited('pw:' + clientIp(req), 5, 10 * 60 * 1000)) return fail(res, 429, '로그인 시도가 너무 많습니다. 10분 후 다시 시도해 주세요.');
      const b = await readJson(req, 4096).catch(() => ({}));
      if (!checkPassword(b.id, b.password)) return fail(res, 401, '아이디 또는 비밀번호가 올바르지 않습니다.');
      return ok(res, {}, { 'Set-Cookie': createSessionCookie(req, { email: process.env.ADMIN_ID, name: '관리자' }, 'password') });
    }
    if (a === 'login' || a === 'connect') {
      if (!googleConfigured()) return send(res, 500, 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 환경변수가 설정되지 않았습니다.');
      let hint;
      if (a === 'connect') {
        const s = getSession(req);
        if (!s) return redirect(res, '/admin');
        hint = /@/.test(s.email) ? s.email : undefined;
      }
      const { nonce, header } = createStateCookie(req, { mode: a });
      return redirect(res, authUrl({ redirectUri: redirectUri(req), state: nonce, connect: a === 'connect', loginHint: hint }), { 'Set-Cookie': header });
    }
    if (a === 'logout') {
      return redirect(res, '/admin', { 'Set-Cookie': clearSessionCookie(req) });
    }
    if (a === 'disconnect') {
      if (req.method !== 'POST') return fail(res, 405, 'POST only');
      requireAdmin(req);
      await clearRefreshToken();
      resetTokenCache();
      resetFolders();
      return ok(res, { envToken: !!process.env.GOOGLE_REFRESH_TOKEN });
    }
    return fail(res, 400, 'unknown action');
  } catch (e) {
    return fail(res, e.status || 500, e.message);
  }
}
