import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const sourceFile = new URL('lich_su_dang_on_thi_tuong_tac_2026.html', root);
const notes = JSON.parse(readFileSync(new URL('data/answer-notes.json', root), 'utf8'));
const html = readFileSync(sourceFile, 'utf8');
const pattern = /const ANSWER_NOTES=.*?;\nfunction getKey\(/;
if (!pattern.test(html)) throw new Error('Không tìm thấy vị trí dữ liệu đáp án trong HTML.');
writeFileSync(sourceFile, html.replace(pattern, () => `const ANSWER_NOTES=${JSON.stringify(notes)};\nfunction getKey(`));
console.log(`Đã đồng bộ ${Object.keys(notes).length} ghi chú vào HTML.`);
