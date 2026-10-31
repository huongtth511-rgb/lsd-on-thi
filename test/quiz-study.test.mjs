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

test('preview displays all matching questions with keys, and preserves unknown keys', () => {
  const a=app(), set=a.sets().find(s=>s.questions.length>25 && s.questions.some(q=>!a.keyed(q)));
  assert.ok(set);
  const hidden=a.preview(set,false), shown=a.preview(set,true);
  assert.equal((hidden.html.match(/class="review"/g)||[]).length,set.questions.length);
  assert.equal((shown.html.match(/class="review"/g)||[]).length,set.questions.length);
  assert.match(shown.html,/✓ Đáp án gợi ý/);
  assert.match(shown.html,/Đề chưa có phương án phù hợp|Đề cần làm rõ|Không có phương án đúng|cần đối chiếu/);
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

test('new answer notes match valid options and a question without a valid option stays ungraded', () => {
  const a=app(), all=a.sets().flatMap(s=>s.questions), byId=new Map(all.map(q=>[q.id,q]));
  for(const [id,note] of Object.entries(a.notes())) {
    const q=byId.get(id);
    assert.ok(q, `unknown question ${id}`);
    assert.ok(note.explanation);
    if(note.answer) assert.ok(q.options.some(o=>o.letter===note.answer), `invalid key ${id}`);
  }
  const flawed=byId.get('s4-i11');
  assert.equal(a.keyed(flawed),null);
  a.override(flawed.id,'B');
  assert.equal(a.keyed(flawed),null);
  const shown=a.preview({questions:[flawed]},true).html;
  assert.match(shown,/Không có phương án đúng/);
  assert.match(shown,/6\/1\/1946/);
  assert.doesNotMatch(shown,/✓ Đáp án gợi ý/);
  assert.equal(a.keyed(byId.get('s4-i1')),'D');
  const sourceNotes=JSON.parse(readFileSync(new URL('../data/answer-notes.json',import.meta.url),'utf8'));
  assert.equal(JSON.stringify(a.notes()),JSON.stringify(sourceNotes));
});

test('instant mode reveals right and wrong only after a choice, follows changes and handles missing key', () => {
  const a=app(), set=a.sets().find(s=>s.questions.some(q=>a.keyed(q)) && s.questions.some(q=>!a.keyed(q)));
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
  const unknown=set.questions.find(q=>!a.keyed(q));
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


test('textbook citations appear and ambiguous questions remain ungraded', () => {
  const a=app(), all=a.sets().flatMap(s=>s.questions), byId=new Map(all.map(q=>[q.id,q]));
  for (const id of ['s1-i20','s3-i75']) assert.equal(a.keyed(byId.get(id)),null);
  assert.equal(a.keyed(byId.get('s6-i21')),'C');
  assert.equal(a.keyed(byId.get('s8-i58')),'B');
  assert.equal(a.keyed(byId.get('s6-i45')),'A');
  assert.equal(a.keyed(byId.get('s9-i67')),'C');
  assert.equal(a.keyed(byId.get('s9-i63')),null);
  for (const id of ['s9-i31','s9-i44','s9-i71']) assert.equal(a.keyed(byId.get(id)),null);
  const q=byId.get('s5-i98');
  assert.match(a.preview({questions:[q]},true).html,/Giáo trình Lịch sử Đảng.*264/);
});
