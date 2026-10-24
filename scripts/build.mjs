// =====================================================================
// MOARC 포털 정적 사이트 빌드
//   src/site.mjs (메뉴) + src/pages/**/*.html (본문) → public/**/*.html
//   src/input.css → public/assets/styles.css (Tailwind v4)
//   + 검색 인덱스, 시드 게시물, sitemap.xml, robots.txt, vercel.json
// 사용: npm install && npm run build
// =====================================================================
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SITE, MENU, UTIL_GROUP, QUICK_STARTUP, QUICK_ORG, SYSTEM_LINKS, PARTNERS, FAMILY_SITES, CONTACT } from '../src/site.mjs';
import { SEED_POSTS, BOARDS } from '../lib/seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'public');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ICON_TOKEN = '__ICON_NAMES__';
const CSS_TOKEN = '__CSS_VER__';
const JS_TOKEN = '__JS_VER__';

const ALL_GROUPS = [...MENU, UTIL_GROUP];
const ms = (name, cls = '') => `<span class="ms${cls ? ' ' + cls : ''}" aria-hidden="true">${name}</span>`;

/* ------------------------------- 공통 조각 ------------------------------- */
function head({ title, desc, canonical, noindex, jsonld = [] }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="#0C2D6B">
<link rel="canonical" href="${SITE.url}${canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.brand)}">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE.url}${canonical}">
<meta property="og:image" content="${SITE.url}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&amp;display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&amp;icon_names=${ICON_TOKEN}&amp;display=block">
<link rel="stylesheet" href="/assets/styles.css?v=${CSS_TOKEN}">
<script src="/assets/site.js?v=${JS_TOKEN}" defer></script>
</head>`;
}

const logo = (tag = 'a', variant = 'navy') => `<${tag} ${tag === 'a' ? 'href="/" ' : ''}class="logo logo-${variant}"${tag === 'a' ? ` aria-label="${esc(SITE.brand)} 홈"` : ''}><img src="/assets/brand/logo-${variant}.png" width="958" height="240" alt="${esc(SITE.brand)} 주식회사 모아크파트너스"></${tag}>`;

function header(groupId) {
  const gnb = MENU.map(g => `<li${g.id === groupId ? ' class="on"' : ''}><a href="${g.children[0].path}"${g.id === groupId ? ' aria-current="true"' : ''}>${esc(g.title)}</a>
      <div class="sub"><ul>${g.children.map(c => `<li><a href="${c.path}">${esc(c.title)}</a></li>`).join('')}</ul></div></li>`).join('\n      ');
  return `<a class="skip" href="#content">본문 바로가기</a>
<header class="hd" id="hd">
  <div class="hd-util"><div class="container">
    <span>${esc(SITE.name)} · 중소벤처기업부 등록 액셀러레이터(AC) · 개인투자조합 GP</span>
    <div style="display:flex;align-items:center;gap:14px">
      <button type="button" data-open="search">${ms('search')}통합검색</button><span class="sep"></span>
      <span class="lang"><a href="/" class="on" lang="ko">KOR</a> · <a href="/en" lang="en">ENG</a></span><span class="sep"></span>
      <a href="/admin">${ms('lock')}관리자</a><span class="sep"></span>
      <button type="button" data-open="sitemap">${ms('apps')}전체메뉴</button>
    </div>
  </div></div>
  <div class="hd-main"><div class="container">
    ${logo()}
    <nav class="gnb" id="gnb" aria-label="주 메뉴"><ul>
      ${gnb}
    </ul></nav>
    <div class="hd-tools">
      <a class="btn-apply" href="/apply/startup">${ms('edit_document')}<span class="t">참가신청</span></a>
      <button type="button" class="icon-btn btn-menu-m" data-open="search" aria-label="통합검색">${ms('search')}</button>
      <button type="button" class="icon-btn btn-menu-m" data-open="drawer" aria-label="메뉴 열기" aria-controls="drawer" aria-expanded="false">${ms('menu')}</button>
    </div>
  </div></div>
  <div class="mega-bg" id="mega-bg" aria-hidden="true"><div class="container"><div class="mega-intro"><strong>${esc(SITE.slogan)}</strong><p>${esc(SITE.sloganEn)}</p></div></div></div>
