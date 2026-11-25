/**
 * 第四阶段回归：stats / plan / format / calibrate。
 * 跑法：node scripts/test-stats.js
 *
 * 覆盖：format 两套结构逐项数字、覆盖度「没笔记≠没掌握」、错因分布五类、
 * 连续答错两个来源、dueList 进入逐日计划、旧卷不计全真模考文案、
 * 校准只读且不回写权重、四页真实 JS 冒烟。
 *
 * harness 参照 test-cards.js：global.wx 必须先设（img.js 顶层碰 wx）。
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
};

/* ---------------- wx mock（先于任何业务 require） ---------------- */
const storage = {};
const navs = [];
const wx = {
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: () => {},
  showModal: (o) => { if (o.success) o.success({ confirm: true }); },
  navigateTo: (o) => { navs.push(o.url); },
  switchTab: (o) => { navs.push(o.url); },
  previewImage: () => {},
  getFileSystemManager: () => ({ mkdirSync: () => {}, writeFileSync: () => {} }),
  env: { USER_DATA_PATH: '/tmp/ekb-stats-test' },
};
global.wx = wx;
global.App = (cfg) => cfg;
global.getCurrentPages = () => [];

const ROOT = path.resolve(__dirname, '..');
const F = require(path.join(ROOT, 'data', 'format.js'));
const T = require(path.join(ROOT, 'utils', 'stats.js'));
const C = require(path.join(ROOT, 'utils', 'cards.js'));
const S = require(path.join(ROOT, 'utils', 'store.js'));

const TODAY = '2026-11-24';
function reset() {
  Object.keys(storage).forEach((k) => delete storage[k]);
  navs.length = 0;
}
function loadPage(rel) {
  let page = null;
  global.Page = (cfg) => { page = cfg; };
  const key = path.join(ROOT, 'pages', rel);
  delete require.cache[require.resolve(key)];
  require(key);
  page.setData = function (patch) { Object.assign(this.data, patch); };
  return page;
}
function addCard(data) { return C.add(data, TODAY); }

console.log('\n--- 1. format 两套结构：逐项对照 brain.py format --era both 实测输出 ---');
{
  const p = F.pre2021, q = F.post2021;
  ok('改革前 150分/180分钟/23题', p.total_score === 150 && p.minutes === 180 && p.qcount === 23);
  ok('改革前 单选8×4=32 / 填空6×4=24 / 解答9题94分',
    p.choices.count === 8 && p.choices.each === 4 && p.choices.total === 32 &&
    p.fills.count === 6 && p.fills.each === 4 && p.fills.total === 24 &&
    p.solutions.count === 9 && p.solutions.total === 94);
  ok('改革前 客观56 / 主观94', p.objective === 56 && p.subjective === 94);
  ok('改革前占比 数一56/22/22 数二78/22/0 数三56/22/22',
    p.ratio['数一'].H === 0.56 && p.ratio['数一'].L === 0.22 && p.ratio['数一'].P === 0.22 &&
    p.ratio['数二'].H === 0.78 && p.ratio['数二'].L === 0.22 && p.ratio['数二'].P === 0 &&
    p.ratio['数三'].H === 0.56 && p.ratio['数三'].L === 0.22 && p.ratio['数三'].P === 0.22);

  ok('改革后 150分/180分钟/22题', q.total_score === 150 && q.minutes === 180 && q.qcount === 22);
  ok('改革后 单选10×5=50 / 填空6×5=30 / 解答6题70分',
    q.choices.count === 10 && q.choices.each === 5 && q.choices.total === 50 &&
    q.fills.count === 6 && q.fills.each === 5 && q.fills.total === 30 &&
    q.solutions.count === 6 && q.solutions.total === 70);
  ok('改革后 客观80 / 主观70', q.objective === 80 && q.subjective === 70);
  ok('改革后占比 数一60/20/20 数二80/20/0 数三60/20/20',
    q.ratio['数一'].H === 0.6 && q.ratio['数一'].L === 0.2 && q.ratio['数一'].P === 0.2 &&
    q.ratio['数二'].H === 0.8 && q.ratio['数二'].L === 0.2 && q.ratio['数二'].P === 0 &&
    q.ratio['数三'].H === 0.6 && q.ratio['数三'].L === 0.2 && q.ratio['数三'].P === 0.2);
  ok('差异英文数字一致：客观+24 主观-24 解答-3 题量23→22',
    q.objective - p.objective === 24 && p.subjective - q.subjective === 24 &&
    p.solutions.count - q.solutions.count === 3 && p.qcount - q.qcount === 1);
  ok('两套口径都正确 + 旧卷不能计全真模考的常驻说明存在',
    /两套口径都正确/.test(F.disclaimer) && /不能计入全真模考/.test(F.disclaimer));
  ok('来源字段写明 brain.py 实测转录', /brain\.py format --era both/.test(F.source));
}

