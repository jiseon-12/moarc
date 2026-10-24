// GET /api/oauth-callback — Google OAuth 리디렉션 URI
// Google Cloud Console의 "승인된 리디렉션 URI"에 https://<도메인>/api/oauth-callback 등록
import { send, redirect, query, baseUrl, escHtml } from '../lib/http.js';
import { readStateCookie, clearStateCookie, createSessionCookie, isAdminEmail, getSession } from '../lib/session.js';
import { exchangeCode, userInfo, resetTokenCache } from '../lib/google.js';
import { saveRefreshToken } from '../lib/token-store.js';
import { resetFolders } from '../lib/data.js';

function page(title, body) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escHtml(title)}</title>
<style>body{margin:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#EEF1F6;color:#1F2430;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
.box{background:#fff;border:1px solid #C9CDD3;border-radius:16px;max-width:640px;width:100%;padding:32px;box-shadow:0 10px 40px rgba(12,45,107,.08)}h1{font-size:20px;color:#0C2D6B;margin:0 0 12px}
p,li{line-height:1.7;font-size:14px}textarea{width:100%;box-sizing:border-box;font:13px monospace;padding:10px;border:1px solid #C9CDD3;border-radius:8px;background:#F7F9FC}
a.btn{display:inline-block;background:#1F6BFF;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;margin-top:12px}code{background:#EEF1F6;padding:2px 6px;border-radius:4px}</style></head>
<body><div class="box">${body}</div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = query(req);
  const clear = clearStateCookie(req);
  const st = readStateCookie(req);
  const html = (status, title, body) => { res.setHeader('Set-Cookie', clear); res.setHeader('Content-Type', 'text/html; charset=utf-8'); return send(res, status, page(title, body)); };

  if (q.error) return html(400, '로그인 취소', `<h1>Google 로그인이 취소되었습니다</h1><p>${escHtml(q.error)}</p><a class="btn" href="/admin">관리자 페이지로</a>`);
  if (!st || !q.state || q.state !== st.nonce || !q.code) return html(400, '잘못된 요청', '<h1>로그인 요청이 만료되었거나 올바르지 않습니다</h1><a class="btn" href="/admin">다시 시도</a>');

  try {
    const tokens = await exchangeCode(q.code, baseUrl(req) + '/api/oauth-callback');
    const info = await userInfo(tokens.access_token);
    const current = getSession(req);
    const pwAdminConnecting = st.mode === 'connect' && current && current.method === 'password';
    if (!info.email || info.email_verified === false || (!pwAdminConnecting && !isAdminEmail(info.email))) {
      return html(403, '접근 권한 없음', `<h1>관리자 권한이 없는 계정입니다</h1><p><code>${escHtml(info.email || '')}</code> 계정은 관리자 목록(ADMIN_EMAILS)에 없습니다.</p><a class="btn" href="/admin">다른 계정으로 로그인</a>`);
    }
    const session = pwAdminConnecting ? createSessionCookie(req, { email: current.email, name: current.name }, 'password') : createSessionCookie(req, { email: info.email, name: info.name });

    if (st.mode === 'connect') {
      if (!tokens.refresh_token) {
        return html(400, '연동 실패', '<h1>Google 연동 토큰을 받지 못했습니다</h1><p>Google 계정의 [보안 → 타사 앱 액세스]에서 이 앱의 권한을 삭제한 뒤 다시 연동해 주세요.</p><a class="btn" href="/admin#/integrations">돌아가기</a>');
      }
      resetTokenCache();
      resetFolders();
      const stored = await saveRefreshToken(tokens.refresh_token, info.email);
      if (!stored) {
        res.setHeader('Set-Cookie', [clear, session]);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return send(res, 200, page('연동 토큰 저장', `<h1>Google 계정 연동 완료 — 토큰을 저장해 주세요</h1>
          <p>KV 저장소가 설정되지 않아 토큰을 자동 저장할 수 없습니다. 아래 값을 Vercel 프로젝트 → Settings → Environment Variables에
          <code>GOOGLE_REFRESH_TOKEN</code> 으로 저장하고 <b>Redeploy</b> 하세요. (이 화면을 벗어나면 다시 볼 수 없습니다)</p>
          <textarea rows="4" readonly onclick="this.select()">${escHtml(tokens.refresh_token)}</textarea>
          <p>함께 <code>GOOGLE_ACCOUNT_EMAIL</code> = <code>${escHtml(info.email)}</code> 도 저장하면 연동 계정이 표시됩니다.</p>
          <p style="color:#B45309">⚠ 이 토큰은 비밀번호와 같습니다. 다른 곳에 공유하지 마세요.</p>
          <a class="btn" href="/admin#/integrations">관리자 페이지로</a>`));
      }
      res.setHeader('Set-Cookie', [clear, session]);
      return redirect(res, '/admin#/integrations?connected=1');
    }

    res.setHeader('Set-Cookie', [clear, session]);
    return redirect(res, '/admin#/dashboard');
  } catch (e) {
    console.error('[oauth-callback]', e.message);
    return html(500, '오류', `<h1>로그인 처리 중 오류가 발생했습니다</h1><p>${escHtml(e.message)}</p><a class="btn" href="/admin">다시 시도</a>`);
  }
}
