import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync } from 'node:fs';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const target = new URL('sites-deploy/', root);
const source = readFileSync(new URL('lich_su_dang_on_thi_tuong_tac_2026.html', root), 'utf8');
for (const [, script] of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new Script(script);
for (const dir of ['lib/study/', 'app/[[...path]]/', 'db/']) mkdirSync(new URL(dir, target), { recursive: true });
writeFileSync(new URL('lib/study/quiz.html', target), source);
let login = readFileSync(new URL('login.html', root), 'utf8');
login = login.replace('autocomplete="username"', 'autocomplete="username" value="Huong"');
login = login.replace('<button type="submit">', '<label style="display:flex;align-items:center;gap:10px;font-weight:400"><input type="checkbox" name="remember" style="width:18px;height:18px">Ghi nhớ đăng nhập 30 ngày trên thiết bị này</label><button type="submit">');
writeFileSync(new URL('lib/study/login.html', target), login);
copyFileSync(new URL('auth.mjs', root), new URL('lib/auth.mjs', target));
copyFileSync(new URL('sites-app/handler.mjs', root), new URL('lib/study/handler.mjs', target));
copyFileSync(new URL('sites-app/schema.ts', root), new URL('db/schema.ts', target));
cpSync(new URL('sites-app/drizzle/', root), new URL('drizzle/', target), { recursive: true });
writeFileSync(new URL('app/[[...path]]/route.ts', target), `import { env } from 'cloudflare:workers';
import { createHandler } from '../../lib/study/handler.mjs';
import quizHtml from '../../lib/study/quiz.html?raw';
import loginHtml from '../../lib/study/login.html?raw';
export const dynamic = 'force-dynamic';
const handle = createHandler({ quizHtml, loginHtml });
export function GET(request: Request) { return handle(request, env); }
export function POST(request: Request) { return handle(request, env); }
export function HEAD(request: Request) { return handle(request, env); }
`);
console.log('Đã chuẩn bị ứng dụng Sites với xác thực máy chủ. Không tạo HTML ôn thi trong thư mục public.');
