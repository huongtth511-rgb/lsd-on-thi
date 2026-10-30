import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from '../sites-app/handler.mjs';
import { hashPassword } from '../auth.mjs';

const password = 'test-only-a-long-password';
const passwordHash = await hashPassword(password);
const quizHtml = readFileSync(new URL('../lich_su_dang_on_thi_tuong_tac_2026.html', import.meta.url), 'utf8');
const loginHtml = readFileSync(new URL('../login.html', import.meta.url), 'utf8');
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE login_sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL, password_version TEXT NOT NULL); CREATE TABLE login_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
  const DB = {
    prepare(sql) {
      let params = [];
      const statement = {
        bind(...values) { params = values; return statement; },
        async first() { return db.prepare(sql).get(...params) ?? null; },
        async all() { return { results: db.prepare(sql).all(...params) }; },
        async run() { return db.prepare(sql).run(...params); },
      };
      return statement;
    },
    async batch(statements) { return Promise.all(statements.map(x => x.all())); },
  };
  const env = { DB, AUTH_USERNAME: 'Huong', AUTH_PASSWORD_HASH: passwordHash, SESSION_SECRET: 'x'.repeat(40), APP_ORIGIN: 'https://study.example' };
  const handler = createHandler({ quizHtml, loginHtml });
  const request = (path, options) => handler(new Request('https://study.example' + path, options), env);
  return { request, env, db };
}
async function form(request) {
  const response = await request('/login');
  const html = await response.text();
  return { csrf: html.match(/name="csrf" value="([^"]+)"/)[1], cookie: response.headers.getSetCookie()[0].split(';')[0] };
}
function post(f, entries = {}) {
  return { method: 'POST', headers: { cookie: f.cookie, origin: 'https://study.example' }, body: new URLSearchParams({ csrf: f.csrf, username: 'Huong', password, ...entries }) };
}

test('Site: login protects quiz and logout revokes session', async () => {
  const {request, db} = fixture();
  assert.equal((await request('/')).status, 303);
  assert.equal((await request('/lich_su_dang_on_thi_tuong_tac_2026.html')).status, 303);
  assert.equal((await request('/.env')).status, 404);
  const f = await form(request);
  assert.equal((await request('/login', post(f, { password:'wrong' }))).status, 401);
  const login = await request('/login', post(f, { remember: 'on' }));
  assert.equal(login.status, 303);
  const setCookie = login.headers.getSetCookie()[0];
  assert.match(setCookie, /__Host-lsd_session=.*HttpOnly; Secure; SameSite=Lax; Max-Age=2592000/);
  const cookie = setCookie.split(';')[0];
  const page = await request('/', {headers:{cookie}});
  assert.equal(page.status, 200);
  const body = await page.text();
  assert.match(body, /const SETS=/);
  const csrf = body.match(/name="csrf" value="([^"]+)"/)[1];
  assert.equal((await request('/logout', post({cookie,csrf:'invalid'}))).status, 403);
  assert.equal((await request('/logout', post({cookie,csrf}))).status, 303);
  assert.equal((await request('/', {headers:{cookie}})).status, 303);
  db.close();
});

test('Site: reject forged CSRF, origin, large body and password rotation', async () => {
  const {request, env, db} = fixture();
  const f = await form(request);
  assert.equal((await request('/login', post(f, {csrf:'forged'}))).status, 403);
  const badOrigin = post(f); badOrigin.headers.origin = 'https://attacker.invalid';
  assert.equal((await request('/login', badOrigin)).status, 403);
  assert.equal((await request('/login', post(f, {password:'a'.repeat(5000)}))).status, 413);
  const response = await request('/login', post(f));
  const cookie = response.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await request('/', {headers:{cookie}})).status, 200);
  env.AUTH_PASSWORD_HASH = await hashPassword('replacement-password');
  assert.equal((await request('/', {headers:{cookie}})).status, 303);
  db.close();
});

test('Site: mobile same-origin form with a null Origin can sign in and out', async () => {
  const { request, db } = fixture();
  const f = await form(request);
  const spoof = post(f);
  spoof.headers.origin = 'null';
  assert.equal((await request('/login', spoof)).status, 403);
  spoof.headers['sec-fetch-site'] = 'cross-site';
  assert.equal((await request('/login', spoof)).status, 403);
  spoof.headers['sec-fetch-site'] = 'same-origin';
  const response = await request('/login', spoof);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  const cookie = response.headers.getSetCookie()[0].split(';')[0];
  const page = await request('/', { headers: { cookie } });
  const csrf = (await page.text()).match(/name="csrf" value="([^"]+)"/)[1];
  const logout = post({ cookie, csrf });
  logout.headers.origin = 'null';
  logout.headers['sec-fetch-site'] = 'same-origin';
  assert.equal((await request('/logout', logout)).status, 303);
  assert.equal((await request('/', { headers: { cookie } })).status, 303);
  db.close();
});

test('Site: login rate limit survives handler instances', async () => {
  const { request, db } = fixture();
  const f = await form(request);
  for (let i = 0; i < 20; i++) assert.equal((await request('/login', post(f, {password: 'wrong'}))).status, 401);
  assert.equal((await request('/login', post(f))).status, 429);
  db.close();
});
