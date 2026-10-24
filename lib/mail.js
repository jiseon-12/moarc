// 메일 템플릿 및 발송 (Gmail API 우선, Resend/웹훅 보조)
import { gmailSend, isConnected } from './google.js';
import { escHtml, EMAIL_RE } from './http.js';
import { adminEmails } from './session.js';

export const TYPE_LABELS = {
  startup: '스타트업 참가 신청',
  rfp: '기관 위탁(RFP) 협의',
  expert: '전문가(멘토) 등록',
  contact: '일반 문의'
};

export const FIELD_LABELS = {
  company: '기업명', org: '기관/부서', name: '성명', position: '직책', phone: '연락처', email: '이메일',
  category: '사업 분야', field: '전문 분야', product: '제품·서비스', stage: '성장 단계', mentorField: '희망 멘토링 분야',
  timeslot: '희망 세션', concern: '상담 희망 내용', deckUrl: 'IR 자료 링크', budget: '예산 규모',
  period: '희망 일정', companies: '대상 기업 수', memo: '내용', career: '주요 경력', subject: '제목', homepage: '홈페이지'
};

const wrap = (title, inner) => `<!doctype html><html><body style="margin:0;background:#EEF1F6;padding:24px 0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #C9CDD3;border-radius:12px;overflow:hidden;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1F2430">
<tr><td style="background:#0C2D6B;padding:20px 28px;color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">MO<span style="color:#87B5FF">A</span>RC <span style="font-size:11px;letter-spacing:4px;font-weight:700">PARTNERS</span></td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:19px;margin:0 0 14px;color:#0C2D6B">${escHtml(title)}</h1>
${inner}
</td></tr>
<tr><td style="padding:16px 28px;background:#EEF1F6;font-size:12px;color:#4B5565;line-height:1.6">주식회사 모아크파트너스 · Accelerating Potential into Value<br>본 메일은 발신 전용이 아니며 회신하시면 담당자에게 전달됩니다.</td></tr>
</table></td></tr></table></body></html>`;

export function textToHtml(text) {
  return escHtml(text).split(/\n{2,}/).map(p => `<p style="margin:0 0 12px;line-height:1.7">${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function rowsTable(data) {
  const rows = Object.entries(data).filter(([, v]) => v).map(([k, v]) =>
    `<tr><th align="left" style="padding:8px 10px;background:#EEF1F6;border:1px solid #C9CDD3;white-space:nowrap;font-size:13px">${escHtml(FIELD_LABELS[k] || k)}</th><td style="padding:8px 10px;border:1px solid #C9CDD3;font-size:13px;white-space:pre-wrap">${escHtml(v)}</td></tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%">${rows}</table>`;
}

export function notifyMail(app, adminUrl) {
  const title = `[${TYPE_LABELS[app.type]}] ${app.data.company || app.data.org || app.data.name} (${app.receipt})`;
  const files = (app.attachments || []).map(a => `<li><a href="${escHtml(a.link || '#')}">${escHtml(a.name)}</a></li>`).join('');
  return {
    subject: title,
    html: wrap(TYPE_LABELS[app.type] + ' 접수 알림', `
      <p style="margin:0 0 14px;color:#4B5565;font-size:13px">접수번호 <b>${escHtml(app.receipt)}</b> · ${escHtml(new Date(app.receivedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))}</p>
      ${rowsTable(app.data)}
      ${files ? `<p style="margin:16px 0 6px;font-weight:700">첨부파일 (Google Drive)</p><ul style="margin:0;padding-left:18px">${files}</ul>` : ''}
      <p style="margin:22px 0 0"><a href="${escHtml(adminUrl)}" style="display:inline-block;background:#1F6BFF;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:14px">관리자 모드에서 보기</a></p>`),
    replyTo: app.data.email
  };
}

export function autoReplyMail(app, settings) {
  const name = app.data.name || '';
  const lines = {
    startup: `${settings.forumName} 참가 신청이 정상적으로 접수되었습니다. 서류 검토 후 선정 결과와 다음 절차를 안내드리겠습니다.`,
    rfp: '위탁 사업 협의 요청이 접수되었습니다. 김지선 대표이사 및 전담 파트너가 영업일 기준 24시간 내 회신드리겠습니다.',
    expert: '전문가(멘토) 등록 신청이 접수되었습니다. 분야 매칭 검토 후 위촉 절차를 안내드리겠습니다.',
    contact: '문의가 접수되었습니다. 담당자가 확인 후 회신드리겠습니다.'
  };
  return {
    subject: `[MOARC PARTNERS] ${TYPE_LABELS[app.type]} 접수 확인 (${app.receipt})`,
    html: wrap('접수가 완료되었습니다', `
      <p style="margin:0 0 12px;line-height:1.7">${escHtml(name)} 님, 안녕하세요.<br>${escHtml(lines[app.type] || lines.contact)}</p>
      <div style="margin:16px 0;padding:14px 16px;background:#EEF1F6;border-radius:8px;font-size:14px">접수번호 <b style="font-size:16px;color:#0C2D6B">${escHtml(app.receipt)}</b></div>
      ${rowsTable(Object.fromEntries(Object.entries(app.data).filter(([k]) => ['company', 'org', 'name', 'email', 'category', 'field', 'timeslot', 'budget', 'subject'].includes(k))))}
      <p style="margin:16px 0 0;font-size:13px;color:#4B5565">문의: ${escHtml(settings.contactEmail)}</p>`),
    replyTo: settings.contactEmail
  };
}

export function composeMail({ subject, body, name }) {
  const text = String(body || '').replace(/\{이름\}/g, name || '');
  return { subject: String(subject || '').replace(/\{이름\}/g, name || ''), html: wrap(String(subject || '').replace(/\{이름\}/g, name || ''), textToHtml(text)), text };
}

export function notifyRecipients(settings) {
  const list = (settings.notifyEmails || process.env.MOARC_NOTIFY_EMAIL || '').split(',').map(s => s.trim()).filter(e => EMAIL_RE.test(e));
  return list.length ? list : adminEmails();
}

export async function sendViaGmail(to, mail) {
  if (!(await isConnected())) return false;
  await gmailSend({ to, ...mail });
  return true;
}

/** 보조 채널: 웹훅 / Resend */
export async function deliverFallback(record, mail) {
  const done = [];
  if (process.env.MOARC_WEBHOOK_URL) {
    const r = await fetch(process.env.MOARC_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
    if (r.ok) done.push('webhook');
  }
  if (process.env.RESEND_API_KEY && process.env.MOARC_NOTIFY_EMAIL) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MOARC_FROM_EMAIL || 'MOARC 홈페이지 <onboarding@resend.dev>',
        to: process.env.MOARC_NOTIFY_EMAIL.split(',').map(s => s.trim()),
        reply_to: record.data.email || undefined, subject: mail.subject, html: mail.html
      })
    });
    if (r.ok) done.push('resend');
  }
  return done;
}