console.log('\n--- 2. 覆盖度：没笔记 ≠ 没掌握 ---');
{
  reset();
  // 数一应考 22 独立章 + L7 非独立章 = 23 编码；只给 H2 一张卡。
  addCard({ type: 'concept', title: '中值定理', tags: ['H2.3'] });
  const cov = T.coverage(C.load(), '数一');
  ok('覆盖度按当前卷全部章编码（含非独立章 L7）', cov.targetCount === 23, 'target=' + cov.targetCount);
  ok('只 H2 有笔记 → coveredCount=1', cov.coveredCount === 1, 'covered=' + cov.coveredCount);
  ok('应考但零笔记列出 H1/H3/L5 等编号',
    ['H1', 'H3', 'L5'].every((c) => cov.gaps.some((g) => g.code === c)));
  ok('零笔记清单不含已记笔记的 H2', !cov.gaps.some((g) => g.code === 'H2'));
  ok('明确写「不能推断为没掌握」', /不能推断为/.test(cov.note) && /没掌握/.test(cov.note));
  // 关键断言：level=0 的错题制造「答错事实」，但覆盖度只看 tags，不把它变成薄弱推断。
  addCard({ type: 'wrong', title: '错题归零', tags: ['H3'], error_type: '计算失误',
    migration: '先验端点', level: 0 });
  const st = T.streaks(C.load(), []);
  const cov2 = T.coverage(C.load(), '数一');
  ok('level=0 错题不写 tags 之外的覆盖结论：H3 变有笔记，不进 gaps',
    !cov2.gaps.some((g) => g.code === 'H3'));
  ok('答错归零只在「连续答错」区块出现（新录入无 last_review 不算）',
    st.reset.length === 0, 'reset=' + st.reset.length);
  ok('两棵树不合并：覆盖缺口是章编码，薄弱来源是行为事实，字段分离',
    Array.isArray(cov2.gaps) && typeof cov2.note === 'string' && Array.isArray(st.records));
}

console.log('\n--- 3. 错因分布五类 + 连续答错 ---');
{
  reset();
  addCard({ type: 'wrong', title: 'a', tags: ['H1'], error_type: '思路缺失', migration: 'm' });
  addCard({ type: 'wrong', title: 'b', tags: ['H1'], error_type: '思路缺失', migration: 'm' });
  addCard({ type: 'wrong', title: 'c', tags: ['H2'], error_type: '计算失误', migration: 'm' });
  const d = T.errorDistribution(C.load());
  ok('五类全列且顺序固定', d.rows.length === 5 &&
    d.rows.map((r) => r.name).join('/') === C.ERROR_TYPES.join('/'));
  ok('计数正确：思路缺失2 / 计算失误1', d.rows[0].n === 2 && d.rows[2].n === 1);
  ok('占比合计约 100%（整数四舍五入容差）', Math.abs(d.rows.reduce((s, r) => s + r.pct, 0) - 100) <= 2);
  ok('无错因的卡不推断', d.total === 3);

  // 有复习记录且归零才算；records 末尾连续 none≥2 才算。
  const cards = C.load();
  cards[0].last_review = TODAY; cards[0].level = 0; C.save(cards);
  const st = T.streaks(C.load(), [
    { kp: 'kpA', kpName: '中值定理', mastery: 0, ts: 1 },
    { kp: 'kpA', kpName: '中值定理', mastery: 0, ts: 2 },
    { kp: 'kpB', kpName: '泰勒', mastery: 1, ts: 3 },
  ]);
  ok('卡片侧：有 last_review 且 level=0 进入 reset', st.reset.length === 1 && st.reset[0].id === cards[0].id);
  ok('记录侧：同一 kp 末尾连续两次 none 进入 records', st.records.length === 1 && st.records[0].n === 2);
}

