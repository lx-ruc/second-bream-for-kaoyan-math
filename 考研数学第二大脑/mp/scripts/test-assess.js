/**
 * F1–F6 启发层纯函数回归（判定权裁决：事实层优先）。
 * 跑法：node scripts/test-assess.js
 *
 * 覆盖：六判据 fidelity、三档阈值边界、卷种错配三种数据边界、
 * 性价比 R/C 与每 10 分钟收益、personal 缺省中性值、
 * conflictWithFact 两个方向、practiceValue 事实层阈值未被改动。
 * 全部只读源码与纯函数，不依赖 wx / 页面 / 网络。
 */
const fs = require('fs');
const path = require('path');
const E = require(path.resolve(__dirname, '..', 'utils', 'engine.js'));
const R = require(path.resolve(__dirname, '..', 'data', 'rubric.js'));

const ENGINE_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'utils', 'engine.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
};

const OPT = (extra) => Object.assign({
  examType: '数一',
  tags: ['H2.3'],
  format: '解答',
  fidelity: [1, 1, 1, 1, 1, 1],
  transfer: 'high',
  practiceBand: 'exam',
}, extra || {});

console.log('--- 0. rubric 生成物（assessment-rubric.json 原样）---');
const w = {};
(R.dimensions || []).forEach((d) => { w[d.key] = d.weight; });
ok('五维权重 mastery/coverage/fidelity/transfer/personal',
  w.mastery === 0.25 && w.coverage === 0.15 && w.fidelity === 0.3 &&
  w.transfer === 0.15 && w.personal === 0.15, JSON.stringify(w));
ok('阈值 worth=70 optional=45 hardF=0.5 worthF=0.6',
  R.thresholds.worth_score === 70 && R.thresholds.optional_score === 45 &&
  R.thresholds.hard_fidelity === 0.5 && R.thresholds.worth_fidelity === 0.6,
  JSON.stringify(R.thresholds));
ok('default_minutes 单选5/填空6/解答15',
  R.default_minutes['单选'] === 5 && R.default_minutes['填空'] === 6 && R.default_minutes['解答'] === 15);
ok('disclaimer 非空且含「启发式判断」',
  !!R.disclaimer && R.disclaimer.indexOf('启发式判断') >= 0);
ok('assessValue 返回的 disclaimer 与 rubric 逐字一致',
  E.assessValue(OPT()).disclaimer === R.disclaimer);

console.log('\n--- 1. fidelityScore：六位 0/1 均值 ---');
ok('六条全 1 → fidelity=1', E.fidelityScore([1, 1, 1, 1, 1, 1]) === 1);
ok('六条全 0 → fidelity=0', E.fidelityScore([0, 0, 0, 0, 0, 0]) === 0);
ok('四条判 1 → 4/6', Math.abs(E.fidelityScore([1, 1, 1, 1, 0, 0]) - 4 / 6) < 1e-9);
ok('位数不足不折算，按 0 处理（拿不准判 0）', E.fidelityScore([1, 1, 1]) === 0);

console.log('\n--- 2. 阈值边界（事实层不参与 verdict 计算）---');
const worth = E.assessValue(OPT({ fidelity: [1, 1, 1, 1, 0, 0] }));
ok('R=72.5 ≥ 70 且 fidelity≈0.667 ≥ 0.6 → worth',
  worth.R === 72.5 && worth.fidelity > 0.6 && worth.verdict === 'worth',
  'R=' + worth.R + ' f=' + worth.fidelity + ' v=' + worth.verdict);
const hardF = E.assessValue(OPT({ fidelity: [1, 1, 1, 0, 0, 0] }));
ok('fidelity=0.5 ≤ 硬线 → skip（即使 R=67.5）',
  hardF.fidelity === 0.5 && hardF.R === 67.5 && hardF.verdict === 'skip',
  'R=' + hardF.R + ' v=' + hardF.verdict);
const lowR = E.assessValue(OPT({
  tags: undefined, level: '了解', transfer: 0, personal: 0,
  fidelity: [1, 1, 1, 1, 0, 0],
}));
ok('R=41.5 < 45 → skip（fidelity 已过 0.5，走收益分支）',
  lowR.R === 41.5 && lowR.fidelity > 0.5 && lowR.verdict === 'skip',
  'R=' + lowR.R + ' f=' + lowR.fidelity + ' v=' + lowR.verdict);
const optional = E.assessValue(OPT({ fidelity: [1, 1, 1, 1, 0, 0], transfer: 'mid' }));
ok('fidelity 过线但 R=66.5 < 70 → optional',
  optional.R === 66.5 && optional.verdict === 'optional', 'R=' + optional.R);
ok('reason 明确标注「启发式」', worth.reason.indexOf('启发式') === 0);

