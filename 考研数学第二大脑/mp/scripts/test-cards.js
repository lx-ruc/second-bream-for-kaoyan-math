/**
 * 五类知识卡 / 检索 / 间隔复习回归。
 * 跑法：node scripts/test-cards.js
 *
 * 覆盖：五类卡 frontmatter 字段、ID/存储隔离、1/3/7/15/30/60 升级与答错归零、
 * 迁移规则质量线（含强制保存标注）、query 四种筛选、dueList 到期/排序/题评排除、
 * update 追加不覆盖、导出 frontmatter 与沙盒路径、三页真实逻辑冒烟。
 *
 * harness 参照 test-flow.js：global.wx 必须先设（img.js 模块顶层就碰 wx），
 * 再 require 任何页面模块。
 */
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
};

/* ---------------- wx mock（必须先于任何业务 require） ---------------- */
const storage = {};
const files = {};
const dirs = [];
const navs = [];
const clips = [];
let modalConfirm = true;
const wx = {
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: () => {},
  showModal: (o) => { if (o.success) o.success({ confirm: modalConfirm }); },
  navigateTo: (o) => { navs.push(o.url); },
  setClipboardData: (o) => { clips.push(o.data); },
  getFileSystemManager: () => ({
    mkdirSync: (p, recursive) => { dirs.push([p, recursive]); },
    writeFileSync: (p, data, enc) => { files[p] = data; },
  }),
  env: { USER_DATA_PATH: '/tmp/ekb-cards-test' },
};
global.wx = wx;
global.App = (cfg) => cfg;
global.getCurrentPages = () => [];

const C = require(path.resolve(__dirname, '..', 'utils', 'cards.js'));
const S = require(path.resolve(__dirname, '..', 'utils', 'store.js'));
const DAY = '2026-11-24';

