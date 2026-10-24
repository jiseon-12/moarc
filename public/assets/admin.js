/* =====================================================================
 * MOARC PARTNERS — 관리자 모드
 * Google 로그인 · 온라인 접수/심사 · 게시판 · 일정(Calendar) · 자료실(Drive) · 메일(Gmail) · 설정
 * ===================================================================== */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const ms = (n) => `<span class="ms" aria-hidden="true">${n}</span>`;
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d, time = true) => { if (!d) return '-'; const x = new Date(d); return `${x.getFullYear()}.${pad(x.getMonth() + 1)}.${pad(x.getDate())}` + (time ? ` ${pad(x.getHours())}:${pad(x.getMinutes())}` : ''); };
  const kstInput = (iso) => { const t = Date.parse(iso); return isNaN(t) ? '' : new Date(t + 9 * 3600e3).toISOString().slice(0, 16); };
  const view = $('#adm-view');
  const TYPES = { startup: '스타트업 참가', rfp: '기관 위탁', expert: '전문가 등록', contact: '일반 문의' };
  const STATUSES = ['접수', '검토중', '선정', '보류', '미선정', '완료'];
  const BOARDS = { notice: '공지사항', ir: 'IR·멘토링 공고', press: '보도자료', activity: '주요동정', recruit: '인재채용' };
  const LABELS = { company: '기업명', org: '기관/소속', name: '성명', position: '직책', phone: '연락처', email: '이메일', category: '사업 분야', field: '전문 분야', product: '제품·서비스', stage: '성장 단계', mentorField: '희망 멘토링', timeslot: '희망 세션', concern: '상담 내용', deckUrl: 'IR 자료 링크', budget: '예산 규모', period: '희망 일정', companies: '대상 기업 수', memo: '내용', career: '주요 경력', subject: '제목', homepage: '홈페이지' };
  const SCORE = [['tech', '기술성 · 혁신성'], ['market', '시장성 · 성장성'], ['biz', '사업화 · 판로'], ['invest', '후속투자 적합도']];
  let ME = null;

  /* ---------------- 공통 UI ---------------- */
  function toast(msg, type) {
    const box = $('#toasts'); const t = document.createElement('div');
    t.className = 'toast' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
    t.innerHTML = ms(type === 'err' ? 'error' : type === 'ok' ? 'check_circle' : 'info'); t.appendChild(document.createTextNode(msg));
    box.appendChild(t); setTimeout(() => t.remove(), 4500);
  }
  function modal({ kicker = '', title = '', html = '', actions = [] }) {
    $('#modal-kicker').textContent = kicker; $('#modal-title').textContent = title; $('#modal-body').innerHTML = html;
    const f = $('#modal-foot'); f.innerHTML = '';
    actions.forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm ' + (a.danger ? 'btn-dark' : a.primary ? 'btn-primary' : 'btn-line'); b.textContent = a.label; b.onclick = async () => { if (a.onClick && (await a.onClick()) === false) return; closeModal(); }; f.appendChild(b); });
    $('#modal').classList.add('open');
  }
  const closeModal = () => $('#modal').classList.remove('open');
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close-modal]') || e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); $('#adm-side').classList.remove('open'); } });
  const confirmBox = (title, html) => new Promise(res => modal({ kicker: '확인', title, html, actions: [{ label: '취소', onClick: () => res(false) }, { label: '확인', danger: true, onClick: () => res(true) }] }));

  async function api(route, { method = 'GET', body, query = {} } = {}) {
    const q = new URLSearchParams({ r: route, ...query });
    const r = await fetch('/api/admin?' + q, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Moarc-Admin': '1' }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({ ok: false, error: '서버 응답 오류 (' + r.status + ')' }));
    if (r.status === 401) { location.reload(); throw new Error('세션 만료'); }
    if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || '요청 실패'), { code: d.code, status: r.status });
    return d;
  }
  async function busy(btn, fn) {
    const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 처리 중';
    try { return await fn(); } catch (e) { toast(e.message, 'err'); throw e; } finally { btn.disabled = false; btn.innerHTML = html; }
  }
  const loading = () => { view.innerHTML = '<div class="adm-empty"><span class="spin"></span> 불러오는 중…</div>'; };
  const errorView = (e) => {
    view.innerHTML = e.code === 'NOT_CONNECTED' ? connectCta() : `<div class="adm-card"><p class="text-red-700 font-bold">${ms('error')} ${esc(e.message)}</p></div>`;
  };
  function connectCta() {
    return `<div class="adm-card text-center" style="padding:48px 24px"><span class="ms text-[48px] text-moarc-blue" aria-hidden="true">link</span>
      <h2 class="text-xl font-extrabold mt-2">Google 계정 연동이 필요합니다</h2>
      <p class="muted mt-2 text-sm">Gmail · Google Drive · Google Calendar를 연결하면 온라인 접수 저장, 알림 메일, 자료실, 공개 일정을 이 화면에서 관리할 수 있습니다.</p>
      <a class="btn btn-primary mt-6" href="/api/auth?a=connect">${ms('link')} Google 계정 연동하기</a>
      <p class="mt-3"><a class="text-sm text-moarc-blue font-bold" href="#/integrations">연동 안내 보기</a></p></div>`;
  }
  const statusBadge = (s) => `<span class="badge st-${esc(s)}">${esc(s)}</span>`;
  function downloadCsv(name, rows) {
    const csv = rows.map(r => r.map(c => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  // 게시판 본문 미리보기 (공개 사이트와 동일 규칙)
  function renderBody(text) {
    const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" class="text-moarc-blue underline">$1</a>');
    return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(block => {
      const out = []; let ul = [], tb = []; const para = [];
      const flush = () => { if (ul.length) { out.push('<ul>' + ul.map(l => '<li>' + linkify(esc(l)) + '</li>').join('') + '</ul>'); ul = []; } if (tb.length) { out.push('<table><tbody>' + tb.map(r => '<tr>' + r.map((c, i) => i ? `<td>${linkify(esc(c))}</td>` : `<th>${esc(c)}</th>`).join('') + '</tr>').join('') + '</tbody></table>'); tb = []; } };
      block.split('\n').filter(l => l.trim()).forEach(l => { const t = l.trim();
        if (/^-\s+/.test(t)) { if (tb.length) flush(); ul.push(t.replace(/^-\s+/, '')); }
        else if (/^\|.*\|$/.test(t)) { if (ul.length) flush(); tb.push(t.slice(1, -1).split('|').map(c => c.trim())); }
        else if (/^##\s+/.test(t)) { flush(); if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para.length = 0; } out.push('<h5>' + esc(t.slice(3)) + '</h5>'); }
        else { flush(); para.push(linkify(esc(t))); } });
      flush(); if (para.length) out.push('<p>' + para.join('<br>') + '</p>'); return out.join('');
    }).join('');
  }

  /* ---------------- 부트 · 라우터 ---------------- */
  async function boot() {
    const r = await fetch('/api/auth?a=me', { credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    $('#adm-boot').hidden = true;
    if (r.status === 401 || !d.ok) return showLogin(d.setup || {});
    ME = d;
    $('#adm-app').hidden = false;
    $('#adm-user').textContent = d.user.email;
    renderConn();
    window.addEventListener('hashchange', route);
    $('#adm-menu-btn').addEventListener('click', (e) => { e.stopPropagation(); $('#adm-side').classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!e.target.closest('#adm-side') && !e.target.closest('#adm-menu-btn')) $('#adm-side').classList.remove('open'); });
    if (!location.hash) location.hash = '#/dashboard'; else route();
  }
  function showLogin(setup) {
    $('#adm-login').hidden = false;
    const pw = $('#adm-pw-form');
    pw.hidden = !setup.passwordLogin;
    $('#adm-google').hidden = !setup.googleConfigured;
    $('#adm-or').hidden = !(setup.passwordLogin && setup.googleConfigured);
    if (setup.passwordLogin) setTimeout(() => $('#adm-id').focus(), 50);
    pw.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', pw); btn.disabled = true; $('#adm-pw-err').textContent = '';
      try {
        const r = await fetch('/api/auth?a=password', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pw.id.value.trim(), password: pw.password.value }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw new Error(d.error || '로그인 실패');
        location.replace('/admin#/dashboard'); location.reload();
      } catch (err) { $('#adm-pw-err').textContent = err.message; pw.password.value = ''; pw.password.focus(); }
      finally { btn.disabled = false; }
    };
    const items = [
      [setup.passwordLogin || setup.googleConfigured, '로그인 방식', 'ADMIN_ID · ADMIN_PASSWORD (또는 Google: GOOGLE_CLIENT_ID · ADMIN_EMAILS)'],
      [setup.sessionSecretSet, '세션 암호 키', 'SESSION_SECRET (16자 이상)']
    ];
    if (items.some(i => i[0] === false)) {
      $('#adm-setup').innerHTML = '<li><b>초기 설정이 필요합니다</b> — Vercel 환경변수를 확인하세요.</li>' + items.map(([ok, t, k]) => `<li class="${ok ? '' : 'bad'}">${ms(ok ? 'check_circle' : 'error')}<span>${t}<br><code class="adm-code">${k}</code></span></li>`).join('');
    }
    const err = new URLSearchParams(location.search).get('error'); if (err) toast(err, 'err');
  }
  function renderConn() {
    const c = ME.google.connected;
    const el = $('#adm-conn'); el.className = 'adm-conn ' + (c ? 'ok' : 'no'); el.textContent = c ? 'Google 연동됨' : 'Google 미연동';
    $('#adm-banner').innerHTML = c ? '' : `<div class="adm-banner">${ms('warning')}<span><b>Google 계정이 연동되지 않았습니다.</b> 접수 저장 · 메일 · 자료실 · 일정 기능을 쓰려면 연동해 주세요.</span><a class="btn btn-primary btn-sm" href="/api/auth?a=connect">지금 연동</a></div>`;
  }
  const ROUTES = {};
  const TITLES = { dashboard: '대시보드', applications: '온라인 접수 · 심사', posts: '게시판 관리', events: '일정 관리', library: '자료실', mail: '메일 발송', settings: '사이트 설정', integrations: 'Google 연동' };
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, q] = h.split('?');
    const [name, arg] = path.split('/');
    const params = new URLSearchParams(q || '');
    const r = ROUTES[name] ? name : 'dashboard';
    $$('.adm-nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
    $('#adm-title').textContent = TITLES[r];
    document.title = TITLES[r] + ' | MOARC 관리자';
    $('#adm-side').classList.remove('open');
    if (params.get('connected')) { toast('Google 계정이 연동되었습니다.', 'ok'); history.replaceState(null, '', '#/' + name); }
    window.scrollTo(0, 0);
    loading();
    Promise.resolve(ROUTES[r](arg, params)).catch(errorView);
  }

  /* ================================================================
   * 대시보드
   * ================================================================ */
  ROUTES.dashboard = async () => {
    if (!ME.google.connected) { view.innerHTML = connectCta(); return; }
    const d = await api('dashboard');
    const max = Math.max(1, ...Object.values(d.byStatus));
    view.innerHTML = `
      <div class="adm-stats">
        <div class="adm-stat"><span>${ms('inbox')}전체 접수</span><b>${d.totals.apps}</b></div>
        <div class="adm-stat"><span>${ms('fiber_new')}최근 7일 접수</span><b>${d.totals.newWeek}</b></div>
        <div class="adm-stat"><span>${ms('article')}게시물</span><b>${d.totals.posts}</b></div>
        <div class="adm-stat"><span>${ms('event')}60일 내 일정</span><b>${d.totals.events}</b></div>
      </div>
      <div class="adm-2 mt-4">
        <div class="adm-card"><div class="adm-card-h">${ms('schedule')}최근 접수<span class="act"><a class="btn btn-line btn-sm" href="#/applications">전체 보기</a></span></div>
          ${d.recent.length ? `<div class="overflow-x-auto"><table class="adm-tbl"><thead><tr><th>접수일</th><th>구분</th><th>기업/기관</th><th>성명</th><th>상태</th></tr></thead><tbody>${d.recent.map(a => `<tr class="click" data-go="#/applications/${esc(a.id)}"><td class="num text-sm">${fmt(a.receivedAt)}</td><td>${esc(TYPES[a.type] || a.type)}</td><td class="ellipsis font-semibold">${esc(a.title)}</td><td>${esc(a.name)}</td><td>${statusBadge(a.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="adm-empty">아직 접수된 건이 없습니다.</p>'}
        </div>
        <div class="adm-grid">
          <div class="adm-card"><div class="adm-card-h">${ms('donut_small')}처리 현황</div>
            ${STATUSES.map(s => `<div class="flex items-center gap-3 mb-2 text-sm"><span class="w-14">${statusBadge(s)}</span><div class="adm-bar flex-1"><i style="width:${(d.byStatus[s] || 0) / max * 100}%"></i></div><b class="num w-8 text-right">${d.byStatus[s] || 0}</b></div>`).join('')}
          </div>
          <div class="adm-card"><div class="adm-card-h">${ms('event')}다가오는 일정<span class="act"><a class="btn btn-line btn-sm" href="#/events">관리</a></span></div>
            ${d.upcoming.length ? d.upcoming.map(e => `<div class="flex gap-3 py-2 border-b border-line text-sm"><span class="num text-moarc-blue font-bold w-24 shrink-0">${fmt(e.start, !e.allDay)}</span><span class="truncate">${esc(e.title)}</span></div>`).join('') : '<p class="adm-empty" style="padding:16px 0">예정된 일정이 없습니다.</p>'}
          </div>
        </div>
      </div>
      <div class="adm-card mt-4"><div class="adm-card-h">${ms('leaderboard')}심사 점수 순위 (채점 완료 기준)</div>
        ${d.leaderboard.length ? d.leaderboard.map((a, i) => `<div class="flex items-center gap-3 py-2 text-sm"><span class="w-7 h-7 rounded-full ${i ? 'bg-moarc-blue' : 'bg-deep-blue'} text-white flex items-center justify-center font-bold text-xs">${i + 1}</span><a class="font-semibold w-48 truncate hover:text-moarc-blue" href="#/applications/${esc(a.id)}">${esc(a.title)}</a><div class="adm-bar flex-1"><i style="width:${a.total}%"></i></div><b class="num w-16 text-right">${a.total} / 100</b></div>`).join('') : '<p class="adm-empty" style="padding:16px 0">채점된 접수가 없습니다. 접수 상세 화면에서 채점할 수 있습니다.</p>'}
      </div>`;
    $$('[data-go]', view).forEach(tr => tr.addEventListener('click', () => { location.hash = tr.dataset.go; }));
  };

  /* ================================================================
   * 온라인 접수 · 심사
   * ================================================================ */
  ROUTES.applications = async (id) => {
    if (id) return appDetail(id);
    const d = await api('apps');
    const apps = d.apps;
    const sel = new Set();
    view.innerHTML = `
      <div class="adm-card">
        <div class="adm-toolbar">
          <select data-f="type" aria-label="구분"><option value="">전체 구분</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <select data-f="status" aria-label="상태"><option value="">전체 상태</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select>
          <input type="search" data-f="q" class="grow" placeholder="기업명 · 성명 · 이메일 · 접수번호 검색" aria-label="검색">
          <button type="button" class="btn btn-line btn-sm" data-act="csv">${ms('download')}CSV</button>
          <button type="button" class="btn btn-primary btn-sm" data-act="mail" disabled>${ms('mail')}선택 메일 발송 <span data-cnt></span></button>
        </div>
        <div class="overflow-x-auto"><table class="adm-tbl"><thead><tr><th><input type="checkbox" data-all aria-label="전체 선택"></th><th>접수번호</th><th>접수일</th><th>구분</th><th>기업/기관</th><th>성명</th><th>이메일</th><th>첨부</th><th>점수</th><th>상태</th></tr></thead><tbody data-rows></tbody></table></div>
        <p class="text-xs muted mt-3">${ms('add_to_drive')} 접수 데이터는 Google Drive <b>MOARC Portal / 01_온라인접수</b> 폴더에 저장됩니다.</p>
      </div>`;
    const f = (k) => $(`[data-f="${k}"]`, view);
    const filtered = () => { const q = f('q').value.trim().toLowerCase(); return apps.filter(a => (!f('type').value || a.type === f('type').value) && (!f('status').value || a.status === f('status').value) && (!q || [a.title, a.name, a.email, a.receipt].join(' ').toLowerCase().includes(q))); };
    const updSel = () => { $('[data-cnt]', view).textContent = sel.size ? `(${sel.size})` : ''; $('[data-act="mail"]', view).disabled = !sel.size; };
    const render = () => {
      const list = filtered();
      $('[data-rows]', view).innerHTML = list.length ? list.map(a => `<tr class="click" data-id="${esc(a.id)}"><td><input type="checkbox" data-sel="${esc(a.id)}" ${sel.has(a.id) ? 'checked' : ''} aria-label="선택"></td><td class="num text-xs">${esc(a.receipt)}</td><td class="num text-sm whitespace-nowrap">${fmt(a.receivedAt)}</td><td class="whitespace-nowrap">${esc(TYPES[a.type] || a.type)}</td><td class="ellipsis font-semibold">${esc(a.title)}</td><td class="whitespace-nowrap">${esc(a.name)}</td><td class="ellipsis text-sm">${esc(a.email)}</td><td class="text-center">${a.files ? ms('attach_file') + a.files : '-'}</td><td class="num">${a.total != null ? a.total : '-'}</td><td>${statusBadge(a.status)}</td></tr>`).join('') : '<tr><td colspan="10" class="adm-empty">조건에 맞는 접수가 없습니다.</td></tr>';
    };
    view.addEventListener('input', (e) => { if (e.target.dataset.f) render(); });
    view.addEventListener('change', (e) => {
      if (e.target.dataset.sel) { e.target.checked ? sel.add(e.target.dataset.sel) : sel.delete(e.target.dataset.sel); updSel(); }
      if (e.target.hasAttribute('data-all')) { filtered().forEach(a => e.target.checked ? sel.add(a.id) : sel.delete(a.id)); render(); updSel(); }
    });
    view.addEventListener('click', (e) => {
      if (e.target.closest('input')) return;
      const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#/applications/' + tr.dataset.id;
    });
    $('[data-act="csv"]', view).onclick = () => downloadCsv(`MOARC_applications_${today()}.csv`, [['접수번호', '접수일시', '구분', '기업/기관', '성명', '이메일', '연락처', '분야', '상태', '점수', '첨부수', 'Drive 링크']].concat(filtered().map(a => [a.receipt, fmt(a.receivedAt), TYPES[a.type] || a.type, a.title, a.name, a.email, a.phone, a.category, a.status, a.total ?? '', a.files || 0, a.link])));
    $('[data-act="mail"]', view).onclick = () => { location.hash = '#/mail?ids=' + [...sel].join(','); };
    render();
  };

  async function appDetail(id) {
    const { app } = await api('app', { query: { id } });
    const isStartup = app.type === 'startup';
    const scores = app.scores || { tech: 0, market: 0, biz: 0, invest: 0 };
    view.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 mb-4"><a class="btn btn-line btn-sm" href="#/applications">${ms('arrow_back')}목록</a><span class="badge gray num">${esc(app.receipt)}</span><span class="badge">${esc(TYPES[app.type])}</span>${statusBadge(app.status)}
        <span class="ml-auto flex gap-2"><a class="btn btn-line btn-sm" href="${esc(app.link)}" target="_blank" rel="noopener">${ms('add_to_drive')}Drive에서 열기</a><a class="btn btn-primary btn-sm" href="#/mail?ids=${esc(app.id)}">${ms('mail')}메일 보내기</a></span></div>
      <div class="adm-2">
        <div class="adm-grid">
          <div class="adm-card"><h2>${ms('description')}${esc(app.data.company || app.data.org || app.data.name)}</h2>
            <dl class="adm-kv">${Object.entries(app.data).filter(([, v]) => v).map(([k, v]) => `<dt>${esc(LABELS[k] || k)}</dt><dd>${k === 'deckUrl' || k === 'homepage' ? `<a class="text-moarc-blue underline" href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>` : k === 'email' ? `<a class="text-moarc-blue" href="mailto:${esc(v)}">${esc(v)}</a>` : esc(v)}</dd>`).join('')}<dt>접수일시</dt><dd>${fmt(app.receivedAt)}</dd></dl>
          </div>
          <div class="adm-card"><h2>${ms('attach_file')}첨부파일 (Google Drive)</h2>
            ${(app.attachments || []).length ? app.attachments.map(a => `<a class="flex items-center gap-2 py-2 border-b border-line hover:text-moarc-blue" href="${esc(a.link)}" target="_blank" rel="noopener">${ms('description')}<span class="truncate">${esc(a.name)}</span><span class="ml-auto text-xs muted num">${(a.size / 1024 / 1024).toFixed(1)}MB</span></a>`).join('') : '<p class="muted text-sm">첨부파일 없음</p>'}
          </div>
          <div class="adm-card"><h2>${ms('history')}처리 이력</h2><ul class="adm-hist">${(app.history || []).slice().reverse().map(h => `<li><time>${fmt(h.at)}</time><span>${esc(h.action)} <span class="muted">· ${esc(h.by)}</span></span></li>`).join('')}</ul></div>
        </div>
        <div class="adm-card adm-form" style="align-self:start">
          <h2>${ms('rule')}처리 · 심사</h2>
          <div class="f"><label for="st">진행 상태</label><select id="st">${STATUSES.map(s => `<option ${s === app.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          ${isStartup ? `<div class="f"><span class="l">심사 채점 (각 25점)</span><div class="adm-score">${SCORE.map(([k, l]) => `<label>${l}<span><input type="range" min="0" max="25" value="${scores[k] || 0}" data-score="${k}"><b class="num" data-sv="${k}">${scores[k] || 0}</b></span></label>`).join('')}</div><div class="adm-total"><span>합계</span><b data-total>0</b></div></div>` : ''}
          <div class="f"><label for="memo">내부 메모</label><textarea id="memo" rows="5" placeholder="담당자 메모 (외부 비공개)">${esc(app.memo || '')}</textarea></div>
          <div class="adm-actions"><button type="button" class="btn btn-line btn-sm" data-del style="color:#B91C1C">${ms('delete')}삭제</button><button type="button" class="btn btn-primary btn-sm" data-save>${ms('save')}저장</button></div>
        </div>
      </div>`;
    const total = () => { const t = $$('[data-score]', view).reduce((s, x) => s + +x.value, 0); const el = $('[data-total]', view); if (el) el.textContent = t + ' / 100'; $$('[data-score]', view).forEach(x => $(`[data-sv="${x.dataset.score}"]`, view).textContent = x.value); };
    view.addEventListener('input', (e) => { if (e.target.dataset.score) total(); }); total();
    $('[data-save]', view).onclick = (e) => busy(e.currentTarget, async () => {
      const body = { id: app.id, status: $('#st').value, memo: $('#memo').value };
      if (isStartup) body.scores = Object.fromEntries($$('[data-score]', view).map(x => [x.dataset.score, +x.value]));
      await api('app-update', { method: 'POST', body }); toast('저장되었습니다.', 'ok'); appDetail(id);
    });
    $('[data-del]', view).onclick = async () => {
      if (!(await confirmBox('접수 건을 삭제할까요?', '<p>Google Drive의 접수 파일이 휴지통이 아닌 <b>영구 삭제</b>됩니다. 첨부파일은 Drive에 남습니다.</p>'))) return;
      await api('app-delete', { method: 'POST', body: { id: app.id } }); toast('삭제되었습니다.', 'ok'); location.hash = '#/applications';
    };
  }

  /* ================================================================
   * 게시판 관리
   * ================================================================ */
  ROUTES.posts = async (id) => {
    const d = await api('posts');
    if (id) return postEdit(d.posts.find(p => p.id === id) || null, d.connected);
    let board = '';
    view.innerHTML = `${d.connected ? '' : '<div class="adm-banner" style="margin:0 0 16px">' + ms('info') + ' Google 미연동 상태에서는 기본 게시물만 표시되며 수정할 수 없습니다.</div>'}
      <div class="adm-card"><div class="adm-toolbar"><div class="tabs" style="border:0" data-tabs>${[['', '전체']].concat(Object.entries(BOARDS)).map(([k, v]) => `<button type="button" data-b="${k}" class="${k === '' ? 'on' : ''}">${v}</button>`).join('')}</div>
        <a class="btn btn-primary btn-sm ml-auto" href="#/posts/new">${ms('edit')}새 글 작성</a></div>
        <div class="overflow-x-auto"><table class="adm-tbl"><thead><tr><th>게시판</th><th>제목</th><th>게시일</th><th>고정</th><th></th></tr></thead><tbody data-rows></tbody></table></div></div>`;
    const render = () => {
      const list = d.posts.filter(p => !board || p.board === board).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      $('[data-rows]', view).innerHTML = list.map(p => `<tr class="click" data-id="${esc(p.id)}"><td class="whitespace-nowrap"><span class="badge gray">${esc(BOARDS[p.board])}</span></td><td class="ellipsis font-semibold" style="max-width:520px">${esc(p.title)}</td><td class="num text-sm">${esc(p.date)}</td><td>${p.pinned ? ms('push_pin') : ''}</td><td class="text-right"><a class="text-sm text-moarc-blue" href="${{ notice: '/news/notice', ir: '/news/ir', press: '/news/press', activity: '/news/activity', recruit: '/news/recruit' }[p.board]}?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" data-stop>보기</a></td></tr>`).join('') || '<tr><td colspan="5" class="adm-empty">게시물이 없습니다.</td></tr>';
    };
    $('[data-tabs]', view).onclick = (e) => { const b = e.target.closest('[data-b]'); if (!b) return; board = b.dataset.b; $$('[data-b]', view).forEach(x => x.classList.toggle('on', x === b)); render(); };
    view.onclick = (e) => { if (e.target.closest('[data-stop]')) return; const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#/posts/' + tr.dataset.id; };
    render();
  };

  async function postEdit(post, connected) {
    view.onclick = null;
    const p = post || { board: 'notice', title: '', summary: '', body: '', date: today(), pinned: false, attachments: [] };
    view.innerHTML = `<div class="mb-4"><a class="btn btn-line btn-sm" href="#/posts">${ms('arrow_back')}목록</a></div>
      <div class="adm-2e">
        <form class="adm-card adm-form" data-form>
          <h2>${ms('edit')}${post ? '게시물 수정' : '새 게시물'}</h2>
          <div class="row3"><div class="f"><label for="pb">게시판</label><select id="pb" name="board">${Object.entries(BOARDS).map(([k, v]) => `<option value="${k}" ${k === p.board ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="f"><label for="pd">게시일</label><input id="pd" type="date" name="date" value="${esc(p.date)}"></div>
            <div class="f"><span class="l">옵션</span><label class="chk" style="height:40px"><input type="checkbox" name="pinned" ${p.pinned ? 'checked' : ''}>상단 고정(공지)</label></div></div>
          <div class="f"><label for="pt">제목</label><input id="pt" type="text" name="title" required maxlength="200" value="${esc(p.title)}"></div>
          <div class="f"><label for="ps">요약 (목록 · 메인 노출)</label><input id="ps" type="text" name="summary" maxlength="400" value="${esc(p.summary)}"></div>
          <div class="f"><label for="pbody">본문</label><textarea id="pbody" name="body" rows="14">${esc(p.body)}</textarea>
            <p class="text-xs muted">서식: 빈 줄 = 문단 · <code class="adm-code">## 소제목</code> · <code class="adm-code">- 목록</code> · <code class="adm-code">| 항목 | 내용 |</code> 표 · URL 자동 링크</p></div>
          <div class="f"><span class="l">첨부 링크</span><div data-atts class="grid gap-2"></div>
            <div class="flex gap-2"><button type="button" class="btn btn-line btn-sm" data-add-att>${ms('add')}링크 추가</button><button type="button" class="btn btn-line btn-sm" data-pick-lib>${ms('add_to_drive')}자료실에서 선택</button></div></div>
          <div class="adm-actions">${post ? `<button type="button" class="btn btn-line btn-sm" data-del style="color:#B91C1C">${ms('delete')}삭제</button>` : ''}<button type="submit" class="btn btn-primary btn-sm" ${connected ? '' : 'disabled title="Google 연동 필요"'}>${ms('save')}저장 · 게시</button></div>
        </form>
        <div class="adm-card"><h2>${ms('visibility')}미리보기</h2><div class="view-head" style="padding:16px 4px"><h4 data-pv-title></h4><div class="meta"><span data-pv-date></span><span data-pv-board></span></div></div><div class="view-body adm-preview" data-pv-body></div></div>
      </div>`;
    const form = $('[data-form]', view);
    const atts = $('[data-atts]', view);
    const addAtt = (a = { name: '', url: '' }) => { const row = document.createElement('div'); row.className = 'flex gap-2'; row.innerHTML = `<input type="text" class="adm-input" style="width:40%" placeholder="파일명" value="${esc(a.name)}" data-an><input type="url" class="adm-input flex-1" placeholder="https://drive.google.com/..." value="${esc(a.url)}" data-au><button type="button" class="icon-btn" aria-label="삭제">${ms('close')}</button>`; row.querySelector('button').onclick = () => row.remove(); atts.appendChild(row); };
    (p.attachments || []).forEach(addAtt);
    $('[data-add-att]', view).onclick = () => addAtt();
    $('[data-pick-lib]', view).onclick = async () => {
      try {
        const { files } = await api('files');
        const pub = files.filter(f => f.public);
        modal({ kicker: '자료실', title: '첨부할 공개 자료 선택', html: pub.length ? pub.map((f, i) => `<label class="flex items-center gap-2 py-2 border-b border-line text-sm"><input type="checkbox" value="${i}">${esc(f.name)}</label>`).join('') : '<p class="muted">공개로 설정된 자료가 없습니다. [자료실]에서 업로드 후 공개로 설정하세요.</p>', actions: [{ label: '취소' }, { label: '추가', primary: true, onClick: () => { $$('#modal-body input:checked').forEach(c => { const f = pub[+c.value]; addAtt({ name: f.name, url: f.viewUrl }); }); } }] });
      } catch (e) { toast(e.message, 'err'); }
    };
    const pv = () => { $('[data-pv-title]', view).textContent = form.title.value || '(제목)'; $('[data-pv-date]', view).textContent = form.date.value; $('[data-pv-board]', view).textContent = BOARDS[form.board.value]; $('[data-pv-body]', view).innerHTML = renderBody(form.body.value || form.summary.value); };
    form.addEventListener('input', pv); pv();
    form.onsubmit = (e) => { e.preventDefault(); if (!form.reportValidity()) return; busy($('button[type=submit]', form), async () => {
      const body = { post: { id: post && post.id, board: form.board.value, date: form.date.value, pinned: form.pinned.checked, title: form.title.value, summary: form.summary.value, body: form.body.value, attachments: $$('[data-atts] > div', view).map(r => ({ name: $('[data-an]', r).value, url: $('[data-au]', r).value })).filter(a => a.url) } };
      const r = await api('post-save', { method: 'POST', body }); toast('게시되었습니다. 홈페이지 반영까지 최대 1분 소요됩니다.', 'ok'); location.hash = '#/posts/' + r.post.id;
    }); };
    const del = $('[data-del]', view);
    if (del) del.onclick = async () => { if (!(await confirmBox('게시물을 삭제할까요?', '<p>삭제된 게시물은 복구할 수 없습니다.</p>'))) return; await api('post-delete', { method: 'POST', body: { id: post.id } }); toast('삭제되었습니다.', 'ok'); location.hash = '#/posts'; };
  }

  /* ================================================================
   * 일정 관리 (Google Calendar)
   * ================================================================ */
  ROUTES.events = async () => {
    const d = await api('events');
    const evs = d.events;
    view.innerHTML = `<div class="adm-2">
      <div class="adm-card"><div class="adm-card-h">${ms('calendar_month')}공개 일정 <span class="text-xs muted font-normal">· Google 캘린더 “MOARC PARTNERS 공개일정”</span><span class="act"><a class="btn btn-line btn-sm" href="https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(d.calendarId)}" target="_blank" rel="noopener">${ms('open_in_new')}캘린더 열기</a></span></div>
        <div class="overflow-x-auto"><table class="adm-tbl"><thead><tr><th>일시</th><th>제목</th><th>분류</th><th>장소</th><th></th></tr></thead><tbody>${evs.length ? evs.map((e, i) => `<tr class="click" data-i="${i}"><td class="num text-sm whitespace-nowrap">${fmt(e.start, !e.allDay)}${e.allDay ? ' 종일' : ''}</td><td class="ellipsis font-semibold">${esc(e.title)}</td><td><span class="badge gray">${esc(e.category)}</span></td><td class="ellipsis text-sm">${esc(e.location)}</td><td class="text-right"><button type="button" class="icon-btn" data-del="${i}" aria-label="삭제" style="width:32px;height:32px;font-size:18px">${ms('delete')}</button></td></tr>`).join('') : '<tr><td colspan="5" class="adm-empty">등록된 일정이 없습니다.</td></tr>'}</tbody></table></div>
        <p class="text-xs muted mt-3">이 캘린더의 일정은 홈페이지 [알림마당 &gt; 주요일정]과 메인 화면에 공개됩니다. Google 캘린더 앱에서 직접 추가·수정해도 반영됩니다.</p></div>
      <form class="adm-card adm-form" data-form style="align-self:start"><h2 data-fh>${ms('add')}일정 등록</h2><input type="hidden" name="id">
        <div class="f"><label for="et">제목</label><input id="et" type="text" name="title" required maxlength="200"></div>
        <div class="row2"><div class="f"><label for="ec">분류</label><select id="ec" name="category"><option>IR 포럼</option><option>멘토링</option><option>교육</option><option>설명회</option><option>성과보고회</option><option>일정</option></select></div><div class="f"><span class="l">옵션</span><label class="chk" style="height:40px"><input type="checkbox" name="allDay">종일</label></div></div>
        <div class="row2"><div class="f"><label for="esd">시작일</label><input id="esd" type="date" name="startDate" required></div><div class="f" data-time><label for="est">시작 시각</label><input id="est" type="time" name="startTime" value="14:00"></div></div>
        <div class="row2"><div class="f"><label for="eed">종료일</label><input id="eed" type="date" name="endDate"></div><div class="f" data-time><label for="eet">종료 시각</label><input id="eet" type="time" name="endTime" value="17:00"></div></div>
        <div class="f"><label for="el">장소</label><input id="el" type="text" name="location" maxlength="300"></div>
        <div class="f"><label for="ed">설명</label><textarea id="ed" name="description" rows="4"></textarea></div>
        <div class="adm-actions"><button type="reset" class="btn btn-line btn-sm">새로 작성</button><button type="submit" class="btn btn-primary btn-sm">${ms('save')}저장</button></div></form></div>`;
    const form = $('[data-form]', view);
    const syncTime = () => $$('[data-time]', form).forEach(x => x.hidden = form.allDay.checked);
    form.allDay.onchange = syncTime;
    form.addEventListener('reset', () => setTimeout(() => { form.id.value = ''; $('[data-fh]', view).innerHTML = ms('add') + '일정 등록'; syncTime(); }));
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    view.onclick = async (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); const ev = evs[+del.dataset.del]; if (!(await confirmBox('일정을 삭제할까요?', `<p>${esc(ev.title)}</p>`))) return; await api('event-delete', { method: 'POST', body: { id: ev.id } }); toast('삭제되었습니다.', 'ok'); route(); return; }
      const tr = e.target.closest('tr[data-i]'); if (!tr) return;
      const ev = evs[+tr.dataset.i];
      form.id.value = ev.id; form.title.value = ev.title; form.category.value = ev.category; form.allDay.checked = ev.allDay; form.location.value = ev.location; form.description.value = ev.description;
      if (ev.allDay) { form.startDate.value = ev.start; const end = new Date(ev.end + 'T00:00:00'); end.setDate(end.getDate() - 1); form.endDate.value = ymd(end); }
      else { const s = new Date(ev.start), en = new Date(ev.end); form.startDate.value = ymd(s); form.startTime.value = hm(s); form.endDate.value = ymd(en); form.endTime.value = hm(en); }
      $('[data-fh]', view).innerHTML = ms('edit') + '일정 수정'; syncTime(); form.scrollIntoView({ behavior: 'smooth' });
    };
    form.onsubmit = (e) => { e.preventDefault(); if (!form.reportValidity()) return; busy($('button[type=submit]', form), async () => {
      const ev = Object.fromEntries(new FormData(form)); ev.allDay = form.allDay.checked; if (!ev.id) delete ev.id;
      await api('event-save', { method: 'POST', body: { event: ev } }); toast('Google 캘린더에 저장되었습니다.', 'ok'); route();
    }); };
  };

  /* ================================================================
   * 자료실 (Google Drive)
   * ================================================================ */
  ROUTES.library = async () => {
    const d = await api('files');
    view.innerHTML = `<div class="adm-2">
      <div class="adm-card"><div class="adm-card-h">${ms('folder_open')}자료 목록 <span class="text-xs muted font-normal">· Drive “03_공개자료실”</span></div>
        <div class="overflow-x-auto"><table class="adm-tbl"><thead><tr><th>파일명</th><th>분류</th><th>크기</th><th>등록일</th><th>공개</th><th></th></tr></thead><tbody>${d.files.length ? d.files.map((f, i) => `<tr><td class="ellipsis"><a class="font-semibold hover:text-moarc-blue" href="${esc(f.viewUrl)}" target="_blank" rel="noopener">${esc(f.name)}</a>${f.description ? `<div class="text-xs muted ellipsis">${esc(f.description)}</div>` : ''}</td><td><span class="badge gray">${esc(f.category)}</span></td><td class="num text-sm">${(f.size / 1024 / 1024).toFixed(1)}MB</td><td class="num text-sm">${fmt(f.createdTime, false)}</td><td><label class="chk"><input type="checkbox" data-pub="${i}" ${f.public ? 'checked' : ''}><span class="text-xs">${f.public ? '공개' : '비공개'}</span></label></td><td><button type="button" class="icon-btn" data-del="${i}" aria-label="삭제" style="width:32px;height:32px;font-size:18px">${ms('delete')}</button></td></tr>`).join('') : '<tr><td colspan="6" class="adm-empty">업로드된 자료가 없습니다.</td></tr>'}</tbody></table></div>
        <p class="text-xs muted mt-3">‘공개’ 자료는 홈페이지 [정보마당 &gt; 자료실]에 노출되며, 링크가 있는 누구나 볼 수 있도록 Drive 공유 설정이 변경됩니다.</p></div>
      <form class="adm-card adm-form" data-form style="align-self:start"><h2>${ms('upload_file')}자료 업로드</h2>
        <div class="f"><label for="lf">파일 (최대 200MB)</label><input id="lf" type="file" name="file" required></div>
        <div class="row2"><div class="f"><label for="lc">분류</label><input id="lc" type="text" name="category" value="일반" list="lcats" maxlength="30"><datalist id="lcats"><option>양식</option><option>발간자료</option><option>홍보자료</option><option>공고문</option><option>일반</option></datalist></div><div class="f"><span class="l">공개 여부</span><label class="chk" style="height:40px"><input type="checkbox" name="public" checked>홈페이지 공개</label></div></div>
        <div class="f"><label for="ld">설명</label><input id="ld" type="text" name="description" maxlength="500"></div>
        <div class="adm-bar" data-prog hidden><i style="width:0"></i></div>
        <div class="adm-actions"><button type="submit" class="btn btn-primary btn-sm">${ms('cloud_upload')}Drive에 업로드</button></div></form></div>`;
    view.onchange = (e) => { const i = e.target.dataset.pub; if (i == null) return; const f = d.files[+i]; api('file-finalize', { method: 'POST', body: { id: f.id, public: e.target.checked } }).then(() => { toast(e.target.checked ? '공개로 전환했습니다.' : '비공개로 전환했습니다.', 'ok'); route(); }).catch(err => { toast(err.message, 'err'); e.target.checked = !e.target.checked; }); };
    view.onclick = async (e) => { const b = e.target.closest('[data-del]'); if (!b) return; const f = d.files[+b.dataset.del]; if (!(await confirmBox('자료를 삭제할까요?', `<p>${esc(f.name)}<br><span class="muted text-sm">Google Drive에서 영구 삭제됩니다.</span></p>`))) return; await api('file-delete', { method: 'POST', body: { id: f.id } }); toast('삭제되었습니다.', 'ok'); route(); };
    const form = $('[data-form]', view);
    form.onsubmit = (e) => { e.preventDefault(); const file = form.file.files[0]; if (!file) return; const prog = $('[data-prog]', view); busy($('button[type=submit]', form), async () => {
      const s = await api('upload-session', { method: 'POST', body: { name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, category: form.category.value, description: form.description.value, public: form.public.checked } });
      prog.hidden = false;
      const up = await new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open('PUT', s.uploadUrl); x.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); x.upload.onprogress = (ev) => { if (ev.lengthComputable) prog.firstElementChild.style.width = (ev.loaded / ev.total * 100) + '%'; }; x.onload = () => x.status < 300 ? res(JSON.parse(x.responseText)) : rej(new Error('업로드 실패 ' + x.status)); x.onerror = () => rej(new Error('네트워크 오류')); x.send(file); });
      await api('file-finalize', { method: 'POST', body: { id: up.id, public: form.public.checked } });
      toast('Google Drive에 업로드되었습니다.', 'ok'); route();
    }).catch(() => {}); };
  };

  /* ================================================================
   * 메일 발송 (Gmail)
   * ================================================================ */
  const TEMPLATES = {
    selected: ['[MOARC] {이름}님, 선정을 축하드립니다', '{이름}님, 안녕하세요.\n\n주식회사 모아크파트너스입니다. 신청해 주신 프로그램에 최종 선정되었음을 알려드립니다.\n\n세부 일정과 준비 사항은 아래와 같습니다.\n- 일시: \n- 장소: \n- 준비물: 발표 자료(PDF)\n\n궁금하신 점은 이 메일로 회신해 주세요. 감사합니다.'],
    rejected: ['[MOARC] {이름}님, 신청 결과 안내드립니다', '{이름}님, 안녕하세요.\n\n신청해 주셔서 진심으로 감사드립니다. 아쉽게도 이번 회차에는 함께하지 못하게 되었습니다.\n\n다음 회차 모집 공고는 홈페이지 [알림마당 > IR·멘토링 공고]에서 확인하실 수 있습니다. 앞으로의 성장을 응원합니다.'],
    docs: ['[MOARC] 제출 서류 보완 요청', '{이름}님, 안녕하세요.\n\n접수해 주신 신청서 검토 중 아래 서류의 보완이 필요하여 연락드립니다.\n- \n\n보완 서류는 이 메일에 회신으로 보내주시기 바랍니다.'],
    schedule: ['[MOARC] 멘토링 일정 안내', '{이름}님, 안녕하세요.\n\n배정된 멘토링 일정을 안내드립니다.\n- 일시: \n- 멘토: \n- 장소: \n\n배정표는 홈페이지 [포트폴리오 > 멘토링 배정표]에서도 확인하실 수 있습니다.']
  };
  ROUTES.mail = async (_, params) => {
    const ids = (params.get('ids') || '').split(',').filter(Boolean);
    let picked = [];
    if (ids.length) { const { apps } = await api('apps'); picked = apps.filter(a => ids.includes(a.id)); }
    view.innerHTML = `<form class="adm-card adm-form" data-form style="max-width:860px">
      <h2>${ms('mail')}Gmail로 메일 발송 <span class="text-xs muted font-normal">· 발신: ${esc(ME.google.account || '연동 계정')}</span></h2>
      <div class="f"><span class="l">받는 사람 (접수자)</span><div class="flex flex-wrap gap-2" data-chips>${picked.map(a => `<span class="adm-chip" data-id="${esc(a.id)}">${esc(a.name || a.title)} &lt;${esc(a.email)}&gt;<button type="button" aria-label="제외">${ms('close')}</button></span>`).join('') || '<span class="text-sm muted">[온라인 접수] 목록에서 선택하면 여기에 표시됩니다.</span>'}</div></div>
      <div class="f"><label for="mt">추가 받는 사람</label><input id="mt" type="text" name="to" placeholder="이메일 주소 (쉼표로 여러 명)"></div>
      <div class="row2"><div class="f"><label for="mc">참조(CC)</label><input id="mc" type="text" name="cc" placeholder="선택"></div><div class="f"><label for="mtp">템플릿</label><select id="mtp" data-tpl><option value="">직접 작성</option><option value="selected">선정 안내</option><option value="rejected">미선정 안내</option><option value="docs">서류 보완 요청</option><option value="schedule">멘토링 일정 안내</option></select></div></div>
      <div class="f"><label for="ms">제목</label><input id="ms" type="text" name="subject" required maxlength="200"></div>
      <div class="f"><label for="mb">내용</label><textarea id="mb" name="body" rows="12" required></textarea><p class="text-xs muted"><code class="adm-code">{이름}</code>은 받는 사람 이름으로 바뀝니다. 수신자마다 개별 발송되며 접수 건의 처리 이력에 기록됩니다.</p></div>
      <div class="adm-actions"><button type="submit" class="btn btn-primary btn-sm">${ms('send')}발송</button></div></form>`;
    const form = $('[data-form]', view);
    $('[data-chips]', view).onclick = (e) => { const b = e.target.closest('button'); if (b) b.parentElement.remove(); };
    $('[data-tpl]', view).onchange = (e) => { const t = TEMPLATES[e.target.value]; if (t) { form.subject.value = t[0]; form.body.value = t[1]; } };
    form.onsubmit = (e) => { e.preventDefault(); if (!form.reportValidity()) return; busy($('button[type=submit]', form), async () => {
      const appIds = $$('[data-chips] [data-id]', view).map(c => c.dataset.id);
      const r = await api('mail-send', { method: 'POST', body: { appIds, to: form.to.value, cc: form.cc.value, subject: form.subject.value, body: form.body.value } });
      modal({ kicker: 'Gmail', title: `${r.sent}건 발송 완료${r.failed.length ? ` · ${r.failed.length}건 실패` : ''}`, html: r.failed.length ? '<ul class="text-sm">' + r.failed.map(f => `<li>${esc(f.email)} — ${esc(f.error)}</li>`).join('') + '</ul>' : '<p>모든 메일이 발송되었습니다. Gmail의 [보낸편지함]에서도 확인할 수 있습니다.</p>', actions: [{ label: '확인', primary: true }] });
      if (!r.failed.length) form.reset();
    }).catch(() => {}); };
  };

  /* ================================================================
   * 사이트 설정
   * ================================================================ */
  ROUTES.settings = async () => {
    const { settings: s } = await api('settings');
    view.innerHTML = `<form class="adm-card adm-form" data-form style="max-width:860px">
      <h2>${ms('campaign')}IR 포럼 접수</h2>
      <div class="f"><label for="sn">포럼명 (홈페이지 · 카운트다운 표시)</label><input id="sn" type="text" name="forumName" value="${esc(s.forumName)}" maxlength="120"></div>
      <div class="row3"><div class="f"><label for="sd">접수 마감 (KST)</label><input id="sd" type="datetime-local" name="forumDeadline" value="${kstInput(s.forumDeadline)}"></div>
        <div class="f"><label for="sc">선정 정원</label><input id="sc" type="number" name="forumCapacity" min="1" value="${esc(s.forumCapacity)}"></div>
        <div class="f"><label for="sb">기존 접수 누계 (오프라인)</label><input id="sb" type="number" name="applicantBase" min="0" value="${esc(s.applicantBase)}"></div></div>
      <label class="chk"><input type="checkbox" name="applyOpen" ${s.applyOpen ? 'checked' : ''}>스타트업 참가 접수 열기 (해제 시 즉시 마감)</label>
      <h2 class="mt-4">${ms('mail')}메일</h2>
      <label class="chk"><input type="checkbox" name="autoReply" ${s.autoReply ? 'checked' : ''}>신청자에게 접수 확인 메일 자동 발송 (Gmail)</label>
      <div class="row2"><div class="f"><label for="se">접수 알림 받을 주소</label><input id="se" type="text" name="notifyEmails" value="${esc(s.notifyEmails)}" placeholder="비우면 관리자 전원 (쉼표 구분)"></div><div class="f"><label for="sce">대표 이메일 (회신 주소)</label><input id="sce" type="email" name="contactEmail" value="${esc(s.contactEmail)}" required></div></div>
      <h2 class="mt-4">${ms('notifications')}메인 화면</h2>
      <div class="f"><label for="sm">상단 긴급 공지 띠 (비우면 숨김)</label><input id="sm" type="text" name="mainNotice" value="${esc(s.mainNotice)}" maxlength="200" placeholder="예: 10월 30일(목) 시스템 점검으로 온라인 접수가 1시간 중단됩니다."></div>
      <div class="adm-actions"><button type="submit" class="btn btn-primary btn-sm" ${ME.google.connected ? '' : 'disabled title="Google 연동 필요"'}>${ms('save')}저장</button></div>
      <p class="text-xs muted">설정은 Google Drive “MOARC Portal / settings.json”에 저장되며 홈페이지에는 최대 1분 내 반영됩니다.</p></form>`;
    const form = $('[data-form]', view);
    form.onsubmit = (e) => { e.preventDefault(); if (!form.reportValidity()) return; busy($('button[type=submit]', form), async () => {
      const v = Object.fromEntries(new FormData(form));
      await api('settings-save', { method: 'POST', body: { settings: { ...v, forumDeadline: v.forumDeadline ? v.forumDeadline + ':00+09:00' : undefined, applyOpen: form.applyOpen.checked, autoReply: form.autoReply.checked } } });
      toast('설정이 저장되었습니다.', 'ok');
    }).catch(() => {}); };
  };

  /* ================================================================
   * Google 연동
   * ================================================================ */
  ROUTES.integrations = async () => {
    const g = ME.google;
    let st = { folders: null, calendar: null };
    if (g.connected) st = await api('status').catch(() => st);
    const chk = (ok, title, desc) => `<div class="adm-check ${ok ? 'ok' : 'no'}">${ms(ok ? 'check_circle' : 'pending')}<div><b>${title}</b><div class="text-sm muted mt-0.5">${desc}</div></div></div>`;
    view.innerHTML = `<div class="adm-2">
      <div class="adm-grid">
        <div class="adm-card"><div class="adm-card-h">${ms('link')}연동 상태<span class="act">${g.connected ? `<button type="button" class="btn btn-line btn-sm" data-test>${ms('send')}테스트 메일</button>` : ''}<a class="btn btn-primary btn-sm" href="/api/auth?a=connect">${g.connected ? '다시 연동' : 'Google 계정 연동'}</a></span></div>
          <div class="grid gap-2">
            ${chk(g.connected, 'Google 계정', g.connected ? `${esc(g.account || '연동됨')} · 토큰 저장소: ${g.tokenSource === 'env' ? '환경변수(GOOGLE_REFRESH_TOKEN)' : g.tokenSource === 'memory' ? '<b class="text-amber-700">임시(서버 메모리) — GOOGLE_REFRESH_TOKEN 환경변수에 저장 후 Redeploy 필요</b>' : 'KV 저장소'}` : '연동되지 않음 — [Google 계정 연동]을 눌러 권한을 허용하세요.')}
            ${chk(g.connected, 'Gmail — 메일 발송', '접수 알림 · 자동 회신 · 관리자 메일 발송 (gmail.send: 받은편지함은 읽지 않습니다)')}
            ${chk(!!st.folders, 'Google Drive — 데이터 보관', st.folders ? `<a class="text-moarc-blue underline" href="${esc(st.folders.root.link)}" target="_blank" rel="noopener">MOARC Portal 폴더 열기</a> · <a class="text-moarc-blue underline" href="${esc(st.folders.apps.link)}" target="_blank" rel="noopener">온라인접수</a> · <a class="text-moarc-blue underline" href="${esc(st.folders.uploads.link)}" target="_blank" rel="noopener">접수첨부</a> · <a class="text-moarc-blue underline" href="${esc(st.folders.library.link)}" target="_blank" rel="noopener">공개자료실</a>` : '연동 후 자동 생성됩니다 (drive.file: 이 앱이 만든 파일만 접근)')}
            ${chk(!!st.calendar, 'Google Calendar — 공개 일정', st.calendar ? `<a class="text-moarc-blue underline" href="${esc(st.calendar.link)}" target="_blank" rel="noopener">MOARC PARTNERS 공개일정 캘린더 열기</a>` : '[일정 관리]에 처음 들어가면 전용 캘린더가 생성됩니다 (기존 캘린더는 건드리지 않습니다)')}
          </div>
          ${g.connected && g.tokenSource !== 'env' ? `<div class="mt-4 text-right"><button type="button" class="btn btn-line btn-sm" data-disconnect style="color:#B91C1C">연동 해제</button></div>` : ''}
        </div>
        <div class="adm-card"><h2>${ms('person')}로그인 정보</h2><dl class="adm-kv"><dt>관리자</dt><dd>${esc(ME.user.email)}</dd><dt>KV 저장소</dt><dd>${g.kv ? '사용 중 (토큰 자동 저장)' : '미설정 — 연동 시 토큰을 환경변수로 직접 저장'}</dd></dl></div>
      </div>
      <div class="adm-card"><h2>${ms('menu_book')}최초 설정 안내</h2>
        <ol class="grid gap-3 text-sm" style="list-style:decimal;padding-left:18px">
          <li><b>Google Cloud Console</b>에서 프로젝트를 만들고 <b>Gmail API · Google Drive API · Google Calendar API</b>를 사용 설정합니다.</li>
          <li><b>OAuth 동의 화면</b>: Google Workspace라면 사용자 유형 <b>내부</b>, 개인 Gmail이라면 <b>외부 + 게시(프로덕션)</b> 상태로 둡니다. (테스트 상태는 7일마다 연동이 만료됩니다)</li>
          <li><b>사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)</b>를 만들고 승인된 리디렉션 URI에 아래 주소를 등록합니다.<br><code class="adm-code">${esc(ME.redirectUri)}</code></li>
          <li>Vercel 환경변수에 <code class="adm-code">GOOGLE_CLIENT_ID</code> <code class="adm-code">GOOGLE_CLIENT_SECRET</code> <code class="adm-code">ADMIN_EMAILS</code> <code class="adm-code">SESSION_SECRET</code>를 저장합니다. (권장) Vercel Marketplace에서 <b>Upstash Redis</b>를 추가하면 토큰이 자동 저장됩니다.</li>
          <li>이 화면에서 <b>Google 계정 연동</b>을 눌러 권한을 허용합니다. 기관 대표 계정(예: contact@)으로 연동하면 메일이 해당 주소로 발송됩니다.</li>
        </ol></div></div>`;
    const t = $('[data-test]', view); if (t) t.onclick = (e) => busy(e.currentTarget, async () => { await api('test-mail', { method: 'POST' }); toast(ME.user.email + ' 로 테스트 메일을 보냈습니다.', 'ok'); }).catch(() => {});
    const dc = $('[data-disconnect]', view); if (dc) dc.onclick = async () => {
      if (!(await confirmBox('Google 연동을 해제할까요?', '<p>저장된 연동 토큰이 삭제됩니다. Drive의 데이터는 그대로 남으며 다시 연동하면 이어서 사용할 수 있습니다.</p>'))) return;
      const r = await fetch('/api/auth?a=disconnect', { method: 'POST', headers: { 'X-Moarc-Admin': '1' } }); if (r.ok) { toast('연동이 해제되었습니다.', 'ok'); setTimeout(() => location.reload(), 600); }
    };
  };

  boot().catch(e => { $('#adm-boot').textContent = '관리자 모드를 불러오지 못했습니다: ' + e.message; });
})();
