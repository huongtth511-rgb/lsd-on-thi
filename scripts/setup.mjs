import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../auth.mjs';

const root = new URL('../', import.meta.url);
const envFile = new URL('.env', root);
const credentialFile = new URL('.local-credentials.txt', root);
if (existsSync(envFile) || existsSync(credentialFile)) {
  console.error('Đã có cấu hình/tài khoản local. Không ghi đè để tránh mất thông tin đăng nhập.');
  process.exit(1);
}
const username = 'admin';
const password = randomBytes(18).toString('base64url');
const hash = await hashPassword(password);
writeFileSync(envFile, `AUTH_USERNAME=${username}\nAUTH_PASSWORD_HASH=${hash}\nNODE_ENV=development\nPORT=3000\nAPP_ORIGIN=http://localhost:3000\n`, { mode: 0o600, flag: 'wx' });
writeFileSync(credentialFile, `Tài khoản website ôn thi (không phải GitHub/Railway)\nTên đăng nhập: ${username}\nMật khẩu: ${password}\n\nGiữ file này riêng tư; đã được loại khỏi Git và Docker.\nBiến AUTH_PASSWORD_HASH trong .env dùng để cấu hình Railway.\n`, { mode: 0o600, flag: 'wx' });
console.log(`Đã tạo .env và tài khoản tại ${fileURLToPath(credentialFile)}.\nChạy npm start để mở ứng dụng tại http://localhost:3000.`);