</header>`;
}

function overlays(curPath) {
  const drawer = ALL_GROUPS.filter(g => !g.hidden).map(g => {
    const open = g.children.some(c => c.path === curPath);
    return `<li${open ? ' class="open"' : ''}><button type="button" aria-expanded="${open}">${esc(g.title)}${ms('expand_more')}</button><ul>${g.children.map(c => `<li><a href="${c.path}"${c.path === curPath ? ' class="on" aria-current="page"' : ''}>${esc(c.title)}</a></li>`).join('')}</ul></li>`;
  }).join('');
  const sitemap = ALL_GROUPS.filter(g => !g.hidden).map(g => `<div><h3>${ms(g.icon)}${esc(g.title)}</h3>${g.children.map(c => `<a href="${c.path}">${esc(c.title)}</a>`).join('')}</div>`).join('');
  return `<div class="drawer" id="drawer" aria-hidden="true">
  <div class="drawer-dim" data-close="drawer"></div>
  <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="전체 메뉴">
    <div class="drawer-top">
      <div class="row"><img class="drawer-logo" src="/assets/brand/logo-white.png" width="958" height="240" alt="${esc(SITE.brand)}"><button type="button" class="icon-btn" style="color:#fff" data-close="drawer" aria-label="메뉴 닫기">${ms('close')}</button></div>
      <form class="drawer-search" action="/guide/search" role="search"><input type="search" name="q" placeholder="기업·공고·멘토 검색" aria-label="통합검색"><button aria-label="검색">${ms('search')}</button></form>
      <div class="links"><a href="/apply/startup">참가신청</a><a href="/news/notice">공지사항</a><a href="/admin">관리자</a><a href="/en">ENG</a></div>
    </div>
    <ul class="drawer-nav">${drawer}</ul>
  </div>
</div>
<div class="overlay" id="sitemap" role="dialog" aria-modal="true" aria-label="전체메뉴">
  <div class="container"><div class="overlay-head"><h2>전체메뉴</h2><button type="button" class="icon-btn" data-close="sitemap" aria-label="닫기">${ms('close')}</button></div>
  <div class="sitemap-grid">${sitemap}</div></div>
</div>
<div class="overlay" id="search" role="dialog" aria-modal="true" aria-label="통합검색">
  <div class="container"><div class="overlay-head"><h2>통합검색</h2><button type="button" class="icon-btn" data-close="search" aria-label="닫기">${ms('close')}</button></div>
  <div class="search-box"><form action="/guide/search" role="search"><input type="search" name="q" placeholder="검색어를 입력하세요" aria-label="검색어" autocomplete="off"><button aria-label="검색">${ms('search')}</button></form>
  <div class="kw"><a href="/guide/search?q=IR%20포럼">IR 포럼</a><a href="/guide/search?q=멘토링">멘토링</a><a href="/guide/search?q=배정표">배정표</a><a href="/guide/search?q=위탁">공공 위탁</a><a href="/guide/search?q=채용">채용</a></div></div></div>