console.log('\n--- 4. dueList 进入逐日计划 + 旧卷不计全真模考 ---');
{
  reset();
  const due = addCard({ type: 'wrong', title: '到期错题', tags: ['H2.3'],
    error_type: '思路缺失', migration: '先验证端点' });
  // cards.add 按录入日算首次复习，到期日要直接改存储（不靠 add 的入参）。
  const cardsBefore = C.load();
  cardsBefore.filter((c) => c.id === due.id)[0].next_review = '2020-01-01';
  C.save(cardsBefore);
  S.add({ kp: 'kpX', vol: '1', kpName: '薄弱考点A', mastery: 0, levelLabel: '还是不会', kind: 'off', ts: Date.now() });
  const plan = T.buildPlan({ examDate: '2026-12-20', days: 7, today: TODAY,
    cards: C.load(), records: S.load(), weakNames: ['薄弱考点A'] });
  ok('7 天计划 + 日期从今天起', plan.days === 7 && plan.rows.length === 7 && plan.rows[0].date === TODAY);
  ok('dueList 到期条目进入逐日计划', plan.dueTotal >= 1 &&
    plan.rows.some((r) => r.dueItems.some((it) => it.id === due.id)));
  ok('逐日计划含到期条数/分钟数（路径 setData 用的字段齐备）',
    plan.rows.every((r) => typeof r.dueCount === 'number' && typeof r.dueMinutes === 'number'));
  ok('薄弱章节来自行为事实参数', plan.rows[0].focus === '薄弱考点A');
  const text = JSON.stringify(plan.principles) + JSON.stringify(plan.rows.map((r) => r.mockText + r.oldPaperNote));
  ok('限时模考 8:30–11:30 / 180 分钟 / 闭卷', /8:30–11:30/.test(text) && /180 分钟/.test(text) && /闭卷/.test(text));
  ok('真题优先于模拟卷', /真题优先于模拟卷/.test(text));
  ok('只 2021 起的套卷计为全真模考', /只把 2021 起的套卷计为限时全真模考/.test(text));
  ok('旧结构套卷归知识点训练/专题题源且不比较分数',
    /旧结构套卷/.test(text) && /知识点训练 \/ 专题题源/.test(text) && /不比较分数/.test(text));
  ok('模考后安排错题归因', /模考后必须安排错题归因/.test(text));
  ok('不把刷套卷数量当进度指标', /不把刷套卷数量当进度指标/.test(text));
  ok('倒计时只陈述事实，无「来不及」字样', !/来不及/.test(text));
  ok('默认考试日期 2026-12-20', /2026-12-20/.test(F && T.buildPlan({ today: TODAY }).examDate));
}

