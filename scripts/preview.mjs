// =====================================================================
// 미리보기판 생성: public/ → preview/
//   서버 없이 index.html 더블클릭(file://)으로 열어볼 수 있도록
//   절대경로(/assets/…, /company/…)를 상대경로(+.html)로 바꾸고
//   게시판·검색 데이터는 페이지에 직접 넣습니다.
//   ※ 실제 배포는 public/ 을 사용합니다. 온라인 접수·관리자 모드는 미리보기에서 동작하지 않습니다.
// 사용: npm run build && npm run preview
// =====================================================================
import { readFile, writeFile, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'preview');
const SKIP = new Set(['robots.txt', 'sitemap.xml']);

async function walk(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, e.name);
    if (e.isDirectory()) out.push(...await walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const files = await walk(SRC);
const fileSet = new Set(files);

/** 사이트 절대경로 → 현재 페이지 기준 상대경로 */
function relink(url, prefix) {
  const m = url.match(/^\/([^?#]*)([?#].*)?$/);
  if (!m) return url;
  let p = m[1]; const tail = m[2] || '';
  if (p === '') p = 'index.html';
  else if (!fileSet.has(p) && fileSet.has(p + '.html')) p = p + '.html';
  else if (!fileSet.has(p) && p === 'admin') return url; // 서버 전용
  return prefix + p + tail;
}

const posts = await readFile(path.join(SRC, 'assets/data/posts.json'), 'utf8');
const search = await readFile(path.join(SRC, 'assets/data/search.json'), 'utf8');

await rm(OUT, { recursive: true, force: true });
for (const f of files) {
  if (SKIP.has(f)) continue;
  const src = path.join(SRC, f); const dst = path.join(OUT, f);
  await mkdir(path.dirname(dst), { recursive: true });
  if (!f.endsWith('.html')) { await copyFile(src, dst); continue; }
  const depth = f.split('/').length - 1;
  const prefix = depth ? '../'.repeat(depth) : './';
  let html = await readFile(src, 'utf8');
  html = html.replace(/(\s(?:href|src|action|content)=")(\/(?!\/)[^"]*)"/g, (all, a, u) => a.includes('content') ? all : `${a}${relink(u, prefix)}"`);
  const boot = `<script>window.__MOARC_PREVIEW={root:${JSON.stringify(prefix)},posts:${posts},search:${search}};</script>`;
  html = html.replace(/<script src="([^"]*assets\/site\.js[^"]*)" defer><\/script>/, `${boot}<script src="$1" defer></script>`);
  await writeFile(dst, html);
}

// 런타임: 데이터 fetch 대체 + 동적으로 생기는 /경로 링크를 상대경로로 교정
const js = await readFile(path.join(SRC, 'assets/site.js'), 'utf8');
const shim = `/* preview shim */
(() => {
  const P = window.__MOARC_PREVIEW; if (!P) return;
  const files = ${JSON.stringify([...fileSet].filter(f => f.endsWith('.html')))};
  const has = new Set(files);
  P.fix = (u) => { if (typeof u !== 'string' || !u.startsWith('/') || u.startsWith('//')) return u; const m = u.match(/^\\/([^?#]*)([?#].*)?$/); let p = m[1]; if (p === '') p = 'index.html'; else if (has.has(p + '.html')) p += '.html'; return P.root + p + (m[2] || ''); };
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opt) => {
    const u = String(url);
    if (u.startsWith('/assets/data/posts.json')) return Promise.resolve(new Response(JSON.stringify(P.posts), { headers: { 'Content-Type': 'application/json' } }));
    if (u.startsWith('/assets/data/search.json')) return Promise.resolve(new Response(JSON.stringify(P.search), { headers: { 'Content-Type': 'application/json' } }));
    if (u.startsWith('/api/')) return Promise.resolve(new Response('{"error":"preview"}', { status: 503, headers: { 'Content-Type': 'application/json' } }));
    return realFetch(url, opt);
  };
  const fixAll = (root) => root.querySelectorAll && root.querySelectorAll('a[href^="/"]:not([href^="//"]),form[action^="/"]').forEach(el => { if (el.tagName === 'FORM') el.setAttribute('action', P.fix(el.getAttribute('action'))); else el.setAttribute('href', P.fix(el.getAttribute('href'))); });
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && (n.matches && n.matches('a[href^="/"]') ? n.setAttribute('href', P.fix(n.getAttribute('href'))) : fixAll(n))))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="/"]'); if (a) a.setAttribute('href', P.fix(a.getAttribute('href'))); }, true);
})();
`;
await writeFile(path.join(OUT, 'assets/site.js'), shim + js.replace(/location\.href = '(\/[^']*)'/g, "location.href = (window.__MOARC_PREVIEW ? window.__MOARC_PREVIEW.fix('$1') : '$1')"));
await writeFile(path.join(OUT, '미리보기_안내.txt'), `MOARC PARTNERS 홈페이지 미리보기판\n\n- index.html 을 더블클릭하면 브라우저에서 바로 열립니다 (인터넷 연결 필요: 글꼴·아이콘).\n- 메뉴·게시판·검색·슬라이드 등 화면은 실제와 동일합니다.\n- 온라인 접수 제출, 관리자 모드(Google 연동), 공개 일정은 서버가 필요해 미리보기에서는 동작하지 않습니다.\n- 실제 배포는 상위 폴더 전체(GitHub → Vercel)를 사용하세요. preview 폴더는 배포 대상이 아닙니다.\n`);
console.log('✓ preview/ 생성 —', files.filter(f => f.endsWith('.html') && !SKIP.has(f)).length, 'pages');