</div>
<div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-box"><header><div><div class="kicker" id="modal-kicker"></div><h3 id="modal-title"></h3></div><button type="button" class="icon-btn" data-close="modal" aria-label="닫기">${ms('close')}</button></header><div class="bd" id="modal-body"></div><footer id="modal-foot"></footer></div></div>
<div class="toasts" id="toasts" role="status" aria-live="polite"></div>
<a href="#top" class="go-top" id="go-top" aria-label="맨 위로">${ms('arrow_upward')}TOP</a>`;
}

function footer() {
  return `<footer class="ft">
  <div class="ft-top"><div class="container">
    <nav class="ft-links" aria-label="정책 및 안내">
      <a href="/guide/privacy" class="strong">개인정보처리방침</a><a href="/guide/email">이메일무단수집거부</a><a href="/resources/ethics">윤리경영 선언</a><a href="/guide/sitemap">사이트맵</a><a href="/apply/contact">고객문의</a>
    </nav>
    <form class="family" onsubmit="event.preventDefault(); var v=this.site.value; if(v) window.open(v,'_blank','noopener');">
      <label class="sr-only-f" for="family-site">유관기관 바로가기</label>
      <select id="family-site" name="site"><option value="">유관기관 바로가기</option>${FAMILY_SITES.map(f => `<option value="${f.url}">${esc(f.name)}</option>`).join('')}</select>
      <button type="submit">이동</button>
    </form>
  </div></div>
  <div class="ft-body"><div class="container">
    <div>${logo('div', 'white')}<p class="ft-slogan">${esc(SITE.slogan)}<br><span>Connecting Potential. Creating Future Value.</span></p></div>
    <div class="ft-info">
      <p><span>${esc(CONTACT.company)}</span><span>대표이사 ${esc(CONTACT.ceo)}</span></p>
      <p><span>본사 ${esc(CONTACT.address)}</span></p>
      <p><span>${esc(CONTACT.branch)}</span></p>
      <p><span>대표전화 ${esc(CONTACT.tel)}</span><span>대표메일 ${esc(CONTACT.email)}</span></p>
      <p class="copy">Copyright © 2026 MOARC Partners Co., Ltd. All Rights Reserved.</p>
    </div>
  </div></div>
</footer>`;
}

const ARC = `<svg class="arc" viewBox="0 0 460 345" fill="none" aria-hidden="true"><path d="M 55 315 C 95 95, 310 20, 385 70 C 430 100, 395 235, 290 315" stroke="url(#sg)" stroke-width="26" stroke-linecap="round"/><path d="M 85 315 C 125 125, 295 55, 365 95 C 395 115, 365 230, 270 315" stroke="#fff" stroke-opacity=".35" stroke-width="10" stroke-linecap="round"/><defs><linearGradient id="sg" x1="55" y1="315" x2="395" y2="65" gradientUnits="userSpaceOnUse"><stop stop-color="#0C2D6B" stop-opacity=".2"/><stop offset=".6" stop-color="#6FA2FF"/><stop offset="1" stop-color="#DCE8FF"/></linearGradient></defs></svg>`;

function subPage(group, page, body) {
  const loc = `<nav class="loc" aria-label="현재 위치"><div class="container"><div class="bar">
    <a class="home" href="/" aria-label="홈">${ms('home')}</a>
    <div class="dd"><button type="button" aria-expanded="false">${esc(group.title)}${ms('expand_more')}</button><ul>${MENU.map(g => `<li><a href="${g.children[0].path}"${g.id === group.id ? ' class="on"' : ''}>${esc(g.title)}</a></li>`).join('')}</ul></div>
    <div class="dd"><button type="button" aria-expanded="false">${esc(page.title)}${ms('expand_more')}</button><ul>${group.children.map(c => `<li><a href="${c.path}"${c.id === page.id ? ' class="on"' : ''}>${esc(c.title)}</a></li>`).join('')}</ul></div>
    <div class="tools"><button type="button" class="icon-btn" data-share aria-label="링크 복사">${ms('share')}</button><button type="button" class="icon-btn" onclick="window.print()" aria-label="인쇄">${ms('print')}</button></div>
  </div></div></nav>`;
  const lnb = `<aside class="lnb" aria-label="${esc(group.title)} 하위 메뉴">
    <div class="lnb-head"><div class="en">${esc(group.en)}</div><h2>${esc(group.title)}</h2></div>
    <ul>${group.children.map(c => `<li><a href="${c.path}"${c.id === page.id ? ' class="on" aria-current="page"' : ''}>${esc(c.title)}${ms('chevron_right')}</a></li>`).join('')}</ul>
    <a class="lnb-banner" href="/apply/contact"><strong>문의 · 상담</strong><span>${esc(CONTACT.email)}</span></a>
  </aside>`;
  return `<section class="sub-visual"><div class="container"><div class="en">${esc(group.en)}</div><h2>${esc(group.title)}</h2><p>${esc(group.desc)}</p></div>${ARC}</section>
