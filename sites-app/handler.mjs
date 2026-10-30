import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { validHash, verifyPassword } from '../auth.mjs';

const SESSION_COOKIE = '__Host-lsd_session';
const CSRF_COOKIE = '__Host-lsd_csrf';
const CSRF_TTL = 60 * 60 * 1000;
const RATE_WINDOW = 15 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => {
  const x = Buffer.from(a ?? ''), y = Buffer.from(b ?? '');
  return x.length === y.length && timingSafeEqual(x, y);
};
const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function readForm(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    throw Object.assign(new Error('Định dạng yêu cầu không hợp lệ.'), { status: 415 });
  }
  if (Number(request.headers.get('content-length') || 0) > 4096) throw Object.assign(new Error('Yêu cầu quá lớn.'), { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new URLSearchParams();
  let size = 0, content = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw Object.assign(new Error('Yêu cầu quá lớn.'), { status: 413 }); }
    content += decoder.decode(value, { stream: true });
  }
  return new URLSearchParams(content + decoder.decode());
}

export function createHandler({ quizHtml, loginHtml, now = Date.now }) {
  return async function handle(request, env) {
    const headers = new Headers({
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin', 'X-Robots-Tag': 'noindex, nofollow',
      'Strict-Transport-Security': 'max-age=31536000',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
    });
    const respond = (text, status = 200) => new Response(text, { status, headers });
    const redirect = path => { headers.set('Location', path); return respond(null, 303); };
    try {
      if (!env.DB || !env.AUTH_USERNAME || !validHash(env.AUTH_PASSWORD_HASH) || env.SESSION_SECRET?.length < 32 || !env.SESSION_SECRET || !env.APP_ORIGIN) {
        return respond('Ứng dụng chưa được cấu hình đầy đủ. Vui lòng quay lại sau.', 503);
      }
      const origin = new URL(env.APP_ORIGIN).origin;
      const path = new URL(request.url).pathname;
      const time = now();
      const cookies = Object.fromEntries((request.headers.get('cookie') || '').split(';').map(item => {
        const i = item.indexOf('='); return i < 0 ? ['', ''] : [item.slice(0, i).trim(), item.slice(i + 1)];
      }));
      const sign = value => createHmac('sha256', env.SESSION_SECRET).update(value).digest('base64url');
      const csrfToken = () => { const text = `${time}.${randomBytes(24).toString('base64url')}`; return `${text}.${sign(text)}`; };
      const validCsrf = token => {
        if (!token || token.length > 200) return false;
        const [created, nonce, sig, extra] = token.split('.');
        const age = time - Number(created);
        return !extra && age >= 0 && age < CSRF_TTL && equal(sig, sign(`${created}.${nonce}`));
      };
      const login = (status = 200, error = '') => {
        const token = csrfToken();
        headers.append('Set-Cookie', cookie(CSRF_COOKIE, token, CSRF_TTL / 1000));
        return respond(loginHtml.replace('{{ERROR}}', escape(error)).replace('{{CSRF}}', token), status);
      };
      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/healthz') {
        await env.DB.prepare('SELECT 1 FROM login_sessions LIMIT 1').all();
        headers.set('Content-Type', 'application/json');
        return respond(request.method === 'HEAD' ? null : '{"status":"ok"}');
      }
      const id = cookies[SESSION_COOKIE];
      const tokenHash = id && /^[A-Za-z0-9_-]{43}$/.test(id) ? hash(id) : null;
      const session = tokenHash ? await env.DB.prepare('SELECT csrf, expires FROM login_sessions WHERE token_hash = ? AND expires > ? AND password_version = ?').bind(tokenHash, time, hash(env.AUTH_PASSWORD_HASH)).first() : null;
      if (request.method === 'GET' && path === '/login') return session ? redirect('/') : login();
      if (request.method === 'POST' && ['/login', '/logout'].includes(path)) {
        const requestOrigin = request.headers.get('origin');
        const fetchSite = request.headers.get('sec-fetch-site');
        // A previously loaded page with no-referrer can submit Origin: null in iOS
        // browsers. Accept that only with browser-provided same-origin metadata;
        // both forms still require their independent CSRF token below.
        const sameOrigin = requestOrigin === origin || (requestOrigin === 'null' && fetchSite === 'same-origin');
        if (!sameOrigin || fetchSite === 'cross-site') return respond('Yêu cầu không hợp lệ.', 403);
        const form = await readForm(request);
        if (path === '/logout') {
          if (!session || !equal(session.csrf, form.get('csrf'))) return respond('Phiên không hợp lệ.', 403);
          await env.DB.prepare('DELETE FROM login_sessions WHERE token_hash = ?').bind(tokenHash).run();
          headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0));
          return redirect('/login');
        }
        if (!validCsrf(form.get('csrf')) || !equal(form.get('csrf'), cookies[CSRF_COOKIE])) return login(403, 'Phiên đăng nhập đã hết hạn. Vui lòng thử lại.');
        const bucket = Math.floor(time / RATE_WINDOW);
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        // D1 atomically counts attempts across Workers and devices; never trust X-Forwarded-For.
        const keys = [`global:${bucket}`, `ip:${hash(ip)}:${bucket}`];
        const counts = await env.DB.batch(keys.map(key => env.DB.prepare('INSERT INTO login_limits (key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, (bucket + 1) * RATE_WINDOW)));
        if (counts[0].results[0].count > 100 || counts[1].results[0].count > 20) {
          headers.set('Retry-After', String(Math.ceil(((bucket + 1) * RATE_WINDOW - time) / 1000)));
          return login(429, 'Có quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.');
        }
        const username = form.get('username') || '', password = form.get('password') || '';
        if (username.length > 100 || password.length > 256) return login(400, 'Thông tin đăng nhập quá dài.');
        const matches = await verifyPassword(password, env.AUTH_PASSWORD_HASH);
        if (!matches || !equal(username.trim().toLowerCase(), env.AUTH_USERNAME.toLowerCase())) return login(401, 'Tên đăng nhập hoặc mật khẩu không đúng.');
        const token = randomBytes(32).toString('base64url');
        const maxAge = form.get('remember') === 'on' ? 30 * 24 * 3600 : 12 * 3600;
        const csrf = randomBytes(32).toString('base64url');
        await env.DB.batch([
          env.DB.prepare('DELETE FROM login_sessions WHERE expires <= ? OR token_hash = ?').bind(time, tokenHash || ''),
          env.DB.prepare('DELETE FROM login_limits WHERE expires <= ?').bind(time),
          env.DB.prepare('INSERT INTO login_sessions (token_hash, csrf, expires, password_version) VALUES (?, ?, ?, ?)').bind(hash(token), csrf, time + maxAge * 1000, hash(env.AUTH_PASSWORD_HASH)),
        ]);
        headers.append('Set-Cookie', cookie(SESSION_COOKIE, token, maxAge));
        headers.append('Set-Cookie', cookie(CSRF_COOKIE, '', 0));
        return redirect('/');
      }
      if (request.method === 'GET' && ['/', '/index.html', '/lich_su_dang_on_thi_tuong_tac_2026.html'].includes(path)) {
        if (!session) return redirect('/login');
        const logout = `<form action="/logout" method="post"><input type="hidden" name="csrf" value="${session.csrf}"><button class="navbtn" type="submit"><span class="navicon" aria-hidden="true">↪</span>Đăng xuất</button></form>`;
        return respond(quizHtml.replace('</aside>', `${logout}</aside>`)
          .replace('Chạy ngoại tuyến 100%', `Xin chào, ${escape(env.AUTH_USERNAME)}`)
          .replace('</body>', `<script>window.addEventListener('pageshow',function(e){if(e.persisted)location.reload()});</script></body>`));
      }
      return respond('Không tìm thấy trang.', 404);
    } catch (error) {
      if ([413, 415].includes(error.status)) return respond(escape(error.message), error.status);
      // Never log cookies, password fields or configuration secrets.
      console.error('Study request failed:', error.name);
      return respond('Có lỗi xảy ra. Vui lòng thử lại sau.', 500);
    }
  };
}
