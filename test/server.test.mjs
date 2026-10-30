import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { createApp } from '../server.mjs';
import { hashPassword } from '../auth.mjs';

const password = 'Only-for-automated-tests-123!';
const passwordHash = await hashPassword(password);
const env = { AUTH_USERNAME: 'admin', AUTH_PASSWORD_HASH: passwordHash, APP_ORIGIN: 'http://localhost:3000' };
async function fixture(t, overrides = {}, clock) {
  const server = createApp({ ...env, ...overrides }, clock);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, { redirect: 'manual', ...options });
  return { request };
}
async function loginForm(request) {
  const response = await request('/login');
  const html = await response.text();
  return { csrf: html.match(/name="csrf" value="([^"]+)"/)[1], cookie: response.headers.getSetCookie()[0].split(';')[0] };
}
function post(form, values = {}, origin = env.APP_ORIGIN) {
  return { method: 'POST', headers: { Origin: origin, Cookie: form.cookie }, body: new URLSearchParams({ csrf: form.csrf, username: 'admin', password, ...values }) };
}

test('healthcheck available; private HTML and server files stay protected', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/healthz')).status, 200);
  for (const path of ['/', '/index.html', '/lich_su_dang_on_thi_tuong_tac_2026.html']) {
    const res = await request(path);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/login');
    assert.doesNotMatch(await res.text(), /const SETS/);
  }
  for (const path of ['/.env', '/server.mjs', '/.git/config', '/login.html', '/%2e%2e/.env']) {
    assert.equal((await request(path)).status, 404);
  }
});

test('valid login, protected content, logout revocation and forged cookies', async t => {
  const { request } = await fixture(t);
  const form = await loginForm(request);
  const response = await request('/login', post(form));
  assert.equal(response.status, 303);
  const sessionCookie = response.headers.getSetCookie()[0];
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=Strict/);
  const cookie = sessionCookie.split(';')[0];
  const page = await request('/', { headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const html = await page.text();
  assert.match(html, /const SETS=/);
  assert.match(html, /Đăng xuất/);
  const csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  assert.equal((await request('/logout', post({ cookie, csrf: 'forged' }))).status, 403);
  assert.equal((await request('/logout', post({ cookie, csrf }))).status, 303);
  assert.equal((await request('/', { headers: { Cookie: cookie } })).status, 303);
  assert.equal((await request('/', { headers: { Cookie: 'lsd_session=forged' } })).status, 303);
});

test('wrong password/user, CSRF, cross-origin and oversized body are rejected', async t => {
  const { request } = await fixture(t);
  const form = await loginForm(request);
  assert.equal((await request('/login', post(form, { password: 'incorrect' }))).status, 401);
  assert.equal((await request('/login', post(form, { username: 'other-user' }))).status, 401);
  assert.equal((await request('/login', post(form, { csrf: 'forged' }))).status, 403);
  assert.equal((await request('/login', post(form, {}, 'https://attacker.invalid'))).status, 403);
  assert.equal((await request('/login', post(form, { password: 'x'.repeat(5000) }))).status, 413);
});

test('production requires HTTPS and uses secure host-only cookies', async t => {
  assert.throws(() => createApp({ ...env, NODE_ENV: 'production' }), /HTTPS/);
  assert.throws(() => createApp({ ...env, AUTH_PASSWORD_HASH: '' }), /AUTH_PASSWORD_HASH/);
  const { request } = await fixture(t, { NODE_ENV: 'production', APP_ORIGIN: 'https://study.example.com' });
  const form = await loginForm(request);
  const response = await request('/login', post(form, {}, 'https://study.example.com'));
  assert.equal(response.status, 303);
  assert.match(response.headers.getSetCookie()[0], /^__Host-lsd_session=.*; Secure$/);
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
});

test('sessions and pre-login CSRF expire', async t => {
  let time = Date.now();
  const { request } = await fixture(t, {}, () => time);
  const form = await loginForm(request);
  const response = await request('/login', post(form));
  const cookie = response.headers.getSetCookie()[0].split(';')[0];
  time += 31 * 60 * 1000;
  assert.equal((await request('/login', post(form))).status, 403);
  time += 12 * 60 * 60 * 1000;
  assert.equal((await request('/', { headers: { Cookie: cookie } })).status, 303);
});

test('brute-force attempts are limited and recover after the cooldown', async t => {
  let time = Date.now();
  const { request } = await fixture(t, {}, () => time);
  const form = await loginForm(request);
  for (let i = 0; i < 20; i++) {
    assert.equal((await request('/login', post(form, { password: 'incorrect' }))).status, 401);
  }
  const blocked = await request('/login', post(form));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '900');
  time += 16 * 60 * 1000;
  assert.equal((await request('/login', post(form))).status, 303);
});

test('original quiz inline JavaScript parses without modification', () => {
  const source = readFileSync(new URL('../lich_su_dang_on_thi_tuong_tac_2026.html', import.meta.url), 'utf8');
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 2);
  for (const [, script] of scripts) assert.doesNotThrow(() => new Script(script));
});
