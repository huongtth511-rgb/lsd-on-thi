import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validHash, verifyPassword } from './auth.mjs';

const htmlFile = 'lich_su_dang_on_thi_tuong_tac_2026.html';
const sourceHtml = readFileSync(new URL(htmlFile, import.meta.url), 'utf8');
const loginHtml = readFileSync(new URL('login.html', import.meta.url), 'utf8');
const sessionLifetime = 12 * 60 * 60 * 1000;
const csrfLifetime = 30 * 60 * 1000;
const attemptWindow = 15 * 60 * 1000;

function equal(a, b) {
  const x = Buffer.from(a ?? ''), y = Buffer.from(b ?? '');
  return x.length === y.length && timingSafeEqual(x, y);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 4096) {
        chunks = [];
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

export function createApp(env = process.env, now = Date.now) {
  const username = env.AUTH_USERNAME;
  const passwordHash = env.AUTH_PASSWORD_HASH;
  const production = env.NODE_ENV === 'production';
  if (!username || username.length > 100 || !validHash(passwordHash)) {
    throw new Error('Thiếu/sai AUTH_USERNAME hoặc AUTH_PASSWORD_HASH. Chạy npm run setup hoặc cấu hình Railway Variables.');
  }
  const configuredOrigin = env.APP_ORIGIN || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : '');
  if (production && !configuredOrigin) throw new Error('Production cần APP_ORIGIN hoặc RAILWAY_PUBLIC_DOMAIN.');
  const origin = new URL(configuredOrigin || `http://localhost:${env.PORT || 3000}`).origin;
  if (production && !origin.startsWith('https://')) throw new Error('APP_ORIGIN production phải dùng HTTPS.');
  const cookieName = production ? '__Host-lsd_session' : 'lsd_session';
  const csrfCookieName = production ? '__Host-lsd_csrf' : 'lsd_csrf';
  const secret = randomBytes(32);
  const sessions = new Map();
  let attempts = [];
  let activeChecks = 0;
  const sign = value => createHmac('sha256', secret).update(value).digest('base64url');
  const newCsrf = () => {
    const value = `${now()}.${randomBytes(24).toString('base64url')}`;
    return `${value}.${sign(value)}`;
  };
  const validCsrf = token => {
    if (typeof token !== 'string' || token.length > 200) return false;
    const parts = token.split('.');
    const age = now() - Number(parts[0]);
    return parts.length === 3 && age >= 0 && age < csrfLifetime && equal(parts[2], sign(`${parts[0]}.${parts[1]}`));
  };
  const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${production ? '; Secure' : ''}`;
  const sendLogin = (res, status = 200, error = '') => {
    const token = newCsrf();
    res.setHeader('Set-Cookie', cookie(csrfCookieName, token, csrfLifetime / 1000));
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(loginHtml.replace('{{ERROR}}', error).replace('{{CSRF}}', token));
  };
  const redirect = (res, destination) => {
    res.writeHead(303, { Location: destination });
    res.end();
  };

  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // The supplied quiz uses inline scripts and event handlers. Disallow external sources.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const path = new URL(req.url, 'http://internal').pathname;
      const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(c => {
        const i = c.indexOf('=');
        return i < 0 ? ['', ''] : [c.slice(0, i).trim(), c.slice(i + 1)];
      }));
      for (const [id, session] of sessions) if (session.expires <= now()) sessions.delete(id);
      const sessionId = cookies[cookieName];
      const session = sessions.get(sessionId);
      if ((req.method === 'GET' || req.method === 'HEAD') && path === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
      }
      if (req.method === 'GET' && path === '/login') {
        return session ? redirect(res, '/') : sendLogin(res);
      }
      if (req.method === 'POST' && (path === '/login' || path === '/logout')) {
        // Require the configured origin, including scheme and port, on every mutation.
        if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') {
          res.writeHead(403); return res.end('Yêu cầu không hợp lệ.');
        }
        if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
          res.writeHead(415); return res.end('Định dạng không hỗ trợ.');
        }
        const body = await readBody(req);
        if (path === '/logout') {
          if (!session || !equal(body.get('csrf'), session.csrf)) {
            res.writeHead(403); return res.end('Phiên không hợp lệ.');
          }
          sessions.delete(sessionId);
          res.setHeader('Set-Cookie', cookie(cookieName, '', 0));
          return redirect(res, '/login');
        }
        if (!validCsrf(body.get('csrf')) || !equal(body.get('csrf'), cookies[csrfCookieName])) {
          return sendLogin(res, 403, 'Phiên đăng nhập đã hết hạn. Vui lòng thử lại.');
        }
        attempts = attempts.filter(time => now() - time < attemptWindow);
        if (attempts.length >= 20 || activeChecks >= 4) {
          res.setHeader('Retry-After', activeChecks >= 4 ? '5' : '900');
          return sendLogin(res, 429, 'Có quá nhiều lần đăng nhập. Vui lòng thử lại sau.');
        }
        attempts.push(now());
        const password = body.get('password') ?? '';
        const suppliedUser = body.get('username') ?? '';
        if (password.length > 256 || suppliedUser.length > 100) return sendLogin(res, 400, 'Thông tin đăng nhập quá dài.');
        activeChecks++;
        let passwordMatches;
        try { passwordMatches = await verifyPassword(password, passwordHash); }
        finally { activeChecks--; }
        if (!passwordMatches || !equal(suppliedUser, username)) {
          return sendLogin(res, 401, 'Tên đăng nhập hoặc mật khẩu không đúng.');
        }
        const id = randomBytes(32).toString('base64url');
        if (sessionId) sessions.delete(sessionId);
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        sessions.set(id, { csrf: randomBytes(32).toString('base64url'), expires: now() + sessionLifetime });
        res.setHeader('Set-Cookie', [cookie(cookieName, id, sessionLifetime / 1000), cookie(csrfCookieName, '', 0)]);
        return redirect(res, '/');
      }
      if (req.method === 'GET' && ['/', '/index.html', `/${htmlFile}`].includes(path)) {
        if (!session) return redirect(res, '/login');
        const logout = `<form action="/logout" method="post"><input type="hidden" name="csrf" value="${session.csrf}"><button class="navbtn" type="submit"><span class="navicon" aria-hidden="true">↪</span>Đăng xuất</button></form>`;
        const html = sourceHtml.replace('</aside>', `${logout}</aside>`)
          .replace('Chạy ngoại tuyến 100%', 'Tài khoản cá nhân')
          .replace('</body>', `<script>window.addEventListener('pageshow',function(e){if(e.persisted)location.reload()});</script></body>`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Không tìm thấy trang.');
    } catch (error) {
      if (!res.headersSent) res.writeHead(error.status === 413 ? 413 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.status === 413 ? 'Yêu cầu quá lớn.' : 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ.');
  const server = createApp();
  server.listen(port, '0.0.0.0', () => console.log(`Ứng dụng đang chạy trên cổng ${port}.`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
