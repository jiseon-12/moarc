// POST /api/submit                    온라인 접수 (startup | rfp | expert | contact)
// POST /api/submit?r=upload-session   첨부파일 업로드 세션 발급 (Google Drive 직접 업로드)
import { send, ok, fail, readJson, query, clientIp, rateLimited, originAllowed, baseUrl, clean, EMAIL_RE, PHONE_RE, URL_RE, kstNow } from '../lib/http.js';
import * as G from '../lib/google.js';
import * as D from '../lib/data.js';
import { notifyMail, autoReplyMail, notifyRecipients, sendViaGmail, deliverFallback, TYPE_LABELS } from '../lib/mail.js';

const S = 200, M = 400, L = 3000;
const SCHEMAS = {
  startup: {
    company: { max: S, required: true }, name: { max: S, required: true }, phone: { max: 20, required: true, re: PHONE_RE },
    email: { max: S, required: true, re: EMAIL_RE }, category: { max: S, required: true }, stage: { max: S },
    product: { max: M, required: true }, mentorField: { max: S }, timeslot: { max: S }, concern: { max: L }, deckUrl: { max: 500, re: URL_RE }
  },
  rfp: {
    org: { max: S, required: true }, name: { max: S, required: true }, email: { max: S, required: true, re: EMAIL_RE },
    phone: { max: 20, re: PHONE_RE }, budget: { max: S }, period: { max: S }, companies: { max: 20 }, memo: { max: L, required: true }
  },
  expert: {
    name: { max: S, required: true }, org: { max: S, required: true }, position: { max: S }, email: { max: S, required: true, re: EMAIL_RE },
    phone: { max: 20, required: true, re: PHONE_RE }, field: { max: S, required: true }, career: { max: L, required: true }, homepage: { max: 500, re: URL_RE }
  },
  contact: {
    name: { max: S, required: true }, email: { max: S, required: true, re: EMAIL_RE }, phone: { max: 20, re: PHONE_RE },
    org: { max: S }, subject: { max: S, required: true }, memo: { max: L, required: true }
  }
};
const LABEL = { company: '기업명', name: '성명', phone: '연락처', email: '이메일', category: '사업 분야', product: '제품·서비스', org: '기관/소속', memo: '내용', field: '전문 분야', career: '주요 경력', subject: '제목', deckUrl: 'IR 자료 링크', homepage: '홈페이지' };

const UPLOAD_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/x-hwp': 'hwp', 'application/haansofthwp': 'hwp', 'application/vnd.hancom.hwp': 'hwp', 'application/vnd.hancom.hwpx': 'hwpx',
  'application/zip': 'zip', 'application/x-zip-compressed': 'zip',
  'image/png': 'png', 'image/jpeg': 'jpg'
};
const MAX_UPLOAD = 30 * 1024 * 1024;

