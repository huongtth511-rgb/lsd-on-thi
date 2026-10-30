import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('lich_su_dang_on_thi_tuong_tac_2026.html', root), 'utf8');
const logout = '<a class="navbtn" style="text-decoration:none" href="/signout-with-chatgpt?return_to=%2F" target="_top"><span class="navicon" aria-hidden="true">↪</span>Đăng xuất</a>';
const html = source.replace('</aside>', `${logout}</aside>`)
  .replace('Chạy ngoại tuyến 100%', 'Không gian học cá nhân')
  .replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>')
  .replace('</body>', "<script>window.addEventListener('pageshow',function(e){if(e.persisted)location.reload()});</script></body>");
for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new Script(script);
if (!html.includes(logout) || !html.includes('const SETS=')) throw new Error('Nội dung deploy không hợp lệ');
const out = new URL('sites-deploy/dist/', root);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('index.html', out), html);
console.log('Đã chuẩn bị và kiểm tra HTML cho Sites. Xác thực do lớp truy cập private của Sites quản lý.');
