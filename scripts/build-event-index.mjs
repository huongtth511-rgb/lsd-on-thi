import {readFileSync, writeFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('lich_su_dang_on_thi_tuong_tac_2026.html',root),'utf8');
const found=html.match(/const SETS=(\[.*?\]);const NOTES=/s);
if(!found)throw Error('Không tìm thấy ngân hàng câu hỏi trong HTML.');
const sets=JSON.parse(found[1]);
const notes=JSON.parse(readFileSync(new URL('data/answer-notes.json',root),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('data/events.json',root),'utf8'));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
const all=sets.flatMap(set=>set.questions.map(q=>({q,set})));
const patterns=new Map(catalog.map(event=>[event.id,event.patterns.map(p=>new RegExp(p,'i'))]));
const ids=new Set(), result=[];
for(const event of catalog){
  if(ids.has(event.id))throw Error(`Trùng mã sự kiện ${event.id}`);
  ids.add(event.id);
  const items=new Set();
  for(const {q,set} of all){
    const key=notes[q.id]?.answer||q.answer;
    const correct=q.options.find(o=>o.letter===key)?.text||'';
    const hay=norm(q.q+' '+correct);
    if(event.id.startsWith('congress')){
      const roman=['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii'][Number(event.id.slice(8))-1];
      const foreign=new RegExp(`dai hoi[ a-z]{0,45}\\b(?:${roman}|${event.id.slice(8)})\\b.{0,35}quoc te cong san`,'i');
      if(foreign.test(hay))continue;
    }
    if(patterns.get(event.id).some(re=>re.test(hay)))items.add(q.id);
  }
  for(const [setId,start,end] of event.ranges||[]){
    const set=sets.find(x=>x.id===setId);
    if(!set||!Number.isInteger(start)||!Number.isInteger(end)||start>end)throw Error(`Khoảng câu không hợp lệ: ${event.id}`);
    for(let number=start;number<=end;number++){
      const q=set.questions.find(x=>x.no===number);
      if(!q)throw Error(`Thiếu câu ${setId}-${number} trong ${event.id}`);
      items.add(q.id);
    }
  }
  for(const id of event.ids||[]){
    if(!all.some(({q})=>q.id===id))throw Error(`Không tìm thấy câu ${id} trong ${event.id}`);
    items.add(id);
  }
  if(items.size){
    const order=new Map(all.map(({q},i)=>[q.id,i]));
    result.push({id:event.id,group:event.group,title:event.title,date:event.date,chapter:event.chapter,ids:[...items].sort((a,b)=>order.get(a)-order.get(b))});
  }
}
writeFileSync(new URL('data/event-index.json',root),JSON.stringify(result,null,2)+'\n');
const tagged=new Set(result.flatMap(event=>event.ids));
console.log(`${result.length} sự kiện, ${tagged.size}/${all.length} câu liên quan; ${result.reduce((n,e)=>n+e.ids.length,0)} lượt gắn.`);
console.log(result.map(event=>`${event.id}:${event.ids.length}`).join(' '));
