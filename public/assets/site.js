/* =====================================================================
 * MOARC PARTNERS — 공개 사이트 런타임
 * 공통: 헤더 · 메가메뉴 · 모바일 드로어 · 전체메뉴/검색 · 로케이션 · 모달 · 토스트
 * 모듈: [data-module="..."] 요소를 찾아 초기화
 * ===================================================================== */
(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const ms = (n) => `<span class="ms" aria-hidden="true">${n}</span>`;
  const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, '').replace(/\(주\)|㈜|주식회사|농업회사법인|어업회사법인/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  const qs = () => new URLSearchParams(location.search);
  const fmtDate = (d) => { const x = new Date(d); return `${x.getFullYear()}.${pad(x.getMonth() + 1)}.${pad(x.getDate())}`; };
  const DEFAULTS = { forumName: '제14회 MOARC 정례 IR 피칭 포럼', forumDeadline: '2026-11-05T18:00:00+09:00', forumCapacity: 7, applyOpen: true, contactEmail: 'contact@moarc.co.kr', mainNotice: '' };

  /* ---------------- 데이터 로딩 (API → 정적 폴백) ---------------- */
  const memo = {};
  function getJSON(url) {
    if (!memo[url]) memo[url] = fetch(url, { headers: { Accept: 'application/json' } }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    return memo[url];
  }
  const config = () => getJSON('/api/public?r=config').then(d => ({ ...DEFAULTS, ...(d.settings || {}), connected: !!d.connected })).catch(() => ({ ...DEFAULTS, connected: false }));
  const posts = () => getJSON('/api/public?r=posts').then(d => d.posts).catch(() => getJSON('/assets/data/posts.json').then(d => d.posts)).then(list => [...list].sort((a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date))));
  const BOARDS = { notice: { label: '공지사항', path: '/news/notice' }, ir: { label: 'IR·멘토링 공고', path: '/news/ir' }, press: { label: '보도자료', path: '/news/press' }, activity: { label: '주요동정', path: '/news/activity' }, recruit: { label: '인재채용', path: '/news/recruit' } };

  /* ---------------- 토스트 · 모달 ---------------- */
  function toast(msg, type) {
    const box = $('#toasts'); if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
    t.innerHTML = ms(type === 'err' ? 'error' : type === 'ok' ? 'check_circle' : 'info');
    t.appendChild(document.createTextNode(msg));
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 4000);
  }
  let lastFocus = null;
  function modal({ kicker = '', title = '', html = '', actions = [] }) {
    const m = $('#modal'); if (!m) return;
    $('#modal-kicker').textContent = kicker; $('#modal-title').textContent = title; $('#modal-body').innerHTML = html;
    const f = $('#modal-foot'); f.innerHTML = '';
    actions.forEach(a => {
      const b = document.createElement(a.href ? 'a' : 'button');
      b.className = 'btn btn-sm ' + (a.primary ? 'btn-primary' : 'btn-line');
      if (a.href) { b.href = a.href; if (a.blank) { b.target = '_blank'; b.rel = 'noopener'; } } else b.type = 'button';
      b.textContent = a.label;
      b.addEventListener('click', () => { if (a.onClick) a.onClick(); if (!a.keep) closeLayer('modal'); });
      f.appendChild(b);
    });
    f.hidden = !actions.length;
    openLayer('modal');
  }

  /* ---------------- 레이어 (드로어 · 전체메뉴 · 검색 · 모달) ---------------- */
  const stack = [];
  function openLayer(id) {
    const el = document.getElementById(id); if (!el) return;
    if (!stack.includes(id)) { stack.push(id); lastFocus = document.activeElement; }
    el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $$('[data-open="' + id + '"]').forEach(b => b.setAttribute('aria-expanded', 'true'));
    setTimeout(() => { const f = el.querySelector('input[type=search], input:not([type=hidden]), button, a[href]'); if (f) f.focus(); }, 60);
  }
  function closeLayer(id) {
    const el = document.getElementById(id); if (!el) return;
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
    const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1);
    if (!stack.length) document.body.style.overflow = '';
    $$('[data-open="' + id + '"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openLayer(o.getAttribute('data-open')); return; }
    const c = e.target.closest('[data-close]'); if (c) { e.preventDefault(); closeLayer(c.getAttribute('data-close')); return; }
    if (e.target.id === 'modal') closeLayer('modal');
    // 로케이션 드롭다운
    const dd = e.target.closest('.loc .dd > button');
    $$('.loc .dd.open').forEach(x => { if (!dd || x !== dd.parentElement) { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); } });
    if (dd) { const open = dd.parentElement.classList.toggle('open'); dd.setAttribute('aria-expanded', String(open)); }
    // 링크 공유
    if (e.target.closest('[data-share]')) {
      const url = location.href;
      if (navigator.share && /Mobi/.test(navigator.userAgent)) navigator.share({ title: document.title, url }).catch(() => {});
      else navigator.clipboard.writeText(url).then(() => toast('페이지 주소가 복사되었습니다.', 'ok'), () => toast(url));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (stack.length) closeLayer(stack[stack.length - 1]);
      $$('.loc .dd.open').forEach(x => x.classList.remove('open'));
      closeMega();
    }
    if (e.key === 'Tab' && stack.length) {
      const el = document.getElementById(stack[stack.length - 1]);
      const items = $$('a[href], button:not([disabled]), input:not([type=hidden]):not([tabindex="-1"]), select, textarea', el).filter(x => x.offsetParent !== null);
      if (!items.length) return;
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
    }
  });

  /* ---------------- 헤더 · 메가메뉴 ---------------- */
  const hd = $('#hd'), gnb = $('#gnb'), megaBg = $('#mega-bg');
  function openMega() {
    if (!hd || window.innerWidth < 1280) return;
    hd.classList.add('mega-open');
    const h = Math.max(...$$('.gnb .sub', hd).map(s => s.scrollHeight));
    megaBg.style.height = h + 'px';
  }
  function closeMega() { if (!hd) return; hd.classList.remove('mega-open'); if (megaBg) megaBg.style.height = '0'; }
  if (gnb) {
    gnb.addEventListener('mouseenter', openMega);
    hd.addEventListener('mouseleave', closeMega);
    gnb.addEventListener('focusin', openMega);
    hd.addEventListener('focusout', (e) => { if (!hd.contains(e.relatedTarget)) closeMega(); });
    $$('.gnb > ul > li', hd).forEach(li => {
      li.addEventListener('mouseenter', () => li.classList.add('hover'));
      li.addEventListener('mouseleave', () => li.classList.remove('hover'));
    });
  }
  const goTop = $('#go-top');
  const onScroll = () => { const y = window.scrollY; if (hd) hd.classList.toggle('scrolled', y > 10); if (goTop) goTop.classList.toggle('show', y > 400); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (goTop) goTop.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $$('.drawer-nav > li > button').forEach(b => b.addEventListener('click', () => {
    const li = b.parentElement; const open = !li.classList.contains('open');
    $$('.drawer-nav > li.open').forEach(x => { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); });
    li.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  }));
  window.addEventListener('resize', () => { if (window.innerWidth >= 1280 && stack.includes('drawer')) closeLayer('drawer'); });

  /* ---------------- 본문 서식 렌더러 (게시판) ---------------- */
  const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" class="text-moarc-blue underline">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1" class="text-moarc-blue underline">$1</a>');
  function renderBody(text) {
    return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(block => {
      const lines = block.split('\n').filter(l => l.trim());
      if (!lines.length) return '';
      const out = []; let ul = [], tb = [];
      const flush = () => {
        if (ul.length) { out.push('<ul>' + ul.map(l => '<li>' + linkify(esc(l)) + '</li>').join('') + '</ul>'); ul = []; }
        if (tb.length) { out.push('<div class="tbl-wrap"><table><tbody>' + tb.map(r => '<tr>' + r.map((c, i) => i === 0 ? `<th>${esc(c)}</th>` : `<td>${linkify(esc(c))}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>'); tb = []; }
      };
      const para = [];
      lines.forEach(l => {
        const t = l.trim();
        if (/^-\s+/.test(t)) { if (tb.length) flush(); ul.push(t.replace(/^-\s+/, '')); }
        else if (/^\|.*\|$/.test(t)) { if (ul.length) flush(); tb.push(t.slice(1, -1).split('|').map(c => c.trim())); }
        else if (/^##\s+/.test(t)) { flush(); if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para.length = 0; } out.push('<h5>' + esc(t.replace(/^##\s+/, '')) + '</h5>'); }
        else { flush(); para.push(linkify(esc(t))); }
      });
      flush();
      if (para.length) out.push('<p>' + para.join('<br>') + '</p>');
      return out.join('');
    }).join('');
  }

  /* ---------------- 카운트다운 ---------------- */
  function countdowns(cfg) {
    const end = Date.parse(cfg.forumDeadline);
    const deadlineText = isNaN(end) ? '-' : (() => { const d = new Date(end); return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`; })();
    $$('[data-cd-name]').forEach(el => { if (el.tagName !== 'H2') el.textContent = cfg.forumName; });
    $$('[data-cd-deadline]').forEach(el => el.textContent = deadlineText);
    const tick = () => {
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const closed = !cfg.applyOpen || diff === 0;
      const d = Math.floor(diff / 86400), h = Math.floor(diff % 86400 / 3600), m = Math.floor(diff % 3600 / 60), s = diff % 60;
      $$('[data-module="countdown"]').forEach(box => {
        const set = (k, v) => { const x = box.querySelector('[data-' + k + ']'); if (x) x.textContent = v; };
        set('d', pad(d)); set('h', pad(h)); set('m', pad(m)); set('s', pad(s));
        const st = box.querySelector('[data-cd-state]');
        if (st) { const en = (st.dataset.base = st.dataset.base || st.textContent.trim()) === 'RECRUITING'; st.textContent = closed ? (en ? 'CLOSED' : '접수 마감') : (en ? 'RECRUITING · D-' : '접수중 · D-') + d; }
      });
      $$('[data-cd-inline]').forEach(el => el.textContent = closed ? '접수 마감' : `${d}일 ${pad(h)}:${pad(m)}:${pad(s)}`);
      return !closed;
    };
    if (tick()) { const t = setInterval(() => { if (!tick()) clearInterval(t); }, 1000); }
  }

  /* ================================================================
   * 모듈
   * ================================================================ */
  const modules = {};

  modules.slider = (el) => {
    const slides = $$('.mv-slide', el); let i = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = Date.now();
    const DUR = 6500; const prog = $('[data-prog]', el); const cur = $('[data-cur]', el); const tg = $('[data-toggle]', el);
    const go = (n) => { slides[i].classList.remove('on'); slides[i].setAttribute('aria-hidden', 'true'); i = (n + slides.length) % slides.length; slides[i].classList.add('on'); slides[i].removeAttribute('aria-hidden'); cur.textContent = pad(i + 1); t0 = Date.now(); };
    slides.forEach((s, k) => k && s.setAttribute('aria-hidden', 'true'));
    $('[data-prev]', el).addEventListener('click', () => go(i - 1));
    $('[data-next]', el).addEventListener('click', () => go(i + 1));
    const setPlay = (p) => { playing = p; tg.innerHTML = ms(p ? 'pause' : 'play_arrow'); tg.setAttribute('aria-label', p ? '자동 넘김 정지' : '자동 넘김 시작'); t0 = Date.now(); };
    tg.addEventListener('click', () => setPlay(!playing)); setPlay(playing);
    el.addEventListener('focusin', () => { el.dataset.hold = '1'; }); el.addEventListener('focusout', () => { delete el.dataset.hold; t0 = Date.now(); });
    let sx = null;
    el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); sx = null; });
    (function loop() {
      const p = playing && !el.dataset.hold ? Math.min(1, (Date.now() - t0) / DUR) : prog.style.width ? parseFloat(prog.style.width) / 100 : 0;
      prog.style.width = (p * 100) + '%';
      if (playing && !el.dataset.hold && p >= 1) go(i + 1);
      if (!playing || el.dataset.hold) t0 = Date.now() - p * DUR;
      requestAnimationFrame(loop);
    })();
  };

  modules.quicktabs = (el) => {
    $$('[data-q]', el).forEach(b => b.addEventListener('click', () => {
      $$('[data-q]', el).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      $$('[data-pane]', el).forEach(p => p.hidden = p.getAttribute('data-pane') !== b.getAttribute('data-q'));
    }));
  };

  modules['home-board'] = async (el) => {
    const list = $('[data-list]', el), more = $('[data-more]', el);
    const all = await posts().catch(() => []);
    const recent = Date.now() - 7 * 86400e3;
    const show = (b) => {
      $$('[data-b]', el).forEach(x => x.classList.toggle('on', x.getAttribute('data-b') === b));
      more.href = BOARDS[b].path;
      const items = all.filter(p => p.board === b).slice(0, 5);
      list.innerHTML = items.length ? items.map(p => `<li><a href="${BOARDS[b].path}?id=${encodeURIComponent(p.id)}">${p.pinned ? '<span class="badge dark" style="height:20px">공지</span>' : ''}<span class="tt2">${esc(p.title)}</span>${Date.parse(p.date) > recent ? '<span class="new">N</span>' : ''}<span class="dt">${esc(String(p.date).replace(/-/g, '.'))}</span></a></li>`).join('') : '<li class="board-empty" style="border:0;padding:40px 0">등록된 게시물이 없습니다.</li>';
    };
    $$('[data-b]', el).forEach(b => b.addEventListener('click', () => show(b.getAttribute('data-b'))));
    show('notice');
  };

  modules['home-activity'] = async (el) => {
    const icons = ['groups', 'campaign', 'handshake'];
    const items = (await posts().catch(() => [])).filter(p => p.board === 'activity' || p.board === 'press').slice(0, 3);
    $('[data-list]', el).innerHTML = items.map((p, i) => `<a class="act-card" href="${BOARDS[p.board].path}?id=${encodeURIComponent(p.id)}"><div class="th">${ms(icons[i % 3])}<span class="badge" style="background:rgba(255,255,255,.18);color:#fff">${esc(BOARDS[p.board].label)}</span></div><div class="bd"><strong>${esc(p.title)}</strong><span>${esc(String(p.date).replace(/-/g, '.'))}</span></div></a>`).join('');
  };

  async function loadEvents(from, to, cfg) {
    let events = [];
    try {
      const d = await getJSON(`/api/public?r=schedule&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
      events = d.events || [];
      if (d.connected && events.length) return events;
    } catch (e) { /* 폴백 */ }
    // 캘린더 미연동 시 기본 일정
    cfg = cfg || await config();
    const dl = new Date(cfg.forumDeadline);
    const fallback = [{ id: 'forum-apply', title: cfg.forumName + ' 참가 접수 마감', start: dl.toISOString(), end: dl.toISOString(), allDay: false, location: '온라인 접수', description: '홈페이지 [참여·신청 > 스타트업 참가신청]', category: 'IR 포럼' }];
    return events.concat(fallback.filter(f => Date.parse(f.start) >= from && Date.parse(f.start) <= to));
  }
  const evDate = (e) => new Date(e.allDay ? e.start + 'T00:00:00' : e.start);
  function gcalLink(e) {
    const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    let dates;
    if (e.allDay) dates = e.start.replace(/-/g, '') + '/' + (e.end || e.start).replace(/-/g, '');
    else dates = f(new Date(e.start)) + '/' + f(new Date(e.end || e.start));
    return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details: e.description || '', location: e.location || '' });
  }
  function eventModal(e) {
    const d = evDate(e);
    const time = e.allDay ? '종일' : `${pad(d.getHours())}:${pad(d.getMinutes())}` + (e.end ? ' ~ ' + (() => { const x = new Date(e.end); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; })() : '');
    modal({
      kicker: e.category || '일정', title: e.title,
      html: `<div class="tbl-wrap"><table class="tbl"><tbody><tr><th>일시</th><td>${fmtDate(d)} (${'일월화수목금토'[d.getDay()]}) ${esc(time)}</td></tr>${e.location ? `<tr><th>장소</th><td>${esc(e.location)}</td></tr>` : ''}${e.description ? `<tr><th>내용</th><td>${renderBody(e.description)}</td></tr>` : ''}</tbody></table></div>`,
      actions: [{ label: '내 Google 캘린더에 추가', href: gcalLink(e), blank: true, primary: true }, { label: '닫기' }]
    });
  }

  modules['home-schedule'] = async (el) => {
    const now = new Date(); const to = new Date(Date.now() + 120 * 86400e3);
    const evs = (await loadEvents(new Date(now.getTime() - 86400e3), to)).filter(e => evDate(e) >= new Date(now.toDateString())).sort((a, b) => evDate(a) - evDate(b)).slice(0, 4);
    const ul = $('[data-list]', el);
    ul.innerHTML = evs.length ? evs.map((e, k) => { const d = evDate(e); return `<li><a href="/news/schedule" data-ev="${k}"><div class="d"><b>${pad(d.getDate())}</b><span>${d.getFullYear()}.${pad(d.getMonth() + 1)}</span></div><div class="i"><strong>${esc(e.title)}</strong><span>${e.allDay ? '종일' : pad(d.getHours()) + ':' + pad(d.getMinutes())}${e.location ? ' · ' + esc(e.location) : ''}</span></div></a></li>`; }).join('') : '<li class="empty">예정된 일정이 없습니다.</li>';
    $$('[data-ev]', ul).forEach(a => a.addEventListener('click', (ev) => { ev.preventDefault(); eventModal(evs[+a.dataset.ev]); }));
  };

  modules.countdown = () => { /* config 로드 후 countdowns()에서 일괄 처리 */ };

  modules.marquee = (el) => {
    const btn = el.parentElement.querySelector('[data-marquee-toggle]');
    if (btn) btn.addEventListener('click', () => { const p = el.classList.toggle('paused'); btn.innerHTML = ms(p ? 'play_arrow' : 'pause'); btn.setAttribute('aria-label', p ? '배너 재생' : '배너 정지'); });
  };

  /* ---- 게시판 ---- */
  modules.board = async (el) => {
    const board = el.dataset.board; const meta = BOARDS[board];
    const all = (await posts().catch(() => [])).filter(p => p.board === board);
    const p = qs();
    const id = p.get('id');
    if (id) {
      const i = all.findIndex(x => x.id === id);
      const post = all[i];
      if (!post) { el.innerHTML = '<p class="board-empty">게시물을 찾을 수 없습니다.</p><div class="form-actions"><a class="btn btn-dark" href="' + meta.path + '">목록</a></div>'; return; }
      document.title = post.title + ' | ' + meta.label + ' | 모아크파트너스';
      const prev = all[i + 1], next = all[i - 1];
      el.innerHTML = `<article>
        <div class="view-head"><h4>${post.pinned ? '<span class="badge dark mr-2 align-middle">공지</span>' : ''}${esc(post.title)}</h4><div class="meta"><span>${ms('calendar_today')} ${esc(String(post.date).replace(/-/g, '.'))}</span><span>${ms('folder')} ${esc(meta.label)}</span><span>${ms('person')} 모아크파트너스</span></div></div>
        <div class="view-body">${renderBody(post.body || post.summary)}</div>
        ${(post.attachments || []).length ? `<div class="view-files"><strong>첨부파일</strong>${post.attachments.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${ms('attach_file')}${esc(a.name || '첨부파일')}</a>`).join('')}</div>` : ''}
        <ul class="view-nav mt-6"><li><span>이전글</span>${prev ? `<a href="?id=${encodeURIComponent(prev.id)}">${esc(prev.title)}</a>` : '<a class="muted">이전글이 없습니다.</a>'}</li><li><span>다음글</span>${next ? `<a href="?id=${encodeURIComponent(next.id)}">${esc(next.title)}</a>` : '<a class="muted">다음글이 없습니다.</a>'}</li></ul>
        <div class="form-actions"><a class="btn btn-dark" href="${meta.path}">목록</a>${board === 'ir' ? '<a class="btn btn-primary" href="/apply/startup">참가 신청</a>' : ''}</div>
      </article>`;
      return;
    }
    const form = $('[data-search]', el), listEl = $('[data-list]', el), pager = $('[data-pager]', el), total = $('[data-total]', el);
    const PER = 10;
    form.q.value = p.get('q') || ''; if (p.get('f')) form.f.value = p.get('f');
    const render = () => {
      const q = norm(form.q.value), f = form.f.value;
      const items = all.filter(x => !q || norm(f === 'title' ? x.title : x.title + x.summary + x.body).includes(q));
      const pages = Math.max(1, Math.ceil(items.length / PER));
      let page = Math.min(pages, Math.max(1, parseInt(qs().get('page') || '1', 10)));
      total.textContent = items.length;
      const slice = items.slice((page - 1) * PER, page * PER);
      listEl.innerHTML = slice.length ? slice.map((x, k) => `<li${x.pinned ? ' class="pin"' : ''}><a href="?id=${encodeURIComponent(x.id)}"><span class="no">${x.pinned ? '<span class="badge dark">공지</span>' : items.length - ((page - 1) * PER + k)}</span><span class="tit"><strong>${esc(x.title)}</strong><p>${esc(x.summary || '')}</p></span><span class="date">${esc(String(x.date).replace(/-/g, '.'))}</span></a></li>`).join('') : '<li class="board-empty">' + (q ? '검색 결과가 없습니다.' : '등록된 게시물이 없습니다.') + '</li>';
      const btn = (n, label, dis, on) => `<button type="button" data-p="${n}" ${dis ? 'disabled' : ''} class="${on ? 'on' : ''}" ${on ? 'aria-current="page"' : ''} aria-label="${typeof label === 'number' ? label + '페이지' : label}">${typeof label === 'number' ? label : ms(label === '이전' ? 'chevron_left' : 'chevron_right')}</button>`;
      pager.innerHTML = pages > 1 ? btn(page - 1, '이전', page === 1) + Array.from({ length: pages }, (_, n) => btn(n + 1, n + 1, false, n + 1 === page)).join('') + btn(page + 1, '다음', page === pages) : '';
    };
    pager.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; const u = new URL(location.href); u.searchParams.set('page', b.dataset.p); history.pushState(null, '', u); render(); el.scrollIntoView({ behavior: 'smooth' }); });
    form.addEventListener('submit', (e) => { e.preventDefault(); const u = new URL(location.href); u.searchParams.delete('page'); form.q.value ? u.searchParams.set('q', form.q.value) : u.searchParams.delete('q'); history.replaceState(null, '', u); render(); });
    window.addEventListener('popstate', render);
    render();
  };

  /* ---- 주요일정 (캘린더) ---- */
  modules.schedule = async (el) => {
    const cfg = await config();
    let view = new Date(); view.setDate(1);
    const grid = $('[data-grid]', el), title = $('[data-title]', el), listEl = $('[data-list]', el);
    $('[data-sync]', el).innerHTML = cfg.connected ? ms('sync') + ' Google 캘린더와 실시간 연동' : '';
    const draw = async () => {
      const y = view.getFullYear(), m = view.getMonth();
      title.textContent = `${y}.${pad(m + 1)}`;
      const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 42);
      const evs = await loadEvents(start, end, cfg);
      const byDay = {};
      evs.forEach((e, k) => { const d = evDate(e); const key = d.toDateString(); (byDay[key] = byDay[key] || []).push(k); });
      const today = new Date().toDateString();
      let html = '일월화수목금토'.split('').map(d => `<div class="dow">${d}</div>`).join('');
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const cls = [d.getMonth() !== m ? 'out' : '', d.getDay() === 0 ? 'sun' : '', d.getDay() === 6 ? 'sat' : '', d.toDateString() === today ? 'today' : ''].join(' ');
        html += `<div class="${cls}"><span class="d">${d.getDate()}</span>${(byDay[d.toDateString()] || []).map(k => `<button type="button" class="ev" data-k="${k}" title="${esc(evs[k].title)}">${esc(evs[k].title)}</button>`).join('')}</div>`;
      }
      grid.innerHTML = html;
      $$('[data-k]', grid).forEach(b => b.addEventListener('click', () => eventModal(evs[+b.dataset.k])));
      const monthEvs = evs.filter(e => evDate(e).getMonth() === m).sort((a, b) => evDate(a) - evDate(b));
      listEl.innerHTML = monthEvs.length ? monthEvs.map((e, k) => { const d = evDate(e); return `<li><div class="dt"><b>${pad(d.getDate())}</b><span>${y}.${pad(m + 1)} (${'일월화수목금토'[d.getDay()]})</span></div><div><span class="badge">${esc(e.category || '일정')}</span><p class="font-bold mt-1">${esc(e.title)}</p><p class="text-sm muted">${e.allDay ? '종일' : pad(d.getHours()) + ':' + pad(d.getMinutes())}${e.location ? ' · ' + esc(e.location) : ''}</p></div><button type="button" class="btn btn-line btn-sm" data-lk="${k}">상세보기</button></li>`; }).join('') : '<li class="board-empty" style="display:block">이 달의 일정이 없습니다.</li>';
      $$('[data-lk]', listEl).forEach(b => b.addEventListener('click', () => eventModal(monthEvs[+b.dataset.lk])));
    };
    $('[data-prev]', el).addEventListener('click', () => { view.setMonth(view.getMonth() - 1); draw(); });
    $('[data-next]', el).addEventListener('click', () => { view.setMonth(view.getMonth() + 1); draw(); });
    $('[data-today]', el).addEventListener('click', () => { view = new Date(); view.setDate(1); draw(); });
    $$('[data-view]', el).forEach(b => b.addEventListener('click', () => { $$('[data-view]', el).forEach(x => x.classList.toggle('on', x === b)); $$('[data-pane]', el).forEach(p => p.hidden = p.dataset.pane !== b.dataset.view); }));
    if (window.innerWidth < 768) $('[data-view="list"]', el).click();
    draw();
  };

  /* ---- 자료실 (Google Drive) ---- */
  const fmtSize = (b) => !b ? '-' : b < 1024 * 1024 ? (b / 1024).toFixed(0) + 'KB' : (b / 1024 / 1024).toFixed(1) + 'MB';
  modules.library = async (el) => {
    const body = $('[data-list]', el), total = $('[data-total]', el), q = $('[data-q]', el), cat = $('[data-cat]', el);
    let files = [];
    try { files = (await getJSON('/api/public?r=library')).files || []; } catch (e) { /* 미연동 */ }
    [...new Set(files.map(f => f.category))].forEach(c => { const o = document.createElement('option'); o.textContent = c; o.value = c; cat.appendChild(o); });
    const render = () => {
      const k = norm(q.value), c = cat.value;
      const list = files.filter(f => (!c || f.category === c) && (!k || norm(f.name + f.description).includes(k)));
      total.textContent = list.length;
      body.innerHTML = list.length ? list.map((f, i) => `<tr><td class="text-center muted">${list.length - i}</td><td class="text-center"><span class="badge gray">${esc(f.category)}</span></td><td><a href="${esc(f.viewUrl)}" target="_blank" rel="noopener" class="font-semibold hover:text-moarc-blue">${esc(f.name)}</a>${f.description ? `<p class="text-sm muted">${esc(f.description)}</p>` : ''}</td><td class="text-center num text-sm">${fmtSize(f.size)}</td><td class="text-center num text-sm">${fmtDate(f.createdTime)}</td><td class="text-center"><a class="btn btn-line btn-sm" href="${esc(f.downloadUrl)}" target="_blank" rel="noopener">${ms('download')}받기</a></td></tr>`).join('') : '<tr><td colspan="6" class="board-empty">등록된 자료가 없습니다.</td></tr>';
    };
    q.addEventListener('input', render); cat.addEventListener('change', render); render();
  };

  /* ---- 포트폴리오 필터 ---- */
  modules.portfolio = (el) => {
    const cards = $$('[data-cat]', $('[data-grid]', el)); const q = $('[data-q]', el); let cat = 'all';
    const render = () => {
      const k = norm(q.value); let n = 0;
      cards.forEach(c => { const show = (cat === 'all' || c.dataset.cat === cat) && (!k || norm(c.dataset.text).includes(k)); c.hidden = !show; if (show) n++; });
      $('[data-empty]', el).hidden = n > 0;
    };
    $$('[data-filter]', el).forEach(b => b.addEventListener('click', () => { cat = b.dataset.filter; $$('[data-filter]', el).forEach(x => x.classList.toggle('on', x === b)); render(); }));
    q.addEventListener('input', render);
  };

  /* ---- 멘토링 배정표 조회 ---- */
  modules.timetable = (el) => {
    const table = $('table', el), input = $('[data-q]', el), out = $('[data-result]', el);
    const heads = $$('thead th', table);
    const mentor = (i) => heads[i] ? heads[i].childNodes[0].textContent.trim() : '';
    const rows = $$('tbody tr', table).filter(r => !r.classList.contains('break'));
    const run = () => {
      $$('.hit', table).forEach(x => x.classList.remove('hit')); $$('.hit-col', table).forEach(x => x.classList.remove('hit-col'));
      const q = norm(input.value); if (!q) { out.textContent = ''; return; }
      const hits = [];
      const col = heads.findIndex((th, i) => i > 0 && norm(th.textContent).includes(q));
      if (col > 0) {
        heads[col].classList.add('hit-col');
        rows.forEach(r => { const c = r.cells[col]; if (c && c.textContent.trim() !== '-') { c.classList.add('hit'); hits.push(r.cells[0].textContent.trim() + ' ' + c.textContent.trim()); } });
        out.textContent = hits.length ? `${mentor(col)} 멘토 · ${hits.length}개 세션 — ${hits.join(' / ')}` : '배정된 세션이 없습니다.';
      } else {
        rows.forEach(r => $$('td', r).forEach((c, i) => { if (i && norm(c.textContent).includes(q)) { c.classList.add('hit'); hits.push(r.cells[0].textContent.trim() + ' ' + mentor(i)); } }));
        out.textContent = hits.length ? `${hits.length}개 세션 배정 — ${hits.join(' / ')}` : '일치하는 배정이 없습니다.';
      }
      const f = $('.hit', table); if (f) f.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    };
    input.addEventListener('input', run);
    if (qs().get('q')) { input.value = qs().get('q'); run(); }
  };

  /* ---- RFP 예산 시뮬레이터 ---- */
  modules['rfp-sim'] = (el) => {
    const type = $('#sim-type', el), c = $('#sim-companies', el), m = $('#sim-mentors', el);
    const out = (k, v) => { const x = $('[data-out="' + k + '"]', el); if (x) x.textContent = v; };
    const calc = () => { const base = +type.selectedOptions[0].dataset.base; const total = base + c.value * 45 + m.value * 40; out('companies', c.value + '개사'); out('mentors', m.value + '명'); out('total', total.toLocaleString('ko-KR') + '만 원'); out('breakdown', `기본 운영 ${base.toLocaleString()} + 기업 지원 ${(c.value * 45).toLocaleString()} + 전문가 ${(m.value * 40).toLocaleString()} (만 원)`); return total; };
    [type, c, m].forEach(x => x.addEventListener('input', calc)); calc();
    $('[data-sim-apply]', el).addEventListener('click', () => {
      const total = calc();
      try { sessionStorage.setItem('moarc:rfp', JSON.stringify({ memo: `[시뮬레이터 조건] ${type.selectedOptions[0].textContent.trim()} / 지원 기업 ${c.value}개사 / 전문가 ${m.value}명 / 예상 예산 약 ${total.toLocaleString('ko-KR')}만 원`, companies: c.value + '개사', budget: total < 1500 ? 0 : total < 2500 ? 1 : total < 3500 ? 2 : 3 })); } catch (e) { /* noop */ }
      location.href = '/apply/rfp';
    });
  };

  /* ---- AX As-Is / To-Be ---- */
  modules.ax = (el) => {
    $$('[data-mode]', el).forEach(b => b.addEventListener('click', () => {
      const tobe = b.dataset.mode === 'tobe';
      $$('[data-mode]', el).forEach(x => x.classList.toggle('on', x === b));
      $$('[data-tobe]', el).forEach(x => x.hidden = !tobe); $$('[data-asis]', el).forEach(x => x.hidden = tobe);
    }));
  };

  /* ---- 온라인 접수 폼 ---- */
  const PHONE_RE = /^[0-9+\-\s()]{8,20}$/;
  const TYPE_NAMES = { startup: '스타트업 참가 신청', rfp: '기관 위탁 협의', expert: '전문가(멘토) 등록', contact: '문의' };
  modules.form = async (form) => {
    const type = form.dataset.type;
    const cfg = await config();
    const submitBtn = $('button[type=submit]', form);
    // 시뮬레이터 조건 프리필
    if (type === 'rfp') {
      try { const s = JSON.parse(sessionStorage.getItem('moarc:rfp') || 'null'); if (s) { form.memo.value = s.memo + '\n'; form.companies.value = s.companies; form.budget.selectedIndex = s.budget + 1; sessionStorage.removeItem('moarc:rfp'); toast('시뮬레이터 조건이 입력되었습니다.'); } } catch (e) { /* noop */ }
    }
    if (type === 'startup' && (!cfg.applyOpen || Date.now() > Date.parse(cfg.forumDeadline))) {
      submitBtn.disabled = true; submitBtn.textContent = '접수가 마감되었습니다';
      form.insertAdjacentHTML('afterbegin', `<div class="box-gray mb-6 text-center"><strong class="text-deep-blue">${esc(cfg.forumName)} 접수가 마감되었습니다.</strong><p class="text-sm muted mt-1">다음 회차 모집 공고는 <a class="text-moarc-blue font-bold" href="/news/ir">IR·멘토링 공고</a>에서 확인해 주세요.</p></div>`);
    }

    // 파일 업로드 (Google Drive Resumable)
    const files = [];
    const drop = $('[data-upload]', form);
    if (drop) {
      const input = $('input[type=file]', drop), ul = $('[data-files]', drop), max = +drop.dataset.max || 3;
      const add = async (file) => {
        if (files.length >= max) { toast(`파일은 최대 ${max}개까지 첨부할 수 있습니다.`, 'err'); return; }
        if (file.size > 30 * 1024 * 1024) { toast('30MB 이하 파일만 업로드할 수 있습니다.', 'err'); return; }
        const li = document.createElement('li');
        li.innerHTML = `${ms('description')}<span class="truncate max-w-[45%]">${esc(file.name)}</span><span class="bar"><i></i></span><span class="num text-xs" data-pct>0%</span><button type="button" class="icon-btn" style="width:30px;height:30px;font-size:18px" aria-label="첨부 삭제">${ms('close')}</button>`;
        ul.appendChild(li);
        const entry = { name: file.name, done: false, li };
        files.push(entry);
        li.querySelector('button').addEventListener('click', () => { entry.xhr && entry.xhr.abort(); files.splice(files.indexOf(entry), 1); li.remove(); });
        try {
          const mime = file.type || ({ hwp: 'application/x-hwp', hwpx: 'application/vnd.hancom.hwpx' })[file.name.split('.').pop().toLowerCase()] || 'application/octet-stream';
          const r = await fetch('/api/submit?r=upload-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, mimeType: mime, size: file.size }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok || !d.ok) throw new Error(d.error || '업로드를 시작할 수 없습니다.');
          entry.token = d.token;
          await new Promise((res, rej) => {
            const x = new XMLHttpRequest(); entry.xhr = x;
            x.open('PUT', d.uploadUrl); x.setRequestHeader('Content-Type', mime);
            x.upload.onprogress = (e) => { if (e.lengthComputable) { const p = Math.round(e.loaded / e.total * 100); li.querySelector('i').style.width = p + '%'; li.querySelector('[data-pct]').textContent = p + '%'; } };
            x.onload = () => { if (x.status >= 200 && x.status < 300) { try { entry.id = JSON.parse(x.responseText).id; } catch (e) { /* noop */ } res(); } else rej(new Error('업로드 실패 (' + x.status + ')')); };
            x.onerror = () => rej(new Error('네트워크 오류로 업로드에 실패했습니다.'));
            x.send(file);
          });
          entry.done = true; li.querySelector('[data-pct]').textContent = '완료'; li.querySelector('i').style.width = '100%';
        } catch (err) {
          files.splice(files.indexOf(entry), 1); li.remove();
          toast(err.message + ' IR 자료 링크를 입력해 주세요.', 'err');
        }
      };
      $('[data-pick]', drop).addEventListener('click', () => input.click());
      input.addEventListener('change', () => { Array.from(input.files).forEach(add); input.value = ''; });
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
      drop.addEventListener('drop', (e) => Array.from(e.dataTransfer.files).forEach(add));
    }

    form.addEventListener('reset', () => { files.splice(0).forEach(f => f.li.remove()); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('[aria-invalid]', form).forEach(x => x.removeAttribute('aria-invalid'));
      $$('input[type=tel]', form).forEach(x => x.setCustomValidity(x.value && !PHONE_RE.test(x.value.trim()) ? '전화번호 형식을 확인해 주세요. (예: 010-1234-5678)' : ''));
      if (!form.checkValidity()) { const bad = $(':invalid', form); if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.reportValidity(); } return; }
      if (files.some(f => !f.done)) { toast('파일 업로드가 끝난 뒤 제출해 주세요.', 'err'); return; }
      const data = { type, consent: form.consent.checked, page: location.href, files: files.map(f => ({ id: f.id, token: f.token })) };
      new FormData(form).forEach((v, k) => { if (k !== 'consent') data[k] = String(v).trim(); });
      const label = submitBtn.innerHTML; submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spin"></span> 제출 중…';
      try {
        const r = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || '전송 실패'), { status: r.status });
        form.reset();
        const rows = [['접수번호', d.receipt], ['신청 구분', TYPE_NAMES[type]], ['성명', data.name], ['이메일', data.email]].concat(data.company ? [['기업명', data.company]] : []).concat(data.org ? [['소속', data.org]] : []);
        modal({ kicker: '접수 완료', title: '정상적으로 접수되었습니다', html: `<div class="box-gray text-center mb-4"><span class="ms text-[44px] text-moarc-blue" aria-hidden="true">check_circle</span><p class="num text-xl font-extrabold text-deep-blue mt-1">${esc(d.receipt)}</p></div><div class="tbl-wrap"><table class="tbl"><tbody>${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div><p class="text-sm muted mt-3">입력하신 이메일로 접수 확인 메일이 발송됩니다. 문의: ${esc(cfg.contactEmail)}</p>`, actions: [{ label: '확인', primary: true }] });
      } catch (err) {
        if (err.status === 400) { modal({ kicker: '입력 확인', title: '입력 내용을 확인해 주세요', html: `<p>${esc(err.message)}</p>`, actions: [{ label: '확인', primary: true }] }); }
        else {
          const lines = Object.entries(data).filter(([k]) => !['type', 'consent', 'page', 'files', 'website'].includes(k) && data[k]).map(([k, v]) => `${k}: ${v}`).join('\n');
          modal({ kicker: '전송 실패', title: '온라인 접수가 일시적으로 전송되지 않았습니다', html: `<p>네트워크 또는 서버 문제로 접수가 완료되지 않았습니다. 잠시 후 다시 시도하시거나, 작성하신 내용을 이메일로 보내주세요.</p><p class="text-sm muted mt-2">${esc(cfg.contactEmail)}</p>`, actions: [{ label: '이메일로 접수', primary: true, href: `mailto:${cfg.contactEmail}?subject=${encodeURIComponent('[홈페이지 접수] ' + TYPE_NAMES[type])}&body=${encodeURIComponent(lines)}` }, { label: '닫기' }] });
        }
      } finally { submitBtn.disabled = false; submitBtn.innerHTML = label; }
    });
  };

  /* ---- 통합검색 ---- */
  modules.search = async (el) => {
    const form = $('[data-form]', el), sum = $('[data-summary]', el), res = $('[data-results]', el);
    const q0 = qs().get('q') || ''; form.q.value = q0;
    if (!q0.trim()) { sum.textContent = '검색어를 입력해 주세요.'; return; }
    const [idx, ps] = await Promise.all([getJSON('/assets/data/search.json').catch(() => []), posts().catch(() => [])]);
    const terms = q0.trim().split(/\s+/).map(norm).filter(Boolean);
    const match = (t) => terms.every(x => norm(t).includes(x));
    const snip = (t) => { const s = String(t); const i = s.toLowerCase().indexOf(q0.trim().split(/\s+/)[0].toLowerCase()); const a = Math.max(0, i - 40); return (a ? '…' : '') + s.slice(a, a + 140) + '…'; };
    const hl = (t) => { let h = esc(t); q0.trim().split(/\s+/).filter(Boolean).forEach(w => { h = h.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark class="bg-yellow-100">${m}</mark>`); }); return h; };
    const pages = idx.filter(p => match(p.t + ' ' + p.x));
    const posts2 = ps.filter(p => match(p.title + ' ' + p.summary + ' ' + p.body));
    sum.innerHTML = `‘<strong class="text-moarc-blue">${esc(q0)}</strong>’에 대한 검색 결과 총 <strong>${pages.length + posts2.length}</strong>건`;
    const sec = (title, items) => `<h4 class="h4">${title} <span class="text-moarc-blue num">${items.length}</span></h4>` + (items.length ? `<ul class="board-list">${items.join('')}</ul>` : '<p class="board-empty">검색 결과가 없습니다.</p>');
    res.innerHTML = sec('메뉴 · 페이지', pages.map(p => `<li><a href="${p.p}" style="grid-template-columns:1fr"><span class="tit"><strong>${hl(p.g + ' > ' + p.t)}</strong><p>${hl(snip(p.x))}</p></span></a></li>`)) +
      sec('게시물', posts2.map(p => `<li><a href="${BOARDS[p.board].path}?id=${encodeURIComponent(p.id)}"><span class="no"><span class="badge gray">${esc(BOARDS[p.board].label)}</span></span><span class="tit"><strong>${hl(p.title)}</strong><p>${hl(p.summary || '')}</p></span><span class="date">${esc(String(p.date).replace(/-/g, '.'))}</span></a></li>`));
  };

  /* ---------------- 초기화 ---------------- */
  $$('[data-module]').forEach(el => {
    const fn = modules[el.dataset.module];
    if (fn) { try { fn(el); } catch (e) { console.error('[module]', el.dataset.module, e); } }
  });
  config().then(cfg => {
    if ($('[data-module="countdown"], [data-cd-inline]')) countdowns(cfg);
    const bar = $('[data-main-notice]');
    if (bar && cfg.mainNotice) { $('[data-text]', bar).textContent = cfg.mainNotice; bar.hidden = false; }
    $$('[data-forum-name]').forEach(h => { h.innerHTML = esc(cfg.forumName).replace(' 정례', '<br>정례'); });
  });
  window.MOARC = { toast, modal, renderBody };
})();
