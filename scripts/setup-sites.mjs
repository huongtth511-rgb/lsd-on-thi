import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../auth.mjs';
const root = new URL('../', import.meta.url);
const configFile = new URL('.sites-secrets.json', root);
const credentialsFile = new URL('.local-credentials.txt', root);
if (existsSync(configFile) || existsSync(credentialsFile)) throw new Error('Đã có cấu hình hoặc tài khoản local; không ghi đè.');
const password = randomBytes(18).toString('base64url');
const config = {
 AUTH_USERNAME: 'Huong',
 AUTH_PASSWORD_HASH: await hashPassword(password),
 SESSION_SECRET: randomBytes(32).toString('base64url'),
 APP_ORIGIN: 'https://lsd-on-thi-huong511.creamcake65.chatgpt.site',
};
writeFileSync(configFile, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
writeFileSync(credentialsFile, `Tài khoản trang ôn thi Lịch sử Đảng\nTên đăng nhập: Huong\nMật khẩu: ${password}\nTrang web: ${config.APP_ORIGIN}\n\nGiữ riêng file này. Không gửi hay đăng công khai.\n`, { mode: 0o600, flag: 'wx' });
console.log('Đã tạo thông tin đăng nhập riêng trong .local-credentials.txt và cấu hình bí mật local.');
