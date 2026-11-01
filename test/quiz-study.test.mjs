import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

function app() {
  const html = readFileSync(new URL('../lich_su_dang_on_thi_tuong_tac_2026.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1]);
  const logic = scripts[1].split("$$('.navbtn').forEach(b=>b.onclick")[0];
  const memory = new Map();
  const sandbox = { localStorage: { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,v) }, Intl, Math, Date, console };
  createContext(sandbox);
  runInContext(scripts[0] + '\n' + logic + `\nglobalThis.api={
    sets:()=>SETS, keyed:q=>getKey(q),
    preview:(set,show,search='')=>{showPreviewAnswers=show;qsearch=search;return {html:previewQuestions(set),count:previewCount(set)}},
    previewSelect:(id,letter)=>{previewSelections[id]=letter},
    previewReset:()=>{previewSelections={}},
    notes:()=>ANSWER_NOTES,
    setSession:(s)=>{session=s}, view:()=>quizView(), grade:()=>grade(),
    choose:(q,a)=>{session.answers[q.id]=a},clear:q=>{delete session.answers[q.id]},
    override:(id,key)=>{profile.override[id]=key}
  };`, sandbox);
  return sandbox.api;
}
function sessionFor(q, feedback=false) {
  return {setId:'mixed',qids:[q.id],options:{[q.id]:q.options.map(o=>o.letter)},answers:{},pos:0,started:Date.now(),finished:false,feedback};
}

test('preview displays all matching questions with keys, and preserves an intentionally cleared key', () => {
  const a=app(), set=a.sets().find(s=>s.questions.length>25);
  assert.ok(set);
  const hidden=a.preview(set,false), shown=a.preview(set,true);
  assert.equal((hidden.html.match(/class="review"/g)||[]).length,set.questions.length);
  assert.equal((shown.html.match(/class="review"/g)||[]).length,set.questions.length);
  assert.match(shown.html,/✓ Đáp án gợi ý/);
  assert.match(shown.html,/Giải thích:/);
  assert.doesNotMatch(hidden.html,/✓ Đáp án gợi ý/);
  assert.match(hidden.count,new RegExp(String(set.questions.length)));
  const unique='không có cụm này abcxyz';
  assert.match(a.preview(set,true,unique).html,/Không có câu hỏi phù hợp/);
  const keyed=set.questions.find(q=>a.keyed(q));
  a.override(keyed.id,null);
  const html=a.preview({questions:[keyed]},true).html;
  assert.match(html,/Bạn đã tự sửa đáp án/);
  assert.doesNotMatch(html,/✓ Đáp án gợi ý/);
});

test('preview lets learners select, change, reveal and hide each answer with an explanation', () => {
  const a=app(), q=a.sets()[0].questions[0], key=a.keyed(q), wrong=q.options.find(o=>o.letter!==key).letter;
  assert.doesNotMatch(a.preview({questions:[q]},false).html,/✓ Đáp án gợi ý|Giải thích:/);
  a.previewSelect(q.id,wrong);
  let view=a.preview({questions:[q]},false).html;
  assert.match(view,/Bạn chọn chưa đúng/);
  assert.match(view,/✓ Đáp án gợi ý/);
  assert.match(view,/Giải thích:/);
  a.previewSelect(q.id,key);
  assert.match(a.preview({questions:[q]},false).html,/Bạn chọn đúng/);
  a.previewReset();
  assert.doesNotMatch(a.preview({questions:[q]},false).html,/✓ Đáp án gợi ý|Giải thích:/);
});

test('every question has an explanation and a selectable answer', () => {
  const a=app(), all=a.sets().flatMap(s=>s.questions), byId=new Map(all.map(q=>[q.id,q]));
  for(const [id,note] of Object.entries(a.notes())) {
    const q=byId.get(id);
    assert.ok(q, `unknown question ${id}`);
    assert.ok(note.explanation);
    if(note.answer) assert.ok(q.options.some(o=>o.letter===note.answer), `invalid key ${id}`);
  }
  assert.equal(all.length,942);
  for(const q of all) assert.ok(q.options.some(o=>o.letter===a.keyed(q)),`missing key ${q.id}`);
  const flawed=byId.get('s4-i11');
  assert.equal(a.keyed(flawed),'B');
  const shown=a.preview({questions:[flawed]},true).html;
  assert.match(shown,/✓ Đáp án gợi ý/);
  assert.match(shown,/6\/1\/1946/);
  assert.equal(a.keyed(byId.get('s4-i1')),'D');
  const sourceNotes=JSON.parse(readFileSync(new URL('../data/answer-notes.json',import.meta.url),'utf8'));
  assert.equal(JSON.stringify(a.notes()),JSON.stringify(sourceNotes));
});

test('instant mode reveals right and wrong only after a choice, follows changes and handles a cleared key', () => {
  const a=app(), set=a.sets()[0];
  const q=set.questions.find(q=>a.keyed(q)), key=a.keyed(q), wrong=q.options.find(o=>o.letter!==key).letter;
  a.setSession(sessionFor(q,true));
  assert.doesNotMatch(a.view(),/Bạn chọn đúng|Bạn chọn sai|Đáp án gợi ý là/);
  a.choose(q,wrong);
  assert.match(a.view(),/Bạn chọn sai/);
  assert.match(a.view(),/Đáp án gợi ý là/);
  assert.match(a.view(),/answer correct/);
  assert.match(a.view(),/answer incorrect/);
  a.choose(q,key);
  assert.match(a.view(),/Bạn chọn đúng theo đáp án gợi ý/);
  assert.doesNotMatch(a.view(),/answer incorrect/);
  a.clear(q);
  assert.doesNotMatch(a.view(),/Bạn chọn đúng|Bạn chọn sai|Đáp án gợi ý là/);
  const unknown=set.questions[1];a.override(unknown.id,null);
  a.setSession(sessionFor(unknown,true));a.choose(unknown,unknown.options[0].letter);
  assert.match(a.view(),/chưa có đáp án gợi ý để đối chiếu/);
  assert.doesNotMatch(a.view(),/answer correct|answer incorrect/);
});

test('ordinary 40-question exam keeps answers hidden until grading, including old saved sessions', () => {
  const a=app(), q=a.sets().flatMap(s=>s.questions).find(q=>a.keyed(q)), key=a.keyed(q);
  const session=sessionFor(q,false);delete session.feedback;
  a.setSession(session);a.choose(q,key);
  const view=a.view();
  assert.doesNotMatch(view,/Bạn chọn đúng theo đáp án|Đáp án gợi ý là|answer correct|answer incorrect/);
  assert.match(view,/Nộp bài/);
  assert.equal(a.grade().right,1);
});


test('textbook citations appear and disputed questions use the closest choice', () => {
  const a=app(), all=a.sets().flatMap(s=>s.questions), byId=new Map(all.map(q=>[q.id,q]));
  assert.equal(a.keyed(byId.get('s1-i20')),'D');
  assert.equal(a.keyed(byId.get('s3-i75')),'B');
  assert.equal(a.keyed(byId.get('s6-i21')),'C');
  assert.equal(a.keyed(byId.get('s8-i58')),'B');
  assert.equal(a.keyed(byId.get('s6-i45')),'A');
  assert.equal(a.keyed(byId.get('s9-i67')),'C');
  assert.equal(a.keyed(byId.get('s7-i48')),'D');
  assert.equal(a.keyed(byId.get('s7-i80')),'D');
  assert.equal(a.keyed(byId.get('s7-i83')),'D');
  assert.equal(a.keyed(byId.get('s7-i85')),'B');
  assert.equal(a.keyed(byId.get('s8-i39')),'A');
  assert.equal(a.keyed(byId.get('s8-i55')),'B');
  assert.equal(a.keyed(byId.get('s8-i62')),'B');
  assert.equal(a.keyed(byId.get('s5-i49')),'A');
  assert.equal(a.keyed(byId.get('s5-i108')),'B');
  assert.equal(a.keyed(byId.get('s5-i132')),'A');
  assert.equal(a.keyed(byId.get('s9-i63')),'C');
  assert.equal(a.keyed(byId.get('s3-i69')),'B');
  assert.equal(a.keyed(byId.get('s8-i19')),'D');
  assert.equal(a.keyed(byId.get('s8-i49')),'C');
  assert.match(a.preview({questions:[byId.get('s7-i4')]},true).html,/28\/7\/1914/);
  const q=byId.get('s5-i98');
  assert.match(a.preview({questions:[q]},true).html,/Giáo trình Lịch sử Đảng.*264/);
});

test('new chapter 3 PDF includes all questions, highlighted keys and explanations', () => {
  const a=app(), set=a.sets().find(s=>s.id==='s10');
  const source=JSON.parse(readFileSync(new URL('../data/chapter3-basic.json',import.meta.url),'utf8'));
  assert.ok(set);
  assert.equal(set.chapter,3);
  assert.equal(set.questions.length,232);
  assert.equal(JSON.stringify(set.questions),JSON.stringify(source));
  for(let i=0;i<232;i++) {
    const q=set.questions[i];
    assert.equal(q.no,i+1);
    assert.equal(q.id,`s10-i${i+1}`);
    assert.deepEqual(Array.from(q.options,o=>o.letter),['A','B','C','D']);
    assert.ok(q.q && q.options.every(o=>o.text));
    assert.ok(q.options.some(o=>o.letter===q.answer));
  }
  assert.equal(a.keyed(set.questions[0]),'B');
  assert.equal(a.keyed(set.questions[8]),set.questions[8].answer);
  assert.equal(a.keyed(set.questions[159]),set.questions[159].answer);
  assert.equal(set.questions[168].options[3].text,'Hệ thống chính trị và vai trò lãnh đạo của Đảng.');
  const shown=a.preview(set,true);
  assert.equal((shown.html.match(/class="review"/g)||[]).length,232);
  assert.match(shown.html,/✓ Đáp án gợi ý/);
  assert.doesNotMatch(shown.html,/Chưa có giải thích được biên soạn/);
  assert.match(shown.html,/Cương lĩnh 2011 sửa thành/);
});
