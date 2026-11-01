import {readFileSync,writeFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const source=new URL('lich_su_dang_on_thi_tuong_tac_2026.html',root);
const groups=JSON.parse(readFileSync(new URL('data/event-index.json',root),'utf8'));
const html=readFileSync(source,'utf8');
const marker=/const EVENT_GROUPS=.*?;\n/;
if(!marker.test(html))throw Error('Không tìm thấy vị trí dữ liệu sự kiện trong HTML.');
writeFileSync(source,html.replace(marker,()=>`const EVENT_GROUPS=${JSON.stringify(groups)};\n`));
console.log(`Đã đồng bộ ${groups.length} sự kiện vào HTML.`);