function receiptNo() {
  const ymd = kstNow().toISOString().slice(0, 10).replace(/-/g, '');
  return `MOARC-${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function validate(body) {
  const schema = SCHEMAS[body && body.type];
  if (!schema) return { error: '알 수 없는 접수 유형입니다.' };
  if (body.consent !== true) return { error: '개인정보 수집·이용 동의가 필요합니다.' };
  const data = {};
  for (const [k, r] of Object.entries(schema)) {
    const v = clean(body[k], r.max + 1);
    if (r.required && !v) return { error: `${LABEL[k] || k} 항목을 입력해 주세요.` };
    if (v.length > r.max) return { error: `${LABEL[k] || k} 항목이 너무 깁니다.` };
    if (v && r.re && !r.re.test(v)) return { error: `${LABEL[k] || k} 형식을 확인해 주세요.` };
    data[k] = v;
  }
  return { data };
}

async function uploadSession(req, res) {
  if (rateLimited('up:' + clientIp(req), 10, 10 * 60 * 1000)) return fail(res, 429, '요청이 너무 많습니다.');
  if (!(await G.isConnected())) return fail(res, 503, '파일 업로드를 사용할 수 없습니다. IR 자료 링크를 입력해 주세요.', { code: 'NOT_CONNECTED' });
  const b = await readJson(req);
  const size = Number(b.size);
  const mime = String(b.mimeType || '');
  if (!UPLOAD_TYPES[mime]) return fail(res, 400, '허용되지 않는 파일 형식입니다. (PDF, PPT, DOC, HWP, ZIP, 이미지)');
  if (!(size > 0 && size <= MAX_UPLOAD)) return fail(res, 400, '파일은 30MB 이하만 업로드할 수 있습니다.');
  const safeName = clean(b.name, 150).replace(/[\\/:*?"<>|]/g, '_') || `upload.${UPLOAD_TYPES[mime]}`;
  const { uploads } = await D.getFolders();
  const token = Math.random().toString(36).slice(2, 12);
  const uploadUrl = await G.driveUploadSession({
    name: `[대기] ${safeName}`, mimeType: mime, size, parentId: uploads.id,
    origin: req.headers.origin || baseUrl(req), appProperties: { moarcUpload: token, linked: '0' }
  });
  return ok(res, { uploadUrl, token });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method Not Allowed' }, { Allow: 'POST' });
  if (!originAllowed(req)) return fail(res, 403, '허용되지 않은 요청입니다.');
  try {
    if (query(req).r === 'upload-session') return await uploadSession(req, res);

    if (rateLimited('sub:' + clientIp(req), 8, 10 * 60 * 1000)) return fail(res, 429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const body = await readJson(req);
    const receipt = receiptNo();
    if (body && body.website) return ok(res, { receipt }); // 허니팟

    const { error, data } = validate(body);
    if (error) return fail(res, 400, error);

    const connected = await G.isConnected();
    const settings = await D.getSettings().catch(() => D.DEFAULT_SETTINGS);
    if (body.type === 'startup') {
      const closed = !settings.applyOpen || Date.now() > Date.parse(settings.forumDeadline);
      if (closed) return fail(res, 400, `${settings.forumName} 접수가 마감되었습니다.`);
    }

    const app = {
      receipt, type: body.type, status: '접수', receivedAt: new Date().toISOString(),
      page: clean(body.page, 300), data, attachments: [], scores: null, memo: '',
      history: [{ at: new Date().toISOString(), by: 'system', action: '온라인 접수' }]
    };

    // 첨부파일: 업로드 토큰으로 본인 업로드 확인 후 연결
    if (connected && Array.isArray(body.files) && body.files.length) {
      const { uploads } = await D.getFolders();
      for (const f of body.files.slice(0, 3)) {
        try {
          const meta = await G.driveGet(String(f.id), 'id,name,size,parents,webViewLink,appProperties');
          if (!(meta.parents || []).includes(uploads.id) || !meta.appProperties || meta.appProperties.moarcUpload !== String(f.token) || meta.appProperties.linked === '1') continue;
          const name = meta.name.replace(/^\[대기\] /, '');
          await G.driveUpdateMeta(meta.id, { name: `${receipt}_${name}`, appProperties: { linked: '1', receipt } });
          app.attachments.push({ id: meta.id, name, size: Number(meta.size || 0), link: meta.webViewLink });
        } catch (e) { console.warn('[submit] attach skip', e.message); }
      }
    }

    const record = { ...app, typeLabel: TYPE_LABELS[app.type] };
    const delivered = [];
    const adminUrl = baseUrl(req) + '/admin#/applications';

    if (connected) {
      try { const file = await D.createApplication(app); delivered.push('drive'); record.driveId = file.id; }
      catch (e) { console.error('[submit] drive save failed', e.message); }
      try { if (await sendViaGmail(notifyRecipients(settings), notifyMail(app, adminUrl))) delivered.push('gmail'); }
      catch (e) { console.error('[submit] gmail notify failed', e.message); }
      if (settings.autoReply && data.email) {
        try { await sendViaGmail(data.email, autoReplyMail(app, settings)); }
        catch (e) { console.warn('[submit] auto reply failed', e.message); }
      }
    }
    try { delivered.push(...(await deliverFallback(record, notifyMail(app, adminUrl)))); }
    catch (e) { console.warn('[submit] fallback failed', e.message); }

    if (!delivered.length) {
      console.error('[moarc-submit] NOT DELIVERED', JSON.stringify(record));
      return fail(res, 503, '접수 전달 채널이 일시적으로 사용할 수 없습니다.');
    }
    console.log('[moarc-submit] ok', receipt, app.type, delivered.join('+'));
    return ok(res, { receipt });
  } catch (e) {
    console.error('[submit] error', e);
    return fail(res, e.status && e.status < 500 ? e.status : 500, e.status === 413 ? '요청이 너무 큽니다.' : '처리 중 오류가 발생했습니다.');
  }
}