${loc}
<div class="container sub-body">
  ${lnb}
  <main class="content" id="content" tabindex="-1">
    <div class="content-head"><h3>${esc(page.title)}</h3></div>
    ${body}
  </main>
</div>`;
}

function shell({ title, desc, canonical, group, page, inner, bodyClass = '', noindex = false, jsonld = [] }) {
  return `${head({ title, desc, canonical, noindex, jsonld })}
<body class="${bodyClass}" id="top">
${header(group && group.id)}
${inner}
${footer()}
${overlays(page && page.path)}
</body>
</html>
`;
}

/* ------------------------------- 본문 ------------------------------- */
async function fragment(rel, fallback) {
  const f = path.join(SRC, 'pages', rel + '.html');
  if (existsSync(f)) return readFile(f, 'utf8');
  if (fallback != null) return fallback;
  throw new Error('페이지 본문 없음: src/pages/' + rel + '.html');
}

function expandIncludes(html) {
  return html
    .replace(/\{\{QUICK_STARTUP\}\}/g, QUICK_STARTUP.map(q => `<a href="${q.href}"><span class="ic">${ms(q.icon)}</span>${esc(q.label)}</a>`).join(''))
    .replace(/\{\{QUICK_ORG\}\}/g, QUICK_ORG.map(q => `<a href="${q.href}"><span class="ic">${ms(q.icon)}</span>${esc(q.label)}</a>`).join(''))
    .replace(/\{\{SYSTEM_LINKS\}\}/g, SYSTEM_LINKS.map(s => `<a href="${s.href}"><span class="t"><em>${esc(s.tag)}</em>${ms(s.icon)}</span><strong>${esc(s.title)}</strong><span class="s">${esc(s.sub)}</span></a>`).join(''))
    .replace(/\{\{PARTNERS\}\}/g, [...PARTNERS, ...PARTNERS].map((p, i) => `<li${i >= PARTNERS.length ? ' aria-hidden="true"' : ''}>${esc(p)}</li>`).join(''))
    .replace(/\{\{SITEMAP\}\}/g, ALL_GROUPS.map(g => `<div class="box"><h4 class="h5" style="margin-top:0">${esc(g.title)}</h4><ul class="dots">${g.children.map(c => `<li><a href="${c.path}">${esc(c.title)}</a></li>`).join('')}</ul></div>`).join(''))
    .replace(/\{\{CONTACT\.(\w+)\}\}/g, (_, k) => esc(CONTACT[k] || ''))
    .replace(/<ms>([a-z_]+)<\/ms>/g, (_, n) => ms(n));
}

const boardFragment = (board) => `<div data-module="board" data-board="${board}">
  <div class="board-top"><p class="total">전체 <b data-total>-</b>건</p>
    <form class="board-search" data-search role="search"><select name="f" aria-label="검색 범위"><option value="all">제목+내용</option><option value="title">제목</option></select><input type="search" name="q" placeholder="검색어를 입력하세요" aria-label="검색어"><button class="btn btn-dark btn-sm" style="height:42px">검색</button></form>
  </div>
  <ul class="board-list" data-list><li class="board-empty"><span class="spin"></span> 불러오는 중…</li></ul>
  <div class="pager" data-pager></div>