console.log('\n--- 3. 卷种错配：边界从 syllabus.js 数据派生 ---');
[['3', 'P8', '数三贴 P8'], ['2', 'H7', '数二贴 H7'], ['3', 'L7', '非数一贴 L7'],
 ['1', 'L7', '数一贴 L7 应放行']].forEach((c) => {
  const a = E.assessValue(OPT({
    examType: c[0], tags: [c[1]], practiceBand: 'exam', transfer: 'high',
  }));
  if (c[0] === '1') {
    ok(c[2] + '：不误伤', a.veto.length === 0 && a.verdict === 'worth', JSON.stringify(a.veto));
  } else {
    ok(c[2] + '：命中卷种错配并 skip',
      a.veto.indexOf('卷种错配') >= 0 && a.verdict === 'skip', JSON.stringify(a.veto));
    ok(c[2] + '：reason 带该编码与目标卷', a.reason.indexOf(c[1]) >= 0);
  }
});
ok('数字卷号 "2" 与中文 "数二" 归一到同一卷种边界',
  E.assessValue(OPT({ examType: '2', tags: ['H7'] })).veto.indexOf('卷种错配') >= 0 &&
  E.assessValue(OPT({ examType: '数二', tags: ['H7'] })).veto.indexOf('卷种错配') >= 0);

console.log('\n--- 4. 性价比 R/C 与每 10 分钟收益 ---');
const c15 = E.assessValue(OPT());
ok('缺省 C=15（rubric.default_minutes.解答）', c15.C === 15);
ok('R=82.5 / C=15 → value=5.5', c15.R === 82.5 && c15.value === 5.5);
ok('per10 = R/C×10 = 55', c15.per10 === 55);
const c30 = E.assessValue(OPT({ minutes: 30 }));
ok('显式 C=30 → value=2.75 / per10=27.5',
  c30.C === 30 && c30.value === 2.75 && c30.per10 === 27.5);
const cFmt = E.assessValue(OPT({ format: '单选', tags: ['H2.3'] }));
ok('题型「单选」缺省 C=5', cFmt.C === 5 && cFmt.per10 === 165);

console.log('\n--- 5. personal：无 vault 取中性值并显式标注 ---');
const pDef = E.assessValue(OPT());
ok('personal 缺省 = 0.5', pDef.scores.personal === 0.5, String(pDef.scores.personal));
ok('personalNote 写明「无 vault 个人数据 / 中性值 / 非用户实测数据」',
  pDef.personalNote.indexOf('无 vault') >= 0 &&
  pDef.personalNote.indexOf('中性值') >= 0 &&
  pDef.personalNote.indexOf('非用户实测数据') >= 0);
ok('scores.notes 标注「层级未逐条标注，取中性值」',
  pDef.scores.notes.indexOf('层级未逐条标注，取中性值') >= 0);
const pIn = E.assessValue(OPT({ personal: 0.9 }));
ok('调用方给 personal=0.9 → R=88.5', pIn.scores.personal === 0.9 && pIn.R === 88.5);

console.log('\n--- 6. conflictWithFact：两个方向，结论仍以事实层为准 ---');
const c1 = E.assessValue(OPT({ practiceBand: 'skip' }));
ok('启发 worth + 事实 skip → conflict=true', c1.verdict === 'worth' && c1.conflictWithFact === true);
const c2 = E.assessValue(OPT({ fidelity: [1, 1, 1, 0, 0, 0], practiceBand: 'exam' }));
ok('启发 skip + 事实 exam → conflict=true', c2.verdict === 'skip' && c2.conflictWithFact === true);
ok('启发 worth + 事实 exam → conflict=false',
  E.assessValue(OPT({ practiceBand: 'exam' })).conflictWithFact === false);
ok('启发 skip + 事实 skip → conflict=false',
  E.assessValue(OPT({ fidelity: [1, 1, 1, 0, 0, 0], practiceBand: 'skip' })).conflictWithFact === false);
ok('事实层四带只有 exam/worth/edge/skip，未新增启发层带位',
  /band = '(exam|worth|edge|skip)'/.test(ENGINE_SRC));

console.log('\n--- 7. 事实层阈值未被启发层改动（读源码断言）---');
ok('PRACTICE_EXAM = 0.55 仍在', /const PRACTICE_EXAM\s*=\s*0\.55\s*;/.test(ENGINE_SRC));
ok('PRACTICE_WORTH = 0.34 仍在', /const PRACTICE_WORTH\s*=\s*0\.34\s*;/.test(ENGINE_SRC));
ok('PRACTICE_EDGE = 0.23 仍在', /const PRACTICE_EDGE\s*=\s*0\.23\s*;/.test(ENGINE_SRC));
['真题级 · 值得精刷', '同考法 · 值得刷', '考法存疑 · 挑着做', '真题不考 · 建议跳过'].forEach((t) => {
  ok('事实层标题未变：' + t, ENGINE_SRC.indexOf(t) >= 0);
});

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
