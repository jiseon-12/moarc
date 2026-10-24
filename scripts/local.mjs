// =====================================================================
// MOARC 포털 로컬 실행 서버 (의존성 없음 · Vercel 로그인 불필요)
//   node scripts/local.mjs            → http://localhost:3000
//   PORT=8080 node scripts/local.mjs  → 포트 변경
// - public/ 정적 페이지 (확장자 없는 주소, vercel.json 리다이렉트, 404)
// - api/*.js 서버 함수 (온라인 접수 · 공개 데이터 · 관리자 · Google 로그인)
// - 프로젝트 폴더의 .env.local 파일을 환경변수로 읽습니다 (선택)
// =====================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

// .env.local 읽기 (KEY=VALUE, # 주석)
for (const name of ['.env.local', '.env']) {
  const f = path.join(ROOT, name);
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  console.log(`· ${name} 환경변수를 읽었습니다.`);
}
if (!process.env.PUBLIC_BASE_URL) process.env.PUBLIC_BASE_URL = `http://localhost:${PORT}`;

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const fns = {};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('bad url'); }

  // 서버 함수
  if (p.startsWith('/api/')) {
    const name = p.slice(5).replace(/\/+$/, '');
    const file = path.join(ROOT, 'api', name + '.js');
    if (!/^[\w-]+$/.test(name) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not Found'); }
    try {
      fns[name] = fns[name] || (await import(pathToFileURL(file).href)).default;
      return await fns[name](req, res);
    } catch (e) {
      console.error(`[api/${name}]`, e);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); }
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // 리다이렉트
  const r = (vercel.redirects || []).find(x => x.source === p);
  if (r) { res.writeHead(r.permanent ? 308 : 307, { Location: r.destination + url.search }); return res.end(); }
  if (p.endsWith('.html')) { res.writeHead(308, { Location: (p.replace(/(index)?\.html$/, '') || '/') + url.search }); return res.end(); }

  // 정적 파일 (cleanUrls)
  let f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  let status = 200;
  if (!fs.existsSync(f)) { f = path.join(PUB, '404.html'); status = 404; }
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`✗ ${PORT} 포트가 사용 중입니다. 다른 포트로 실행하세요:  PORT=8080 node scripts/local.mjs  (Windows: set PORT=8080 && node scripts/local.mjs)`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, () => {
  const g = process.env.GOOGLE_CLIENT_ID ? '설정됨' : '미설정 (관리자 로그인 불가 · 홈페이지는 정상 동작)';
  console.log(`\n  MOARC PARTNERS 로컬 서버 실행 중\n\n  ▶ 홈페이지   http://localhost:${PORT}\n  ▶ 관리자     http://localhost:${PORT}/admin\n\n  Google 연동: ${g}\n  종료: Ctrl + C\n`);
});