</div>
<noscript><p class="muted">게시판은 자바스크립트가 필요합니다.</p></noscript>`;

/* ------------------------------- 빌드 ------------------------------- */
async function writeOut(rel, html) {
  const f = path.join(OUT, rel);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, html);
}

async function buildCss() {
  const { compile } = await import('tailwindcss');
  const require = createRequire(import.meta.url);
  const twDir = path.resolve(path.dirname(require.resolve('tailwindcss')), '..');
  const loadStylesheet = async (id, base) => {
    const file = id === 'tailwindcss' ? path.join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice(12)) : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') };
  };
  const cands = new Set();
  const scan = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await scan(p);
      else if (/\.(html|js|mjs)$/.test(e.name)) (await readFile(p, 'utf8')).split(/[\s"'`<>={}]+/).forEach(t => t && t.length < 120 && cands.add(t.replace(/[,;]$/, '')));
    }
  };
  await scan(OUT); await scan(path.join(SRC, 'pages'));
  const compiler = await compile(await readFile(path.join(SRC, 'input.css'), 'utf8'), { base: SRC, loadStylesheet });
  const css = compiler.build([...cands]).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}');
  await writeOut('assets/styles.css', '/*! MOARC PARTNERS */' + css);
  return css;
}

const stripTags = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();

