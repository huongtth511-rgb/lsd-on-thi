import {readFileSync,writeFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const source=new URL('data/teacher-150-marked.json',root);
const notesFile=new URL('data/answer-notes.json',root);
const htmlFile=new URL('lich_su_dang_on_thi_tuong_tac_2026.html',root);
const teacher=JSON.parse(readFileSync(source,'utf8'));
const notes=JSON.parse(readFileSync(notesFile,'utf8'));
let html=readFileSync(htmlFile,'utf8');
const pattern=/const SETS=(\[.*?\]);const NOTES=/s;
const match=html.match(pattern);
if(!match)throw Error('Không tìm thấy bộ câu hỏi trong HTML.');
const sets=JSON.parse(match[1]),set=sets.find(x=>x.id==='s5');
if(!set||set.questions.length!==150)throw Error('Không tìm thấy đúng bộ 150 câu.');
if(teacher.marked_answer_count!==45||teacher.source_question_count!==149||JSON.stringify(teacher.missing_question_numbers)!=='[105]')throw Error('Cấu trúc file đáp án khác lần đối chiếu trước.');

const cautions={
  4:'File đáp án của thầy tô đỏ B. Tuy nhiên, giáo trình 2026 (tr. 64–65) đặt chống đế quốc, giành độc lập dân tộc lên hàng đầu, tương ứng với A. Web chấm theo file thầy; nên hỏi lại thầy về điểm này.',
  11:'File đáp án của thầy tô đỏ C. Giáo trình 2026 (tr. 77–78) nêu hạn chế của Luận cương là chưa nhấn mạnh giải phóng dân tộc và liên minh rộng rãi, tương ứng với B. Web chấm theo file thầy; nên hỏi lại thầy về điểm này.',
  23:'File đáp án của thầy tô đỏ C. Giáo trình 2026 (tr. 96–97) gắn việc giải quyết vấn đề dân tộc trong từng nước Đông Dương với Trung ương 8 tháng 5/1941, tương ứng với A. Web chấm theo file thầy; nên hỏi lại thầy về điểm này.'
};
const changed=[];
for(const [number,letter] of Object.entries(teacher.marked_answers)){
  const i=Number(number),q=set.questions[i-1];
  if(!Number.isInteger(i)||i<1||i>45||q?.no!==i||!q.options.some(o=>o.letter===letter))throw Error(`Không khớp câu ${number}`);
  const note=notes[q.id]||{};
  const old=note.answer||q.answer;
  if(old!==letter)changed.push({number:i,from:old,to:letter});
  q.answer=letter;
  q.answerSource='Đáp án tô đỏ trong file của thầy (chỉ câu 1–45)';
  note.answer=letter;
  note.teacher_marked=true;
  if(cautions[i]){note.caution=true;note.explanation=cautions[i]}
  notes[q.id]=note;
}
if(Object.keys(teacher.marked_answers).length!==45)throw Error('Thiếu đáp án tô đỏ.');
writeFileSync(notesFile,JSON.stringify(notes,null,2)+'\n');
html=html.replace(pattern,()=>`const SETS=${JSON.stringify(sets)};const NOTES=`);
writeFileSync(htmlFile,html);
console.log(`Đã áp dụng ${teacher.marked_answer_count} đáp án tô đỏ; ${changed.length} câu đổi khóa: ${changed.map(x=>`${x.number} ${x.from}→${x.to}`).join(', ')||'không có'}.`);