console.log('\n--- 5. 题源校准：只读、无回写权重函数 ---');
{
  reset();
  addCard({ type: 'assessment', title: '题评1', tags: ['H2.3'], source: '2024 数二真题 T17',
    reward: 82.5, value: 5.5, verdict: '值得做' });
  addCard({ type: 'assessment', title: '题评2', tags: ['H2.3'], source: '某机构模拟卷',
    reward: 41.5, value: 2.8, verdict: '不值得做' });
  addCard({ type: 'wrong', title: '真题错题', tags: ['H2.3'], error_type: '思路缺失',
    migration: 'm', source: '2023 数二真题 T18' });
  const r = T.calibrate(S.load(), C.load());
  ok('评估题数=2，真题笔记=1', r.assessedCount === 2 && r.realNoteCount === 1,
    r.assessedCount + '/' + r.realNoteCount);
  ok('按 H/L/P 大类聚合（与 skill top_tag 同口径）', r.rows.length === 1 && r.rows[0].code === 'H');
  ok('平均收益 =(82.5+41.5)/2 = 62', r.rows[0].avgReward === 62, String(r.rows[0].avgReward));
  ok('值得做比例 1/2 = 50%', r.rows[0].worth === 1 && r.rows[0].worthPct === 50);
  ok('真题笔记数进入同一行', r.rows[0].realNotes === 1);
  ok('来源分布标注真题', r.sources.some((s) => s.isReal && /真题/.test(s.source)));
  ok('常驻自选择偏差说明为 skill 口径',
    /自选择偏差/.test(r.warning) && /不是官方命题频率/.test(r.warning) &&
    /不自动回写评分权重/.test(r.warning) && /手工编辑 rubric 参数/.test(r.warning));
  // 硬约束：没有任何写回能力。
  const exportNames = Object.keys(T);
  ok('stats 模块没有回写权重的导出函数',
    !exportNames.some((n) => /write|save|set|update|persist/i.test(n)), exportNames.join(','));
  const pageSrc = fs.readFileSync(path.join(ROOT, 'pages', 'calibrate', 'calibrate.js'), 'utf8');
  ok('校准页不写存储、不写 rubric', !/setStorageSync|rubric\.js|require\(.*rubric/.test(pageSrc));
  const calWxml = fs.readFileSync(path.join(ROOT, 'pages', 'calibrate', 'calibrate.wxml'), 'utf8');
  ok('校准页没有任何可点击操作（只读，无一键回写按钮）',
    !/(bind|catch)[a-z]+=/.test(calWxml));
  ok('题评卡不因校准进入复习位', C.dueList(TODAY).every((c) => c.type !== 'assessment'));
}

console.log('\n--- 6. 四页真实 JS 冒烟 ---');
{
  reset();
  const fmt = loadPage('format/format.js');
  fmt.pickEra({ currentTarget: { dataset: { k: 'pre2021' } } });
  ok('结构页切改革前显示 23 题 / 56 分', fmt.data.era === 'pre2021' &&
    /23 题/.test(fmt.data.view.totalLine) && /客观题 56 分/.test(fmt.data.view.objectiveLine));
  ok('结构页常驻免责说明', /两套口径都正确/.test(fmt.data.disclaimer));

  const plan = loadPage('plan/plan.js');
  plan.onShow();
  ok('计划页默认 2026-12-20 且生成逐日计划', plan.data.examDate === '2026-12-20' &&
    plan.data.plan && Array.isArray(plan.data.plan.rows));
  ok('计划页原则常驻六条', plan.data.principles.length === 6);

  const cal = loadPage('calibrate/calibrate.js');
  cal.onShow();
  ok('校准页 onShow 得到只读报告与常驻说明', cal.data.report && /自选择偏差/.test(cal.data.warning));

  const dg = loadPage('diagnose/diagnose.js');
  dg.onShow();
  ok('诊断页覆盖度区块有数据且写明没笔记≠没掌握',
    dg.data.coverage && /不能推断为/.test(dg.data.coverage.note));
  dg.toggleStats();
  ok('诊断页统计区块可折叠', dg.data.showStats === true);
  dg.goPlan(); dg.goFormat(); dg.goCalibrate();
  ok('三个新入口均走 navigateTo，未加 tab',
    navs.length === 3 && navs.every((u) => u.indexOf('/pages/') === 0 && u.indexOf('switchTab') < 0) &&
    navs.indexOf('/pages/plan/plan') >= 0 && navs.indexOf('/pages/format/format') >= 0 &&
    navs.indexOf('/pages/calibrate/calibrate') >= 0);
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  // 新增 pages/progress/progress 后页面数 11 → 12；tabBar 仍保持 5 项不变。
  ok('app.json pages 12 / tabBar 仍 5 项',
    app.pages.length === 12 && app.tabBar.list.length === 5 &&
    app.pages.indexOf('pages/progress/progress') >= 0);
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