async function main() {
  const pages = [];
  const searchIndex = [];

  // 서브페이지
  for (const group of ALL_GROUPS) {
    for (const page of group.children) {
      const rel = page.path.slice(1);
      const raw = page.board ? await fragment(rel, boardFragment(page.board)) : await fragment(rel);
      const body = expandIncludes(raw);
      const title = `${page.title} | ${group.title} | ${SITE.name}`;
      const desc = page.desc || `${group.desc} ${page.title} — ${SITE.brand}`;
      const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' },
        { '@type': 'ListItem', position: 2, name: group.title, item: SITE.url + group.children[0].path },
        { '@type': 'ListItem', position: 3, name: page.title, item: SITE.url + page.path }] };
      pages.push({ rel: rel + '.html', html: shell({ title, desc, canonical: page.path, group, page, inner: subPage(group, page, body), noindex: !!page.noindex, jsonld: [crumbs] }) });
      if (!page.noindex && !page.board) searchIndex.push({ t: page.title, g: group.title, p: page.path, x: stripTags(body).slice(0, 1500) });
    }
  }

  // 메인
  const home = expandIncludes(await fragment('index'));
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: SITE.name, alternateName: SITE.brand, url: SITE.url + '/', logo: SITE.url + '/apple-touch-icon.png', slogan: SITE.sloganEn, email: CONTACT.email, founder: { '@type': 'Person', name: CONTACT.ceo } };
  pages.push({ rel: 'index.html', html: shell({ title: `${SITE.name} (${SITE.brand}) — ${SITE.sloganEn}`, desc: SITE.description, canonical: '/', inner: `<main class="main" id="content" tabindex="-1">${home}</main>`, bodyClass: 'is-home', jsonld: [org] }) });

  // 영문 / 404
  const en = expandIncludes(await fragment('en'));
  pages.push({ rel: 'en.html', html: shell({ title: `${SITE.brand} — ${SITE.sloganEn}`, desc: 'MOARC PARTNERS is an AI-driven startup accelerator (AC) and investment partner (GP) in Korea.', canonical: '/en', inner: `<main class="main" id="content" tabindex="-1" lang="en">${en}</main>` }).replace('<html lang="ko">', '<html lang="en">') });
  const nf = expandIncludes(await fragment('404'));
  pages.push({ rel: '404.html', html: shell({ title: `페이지를 찾을 수 없습니다 | ${SITE.name}`, desc: SITE.description, canonical: '/404', noindex: true, inner: `<main class="main" id="content" tabindex="-1">${nf}</main>` }) });

  for (const p of pages) await writeOut(p.rel, p.html);

  // 데이터 파일
  await writeOut('assets/data/posts.json', JSON.stringify({ boards: BOARDS, posts: SEED_POSTS }));
  await writeOut('assets/data/search.json', JSON.stringify(searchIndex));
  await writeOut('assets/data/menu.json', JSON.stringify(ALL_GROUPS.map(g => ({ id: g.id, title: g.title, children: g.children.map(c => ({ title: c.title, path: c.path })) }))));

  // CSS + 캐시 버전 + 아이콘 서브셋
  const css = await buildCss();
  const jsSrc = await readFile(path.join(OUT, 'assets/site.js'), 'utf8');
  const adminSrc = existsSync(path.join(OUT, 'admin.html')) ? await readFile(path.join(OUT, 'admin.html'), 'utf8') : '';
  const adminJs = existsSync(path.join(OUT, 'assets/admin.js')) ? await readFile(path.join(OUT, 'assets/admin.js'), 'utf8') : '';
  const icons = new Set(['pending', 'warning', 'calendar_today', 'folder', 'person', 'sync', 'close', 'menu', 'search', 'check_circle', 'error', 'info', 'expand_more', 'chevron_left', 'chevron_right', 'pause', 'play_arrow', 'attach_file', 'download', 'open_in_new', 'event', 'location_on', 'schedule', 'upload_file', 'delete', 'description', 'link']);
  for (const src of [...pages.map(p => p.html), jsSrc, adminSrc, adminJs]) {
    for (const m of src.matchAll(/class="ms[^"]*"[^>]*>([a-z_]+)</g)) icons.add(m[1]);
    for (const m of src.matchAll(/\bms\(([^()]*)\)/g)) for (const q of m[1].matchAll(/'([a-z_]+)'/g)) icons.add(q[1]);
    for (const m of src.matchAll(/icon:\s*'([a-z_]+)'/g)) icons.add(m[1]);
  }
  const iconList = [...icons].sort().join(',');
  const cssVer = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
  const jsVer = crypto.createHash('md5').update(jsSrc + adminJs).digest('hex').slice(0, 8);
  for (const p of pages) await writeOut(p.rel, p.html.replaceAll(ICON_TOKEN, iconList).replaceAll(CSS_TOKEN, cssVer).replaceAll(JS_TOKEN, jsVer));
  if (adminSrc) await writeOut('admin.html', adminSrc.replace(/icon_names=[a-z_,]+/, 'icon_names=' + iconList).replace(/styles\.css\?v=\w+/, 'styles.css?v=' + cssVer).replace(/(site|admin)\.js\?v=\w+/g, `$1.js?v=${jsVer}`));

  // sitemap / robots
  const urls = ['/', ...MENU.flatMap(g => g.children.map(c => c.path)), '/guide/privacy', '/guide/sitemap', '/en'];
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  await writeOut('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE.url}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  await writeOut('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /guide/search\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

  // vercel.json (대메뉴 → 첫 하위 페이지, v2 경로 호환)
  const redirects = [
    ...ALL_GROUPS.map(g => ({ source: `/${g.id}`, destination: g.children[0].path, permanent: false })),
    { source: '/about', destination: '/company/greeting', permanent: true },
    { source: '/insight', destination: '/news/notice', permanent: true },
    { source: '/ax-pipeline', destination: '/resources/ax-pipeline', permanent: true },
    { source: '/contact', destination: '/apply/startup', permanent: true },
    { source: '/workspace', destination: '/admin', permanent: true }
  ];
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' https://www.googleapis.com; frame-src https://www.google.com https://maps.google.com https://calendar.google.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";
  await writeFile(path.join(ROOT, 'vercel.json'), JSON.stringify({
    $schema: 'https://openapi.vercel.sh/vercel.json',
    buildCommand: 'echo "public/ is prebuilt (npm run build locally)"',
    outputDirectory: 'public',
    cleanUrls: true,
    trailingSlash: false,
    redirects,
    headers: [
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: csp }] },
      { source: '/assets/(styles\\.css|site\\.js|admin\\.js)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/assets/data/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=300' }] },
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }, { key: 'Cache-Control', value: 'no-store' }] }
    ]
  }, null, 2) + '\n');

  console.log(`✓ ${pages.length} pages · css ${(css.length / 1024).toFixed(1)}KB · ${icons.size} icons`);
}

main().catch(e => { console.error(e); process.exit(1); });
