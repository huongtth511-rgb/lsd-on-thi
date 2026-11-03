import {readFileSync,writeFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const source=new URL('data/teacher-150-yellow.json',root);
const notesFile=new URL('data/answer-notes.json',root);
const htmlFile=new URL('lich_su_dang_on_thi_tuong_tac_2026.html',root);
const teacher=JSON.parse(readFileSync(source,'utf8'));
const notes=JSON.parse(readFileSync(notesFile,'utf8'));
let html=readFileSync(htmlFile,'utf8');
const pattern=/const SETS=(\[.*?\]);const NOTES=/s;
const match=html.match(pattern);
if(!match)throw Error('Không tìm thấy bộ câu hỏi trong HTML.');
const sets=JSON.parse(match[1]),set=sets.find(x=>x.id==='s5');
if(!set||set.questions.length!==150||teacher.question_count!==150||Object.keys(teacher.highlighted_answers).length!==150)throw Error('Bộ 150 câu hoặc nguồn đáp án không đầy đủ.');

const cautions={
  18:'PDF mới tô vàng A, nhưng mệnh đề “vấn đề thổ địa là cái cốt của cách mạng tư sản dân quyền” thuộc Luận cương chính trị tháng 10/1930 (C). Web chấm A theo đúng dấu tô vàng; nên kiểm tra lại với giảng viên.',
  99:'PDF mới tô vàng A. Tuy nhiên Đại hội VII thông qua cả Cương lĩnh 1991 (A) và Chiến lược đến năm 2000 (B), vì vậy phương án D bao quát hơn nếu hỏi các văn kiện. Web chấm A theo dấu tô vàng.',
  108:'PDF mới tô vàng C (“nhu cầu”), nhưng đặc trưng trong Cương lĩnh 1991 viết “làm theo năng lực, hưởng theo lao động” (B). Web chấm C theo dấu tô vàng; nên kiểm tra lại với giảng viên.'
};
const explanations={
  4:'Cương lĩnh đầu tiên đặt nhiệm vụ chống đế quốc, giành độc lập dân tộc lên hàng đầu, đồng thời chống phong kiến.',
  11:'Luận cương tháng 10/1930 chưa đặt nhiệm vụ giải phóng dân tộc lên hàng đầu và đánh giá chưa đúng khả năng đoàn kết các lực lượng yêu nước.',
  23:'Hội nghị Trung ương 8 (5/1941) quyết định giải quyết vấn đề dân tộc trong khuôn khổ từng nước Đông Dương.',
  102:'Quan điểm của Đảng xác định con người là mục tiêu và động lực của sự phát triển.'
};
const changed=[];
for(let i=1;i<=150;i++){
  const q=set.questions[i-1],letter=teacher.highlighted_answers[i];
  if(q?.no!==i||!q.options.some(o=>o.letter===letter))throw Error(`Không khớp câu ${i}`);
  const note=notes[q.id]||{},old=note.answer||q.answer;
  if(old!==letter)changed.push({number:i,from:old,to:letter});
  q.answer=letter;
  q.answerSource='Đáp án tô vàng trong PDF bổ sung';
  note.answer=letter;
  note.pdf_highlighted=true;
  delete note.teacher_marked;
  delete note.caution;
  if(cautions[i]){note.caution=true;note.explanation=cautions[i]}
  else if(explanations[i])note.explanation=explanations[i];
  notes[q.id]=note;
}
writeFileSync(notesFile,JSON.stringify(notes,null,2)+'\n');
html=html.replace(pattern,()=>`const SETS=${JSON.stringify(sets)};const NOTES=`);
writeFileSync(htmlFile,html);
console.log(`Đã áp dụng 150 đáp án tô vàng; ${changed.length} câu đổi khóa: ${changed.map(x=>`${x.number} ${x.from}→${x.to}`).join(', ')||'không có'}.`);
