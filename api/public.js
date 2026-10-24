// GET /api/public?r=config|posts|schedule|library   — 공개 데이터 (CDN 60초 캐시)
import { send, ok, fail, query } from '../lib/http.js';
import * as G from '../lib/google.js';
import * as D from '../lib/data.js';

const CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method Not Allowed' }, { Allow: 'GET' });
  const q = query(req);
  try {
    const connected = await G.isConnected().catch(() => false);
    switch (q.r) {
      case 'config': {
        const s = await D.getSettings();
        return ok(res, { connected, settings: D.publicSettings(s), boards: D.BOARDS }, { 'Cache-Control': CACHE });
      }
      case 'posts': {
        let posts = await D.getPosts();
        if (q.board) posts = posts.filter(p => p.board === q.board);
        if (q.id) {
          const p = posts.find(x => x.id === q.id);
          return p ? ok(res, { post: p }, { 'Cache-Control': CACHE }) : fail(res, 404, '게시물을 찾을 수 없습니다.');
        }
        posts = [...posts].sort((a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date)));
        return ok(res, { connected, posts }, { 'Cache-Control': CACHE });
      }
      case 'schedule': {
        const from = q.from && !isNaN(Date.parse(q.from)) ? new Date(q.from).toISOString() : new Date(Date.now() - 86400e3).toISOString();
        const to = q.to && !isNaN(Date.parse(q.to)) ? new Date(q.to).toISOString() : new Date(Date.now() + 120 * 86400e3).toISOString();
        const events = await D.listEvents({ from, to });
        return ok(res, { connected, events }, { 'Cache-Control': CACHE });
      }
      case 'library': {
        const files = await D.listLibrary({ publicOnly: true });
        return ok(res, { connected, files: files.map(({ id, name, mimeType, size, createdTime, description, category, viewUrl, downloadUrl }) => ({ id, name, mimeType, size, createdTime, description, category, viewUrl, downloadUrl })) }, { 'Cache-Control': CACHE });
      }
      default:
        return fail(res, 400, 'unknown resource');
    }
  } catch (e) {
    console.error('[public]', q.r, e.message);
    return fail(res, 502, '데이터를 불러오지 못했습니다.');
  }
}