function loadPage(rel) {
  let page = null;
  global.Page = (cfg) => { page = cfg; };
  const moduleKey = path.resolve(__dirname, '..', 'pages', rel);
  delete require.cache[require.resolve(moduleKey)];
  require(moduleKey);
  page.setData = function (patch) { Object.assign(this.data, patch); };
  return page;
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function reset() {
  storage[C.KEY] = [];
}

function sample(type, extra) {
  return Object.assign({
    type: type,
    title: '卡-' + type,
    tags: ['H2.3', 'L5'],
    error_type: type === 'wrong' ? '思路缺失' : '',
    source: '2024 数二真题 T17',
    era: 'post2021',
    difficulty: 4,
    exam_type: '数二',
    migration: type === 'wrong' ? '见到 f\' 与 f 同现，先想到构造辅助函数' : '',
    body: {
      '题干要点': '中值定理构造辅助函数',
      '我的做法卡点': '知道用罗尔，没想到构造 F(x)',
      '正解关键': '构造 F(x)=...',
      '错因归因': '主因：思路缺失',
      '关联': '[[H2.3]]',
    },
  }, extra || {});
}

(async function main() {
  console.log('--- 0. 存储隔离与五类卡字段 ---');
  reset();
  ok('KEY 与 store.js 分离', C.KEY === 'ekb.records.v1' ? false : C.KEY === 'ekb.cards.v1');
  const made = C.TYPES.map((t) => C.add(sample(t), DAY));
  ok('五类卡各建一张', made.length === 5 && made.every((c, i) => c.type === C.TYPES[i]));
  ok('frontmatter 13 字段齐全', made.every((c) => C.FM_KEYS.every((k) => k in c)));
  ok('ID 形如 YYYYMMDD-NNN 且递增', made.every((c, i) => c.id === '20261124-' + String(i + 1).padStart(3, '0')),
    made.map((c) => c.id).join(','));
  ok('标签归一去重', made[0].tags.join(',') === 'H2.3,L5');
  ok('wrong 有错因，非 wrong 错因为 null',
    made[0].error_type === '思路缺失' && made.slice(1).every((c) => c.error_type === null));
  ok('默认第一次复习 = 次日（skill 口径）', made.every((c) => c.next_review === addDays(DAY, 1)));
  ok('level 起始 0 / last_review null / created=当天 / updated=当天',
    made.every((c) => c.level === 0 && c.last_review === null && c.created === DAY && c.updated === DAY));
  ok('正文按类型骨架齐全', made.every((c) => C.BODY_SECTIONS[c.type].every((k) => k in c.body)));
  ok('迁移规则镜像进正文六节', made[0].body['迁移规则'] === made[0].migration);
  ok('无迁移规则的 wrong 标为未完成；有规则的不标', made[0].incomplete === false);
  let threw = false;
  try { C.add(sample('bogus'), DAY); } catch (e) { threw = true; }
  ok('非法类型直接拒绝（不擅自编造类型）', threw);
  ok('卡片不写进 ekb.records.v1', storage['ekb.records.v1'] === undefined);
  ok('store.js 读到的记录仍为空', S.load().length === 0);

  console.log('\n--- 1. 迁移规则质量线 ---');
  const noMig = C.add(sample('wrong', { migration: '', title: '没写迁移规则' }), DAY);
  const issues = C.validate(noMig);
  ok('空迁移规则触发 skill 原文提示',
    issues.indexOf('没有迁移规则的错题卡视为未完成') >= 0, JSON.stringify(issues));
  ok('add 自动标注 incomplete', noMig.incomplete === true);
  const okCard = C.add(sample('wrong', { title: '有迁移规则' }), DAY);
  ok('完整卡 validate 无问题', C.validate(okCard).length === 0, JSON.stringify(C.validate(okCard)));
  const badTag = C.add(sample('concept', { title: '乱标签', tags: ['X9'] }), DAY);
  ok('标签格式校验拦住 X9，但不推断编码',
    C.invalidTags(badTag.tags).join() === 'X9' && C.validate(badTag).some((s) => s.indexOf('标签格式待核对') === 0));

  console.log('\n--- 2. 间隔 1/3/7/15/30/60 与答错归零 ---');
  reset();
  const sched = C.add(sample('wrong'), DAY);
  const actual = [];
  for (let i = 1; i <= 6; i++) {
    const r = C.markDone(sched.id, true, DAY);
    actual.push([r.level, r.next_review]);
  }
  ok('六次答对 level = 1..6', actual.map((a) => a[0]).join(',') === '1,2,3,4,5,6',
    actual.map((a) => a[0]).join(','));
  ok('六次答对间隔 = 1/3/7/15/30/60 天',
    actual.map((a, i) => a[1] === addDays(DAY, C.INTERVALS[i])).every(Boolean),
    actual.map((a) => a[1]).join(','));
  const at6 = C.markDone(sched.id, true, DAY);
  ok('满级后保持 6 级 / 60 天不溢出', at6.level === 6 && at6.next_review === addDays(DAY, 60));
  ok('答题日期写进 last_review', at6.last_review === DAY);
  const again = C.markDone(sched.id, false, DAY);
  ok('答错归零 level=0 且 next_review=今天',
    again.level === 0 && again.next_review === DAY, again.level + '/' + again.next_review);
  const againOk = C.markDone(sched.id, true, DAY);
  ok('归零后答对回到 1 级 / 1 天',
    againOk.level === 1 && againOk.next_review === addDays(DAY, 1));
  ok('不存在的 ID 不炸', C.markDone('not-exist', true, DAY) === null);

  console.log('\n--- 3. dueList：只返回到期、题评排除、错因→章节→难度排序 ---');
  reset();
  function dueCard(title, err, tag, difficulty, due, type) {
    const c = C.add(sample(type || 'wrong', {
      title: title, error_type: err, tags: [tag], difficulty: difficulty,
    }), DAY);
    c.next_review = due;
    C.save(C.load());
    return c;
  }
  const c1 = dueCard('逾期-思路-H2.3-d2', '思路缺失', 'H2.3', 2, addDays(DAY, -2));
  const c2 = dueCard('今日-思路-H2.3-d4', '思路缺失', 'H2.3', 4, DAY);
  const c3 = dueCard('今日-思路-L5-d1', '思路缺失', 'L5', 1, DAY);
  const c4 = dueCard('今日-概念-H2.3-d5', '概念不清', 'H2.3', 5, DAY);
  const c5 = dueCard('今日-计算-H2.3-d5', '计算失误', 'H2.3', 5, DAY);
  dueCard('题评-不占复习位', '', 'H2.3', 5, addDays(DAY, -1), 'assessment');
  dueCard('未来-不到期', '思路缺失', 'H2.3', 5, addDays(DAY, 1));
  const due = C.dueList(DAY);
  ok('题评卡与未来卡被排除，逾期卡保留', due.length === 5 && due.every((c) => c.type !== 'assessment' && c.next_review <= DAY),
    'count=' + due.length);
  // 难度方向与 skill brain.py 一致：同错因同章节内，难的排前（-difficulty）。
  ok('排序：错因聚类→章节→难度（同组难的在前）',
    due.map((c) => c.id).join(',') === [c2, c1, c3, c4, c5].map((c) => c.id).join(','),
    due.map((c) => c.title).join(' | '));
  ok('思路缺失与概念不清排在其他错因前',
    ['思路缺失', '思路缺失', '思路缺失', '概念不清'].every((e, i) => due[i].error_type === e));
  ok('建议用时映射 1/2/3/4/5 → 3/5/8/12/15',
    [1, 2, 3, 4, 5].map((n) => C.minutesFor(n)).join(',') === '3,5,8,12,15');
  ok('dueList 行带 minutes 字段', due.every((c) => c.minutes === C.minutesFor(c.difficulty)));

  console.log('\n--- 4. query 四种筛选 ---');
  const byTag = C.query({ tag: 'L5' });
  ok('按标签筛出 L5', byTag.length === 1 && byTag[0].id === c3.id, byTag.length + '');
  const byErr = C.query({ errorType: '思路缺失' });
  ok('按错因筛出 4 条（含未来到期那条）', byErr.length === 4, byErr.length + '');
  const byType = C.query({ type: 'assessment' });
  ok('按类型筛出题评卡', byType.length === 1 && byType[0].type === 'assessment');
  const byText = C.query({ text: '构造辅助函数' });
  ok('全文搜到正文里的迁移规则', byText.length === 7, byText.length + '');
  ok('组合条件取交集',
    C.query({ tag: 'H2.3', errorType: '思路缺失', type: 'wrong', text: '逾期' }).length === 1);
  ok('无命中返回空数组', C.query({ tag: 'Z9' }).length === 0);
  ok('query 不修改存储', C.load().length === 7);

  console.log('\n--- 5. update：追加新段落，不覆盖正文与复习状态 ---');
  const before = C.load().filter((c) => c.id === c1.id)[0];
  const after = C.update(c1.id, {
    body: { '题干要点': '补充：设 F(x)=f(x)-...' },
    migration: '补充：先验证端点等值',
    title: before.title,
  }, DAY);
  ok('正文旧段落保留', after.body['题干要点'].indexOf(before.body['题干要点']) === 0);
  ok('新段落以空行追加', after.body['题干要点'].indexOf('\n\n补充：') > 0);
  ok('迁移规则同样追加而非覆盖',
    after.migration.indexOf(before.migration) === 0 && after.migration.indexOf('\n\n补充：') > 0);
  ok('level/next_review/last_review/created 不被编辑改动',
    after.level === before.level && after.next_review === before.next_review &&
    after.last_review === before.last_review && after.created === before.created);
  // 编辑页打开时 textarea 里是完整段落；原样再保存一次不应重复追加。
  const twice = C.update(c1.id, {
    body: { '题干要点': after.body['题干要点'] },
    migration: after.migration,
  }, DAY);
  ok('重复提交相同内容不重复追加', twice.body['题干要点'] === after.body['题干要点'] &&
    twice.migration === after.migration);
  ok('updated 已刷新', twice.updated === DAY);

  console.log('\n--- 6. 导出 frontmatter 与沙盒路径 ---');
  const exp = C.load().filter((c) => c.id === c2.id)[0];
  const md = C.toMarkdown(exp);
  const fm = md.split('---')[1];
  ok('frontmatter 13 字段齐全', C.FM_KEYS.every((k) => new RegExp('(^|\\n)' + k + ':').test(fm)),
    fm.replace(/\n/g, ' | '));
  ok('tags 写成 skill 的数组格式', /\ntags: \[H2\.3\]/.test(fm));
  ok('错题六节骨架齐全（含旧标题写法）',
    ['## 题干要点', '## 我的做法 / 卡在哪一步', '## 正解关键', '## 错因归因', '## 迁移规则', '## 关联']
      .every((h) => md.indexOf(h) >= 0));
  ok('迁移规则正文在导出里', md.indexOf(exp.migration) >= 0);
  ok('缺值写 null 不编造', /\nlast_review: null/.test(fm));
  const file = C.exportOne(exp.id);
  ok('导出到 USER_DATA_PATH/obsidian/<id>.md',
    file === wx.env.USER_DATA_PATH + '/obsidian/' + exp.id + '.md', String(file));
  ok('mkdirSync 递归建目录', dirs.some((d) => d[0] === wx.env.USER_DATA_PATH + '/obsidian' && d[1] === true));
  ok('文件内容 = toMarkdown', files[file] === md);
  ok('不存在的卡片不导出', C.exportOne('nope') === null);

  console.log('\n--- 7. 页面逻辑冒烟（真实页面 JS） ---');
  const TODAY = C.todayStr();
  reset();
  const edit = loadPage('card-edit/card-edit.js');
  edit.onLoad({});
  ok('录入页默认 wrong 卡且正文六节', edit.data.type === 'wrong' && edit.data.sections.length === 6);
  edit.onInput({ currentTarget: { dataset: { f: 'title' } }, detail: { value: '冒烟错题' } });
  edit.onInput({ currentTarget: { dataset: { f: 'tagsText' } }, detail: { value: 'H2.3' } });
  edit.onInput({ currentTarget: { dataset: { f: 'migration' } }, detail: { value: '' } });
  modalConfirm = false;
  edit.onSave();
  ok('迁移规则为空时弹质量线提示，取消则不保存', C.load().length === 0, 'count=' + C.load().length);
  modalConfirm = true;
  edit.onSave();
  ok('强制保存成功且标注未完成', C.load().length === 1 && C.load()[0].incomplete === true);
  ok('强制保存后提示含 skill 质量线原文',
    edit.data.hint.indexOf('没有迁移规则的错题卡视为未完成') >= 0, edit.data.hint);
  edit.onExport();
  ok('页面导出显示沙盒路径并复制', /\/obsidian\//.test(edit.data.exportPath) && clips.indexOf(edit.data.exportPath) >= 0);
  const fresh = loadPage('card-edit/card-edit.js');
  fresh.onLoad({});
  fresh.pickType({ currentTarget: { dataset: { k: 'concept' } } });
  ok('切到 concept 只有五节骨架', fresh.data.type === 'concept' && fresh.data.sections.length === 5);
  fresh.onSave();
  ok('concept 卡无需迁移规则即可保存', C.load().length === 2 && C.load()[0].type === 'concept');

  const search = loadPage('card-search/card-search.js');
  search.onLoad();
  search.onInput({ currentTarget: { dataset: { f: 'tag' } }, detail: { value: 'H2.3' } });
  search.onSearch();
  ok('检索页能命中标签', search.data.total === 1 && search.data.rows[0].title === '冒烟错题');
  search.openCard({ currentTarget: { dataset: { id: search.data.rows[0].id } } });
  ok('点结果 navigateTo 到 card-edit',
    navs[navs.length - 1] === '/pages/card-edit/card-edit?id=' + search.data.rows[0].id);

  const shown = C.load().filter((c) => c.title === '冒烟错题')[0];
  shown.next_review = TODAY;
  C.save(C.load());
  const review = loadPage('review/review.js');
  review.onShow();
  ok('复习页只列今日到期', review.data.total === 1 && review.data.rows[0].id === shown.id);
  ok('复习页告诉用户建议用时自己调整', review.data.tip === '建议用时，自己调整');
  review.onDone({ currentTarget: { dataset: { id: shown.id, ok: 'yes' } } });
  const upgraded = C.load().filter((c) => c.id === shown.id)[0];
  ok('答对后从今日清单消失并升级',
    upgraded.level === 1 && upgraded.next_review === addDays(TODAY, 1) && review.data.total === 0,
    upgraded.level + '/' + upgraded.next_review);
  C.save(C.load().map((c) => Object.assign({}, c, { next_review: TODAY })));
  review.onShow();
  review.onDone({ currentTarget: { dataset: { id: shown.id, ok: 'no' } } });
  const failed = C.load().filter((c) => c.id === shown.id)[0];
  ok('答错后归零、当天重来', failed.level === 0 && failed.next_review === TODAY);

  const diag = loadPage('diagnose/diagnose.js');
  diag.onShow();
  ok('诊断页给出知识卡入口计数，不污染诊断总量', typeof diag.data.dueCount === 'number' && diag.data.total === 0);
  diag.goCardEdit(); diag.goCardSearch(); diag.goReview();
  ok('三个入口均走 navigateTo（未加 tab）',
    navs.slice(-3).join(',') === '/pages/card-edit/card-edit,/pages/card-search/card-search,/pages/review/review');

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('挂了:', e.stack); process.exit(1); });
