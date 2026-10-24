// Google refresh token 저장소
// 우선순위: 환경변수 GOOGLE_REFRESH_TOKEN → KV(Upstash Redis / Vercel KV REST)
const KEY = 'moarc:google_refresh_token';
const ACCOUNT_KEY = 'moarc:google_account';

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export const kvAvailable = () => !!kvConfig();

async function kv(cmd) {
  const c = kvConfig();
  if (!c) return null;
  const res = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const data = await res.json();
  return data.result;
}

let memo = { token: null, account: null, at: 0 };

export async function getRefreshToken() {
  if (process.env.GOOGLE_REFRESH_TOKEN) return { token: process.env.GOOGLE_REFRESH_TOKEN, source: 'env' };
  if (!kvAvailable()) return memo.token ? { token: memo.token, source: 'memory' } : { token: null, source: null };
  if (memo.token && Date.now() - memo.at < 5 * 60 * 1000) return { token: memo.token, source: 'kv' };
  const token = await kv(['GET', KEY]).catch(() => null);
  memo = { ...memo, token, at: Date.now() };
  return { token, source: token ? 'kv' : null };
}

/** 저장 성공 시 true, 저장소가 없으면 false (관리자가 환경변수에 직접 입력) */
export async function saveRefreshToken(token, account) {
  memo = { token, account, at: Date.now() };
  if (!kvAvailable()) return false;
  await kv(['SET', KEY, token]);
  if (account) await kv(['SET', ACCOUNT_KEY, account]);
  return true;
}

export async function clearRefreshToken() {
  memo = { token: null, account: null, at: 0 };
  if (kvAvailable()) { await kv(['DEL', KEY]); await kv(['DEL', ACCOUNT_KEY]); }
}

export async function getConnectedAccount() {
  if (process.env.GOOGLE_ACCOUNT_EMAIL) return process.env.GOOGLE_ACCOUNT_EMAIL;
  if (memo.account) return memo.account;
  if (!kvAvailable()) return null;
  return kv(['GET', ACCOUNT_KEY]).catch(() => null);
}
