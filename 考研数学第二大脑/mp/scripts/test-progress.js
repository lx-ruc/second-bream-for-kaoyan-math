/**
 * 作答沉淀与分析回归：node scripts/test-progress.js
 *
 * 覆盖：流水时间倒序、四档 mastery 加权累计（非二值对错）、错题进入与连对2次移出、
 * 稳定 key（题干归一）、六维空数据、脏数据不崩、页面三视图冒烟。
 * harness 参照 test-cards.js：global.wx 先设，再 require 页面模块。
 */
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
};
const noThrow = (name, fn) => {
  try { fn(); ok(name, true); } catch (e) { ok(name, false, e.message); }
};

/* ---------------- wx mock ---------------- */
const storage = {};
const wx = {
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  showToast: () => {},
  switchTab: () => {},
  navigateTo: () => {},
  showModal: () => {},
  getFileSystemManager: () => ({ mkdirSync: () => {}, writeFileSync: () => {} }),
  env: { USER_DATA_PATH: '/tmp/ekb-progress-test' },
  getWindowInfo: () => ({ pixelRatio: 2 }),
  createSelectorQuery: () => ({
    select: () => ({ fields: () => ({ exec: () => {} }) }),
  }),
};
global.wx = wx;
global.App = (cfg) => cfg;

const P = require(path.resolve(__dirname, '..', 'utils', 'progress.js'));

function rec(o) {
  return Object.assign({
    id: 'r' + Math.random().toString(36).slice(2),
    ts: 1700000000000,
    kp: 'Ktest',
    vol: '1',
    kpName: '测试考点',
    stem: '默认题干：求极限',
    mastery: 1,
    levelLabel: '独立做出',
    fam: 1,
    famText: '洛必达法则',
    kind: 'ok-hot',
    title: '族内高频',
  }, o);
}

console.log('作答沉淀 / progress.js');

/* 1. 流水按时间倒序 + 字段齐全 */
(function () {
  const f = P.flow([
    rec({ id: 'a', ts: 1000, mastery: 0.2 }),
    rec({ id: 'b', ts: 3000, mastery: 1 }),
    rec({ id: 'c', ts: 2000, mastery: 0.6 }),
  ]);
  ok('流水按时间倒序', f[0].id === 'b' && f[1].id === 'c' && f[2].id === 'a',
    f.map((x) => x.id).join(','));
  ok('流水保留题干/掌握度/思路族/判定',
    f[0].stem && f[0].mastery === 1 && f[0].famText === '洛必达法则' && !!f[0].kind && !!f[0].ts);
})();

/* 2. 四档得分累计，不是二值对错 */
(function () {
  const s = P.score([
    rec({ mastery: 1 }), rec({ mastery: 0.6 }),
    rec({ mastery: 0.2 }), rec({ mastery: 0 }),
  ]);
  ok('四档加权总分 = 1.8', s.total === 1.8, 'total=' + s.total);
  ok('得分按 4 条有效记录计', s.count === 4, 'count=' + s.count);
  ok('四档分布各 1 条',
    s.byMastery['1'].n === 1 && s.byMastery['0.6'].n === 1 &&
    s.byMastery['0.2'].n === 1 && s.byMastery['0'].n === 1);
  ok('无效 mastery 不进分母', P.score([rec({ mastery: '1' }), rec({ mastery: NaN })]).count === 0);
})();

/* 3. 稳定 key：题干归一后哈希 */
(function () {
  const a = P.stableKey({ stem: '求 lim (x→0) sin x / x' });
  const b = P.stableKey({ stem: '求 lim（x→0）sinx/x。' });
  ok('同题不同空格/标点归一后 key 相同', !!a && a === b, a + ' / ' + b);
  ok('不同题 key 不同', P.stableKey({ stem: '题甲' }) !== P.stableKey({ stem: '题乙' }));
  ok('无题干退到图片名', P.stableKey({ img: 'a.png' }) !== P.stableKey({ img: 'b.png' }));
})();

/* 4. 错题进入 + 连对 2 次移出 */
(function () {
  const base = { stem: '同一道题：求级数收敛性', kp: 'K1', kpName: '级数', vol: '2' };
  const rs = [
    rec(Object.assign({}, base, { id: 'w1', ts: 1000, mastery: 0.2 })),
    rec(Object.assign({}, base, { id: 'w2', ts: 2000, mastery: 0.6 })),
    rec(Object.assign({}, base, { id: 'w3', ts: 3000, mastery: 1 })),
  ];
  let w = P.wrongBook(rs);
  ok('曾经低于 1.0 的题进错题池', w.length === 1, 'len=' + w.length);
  ok('错题元数据齐全', w.length === 1 && w[0].kp === 'K1' && w[0].kpName === '级数' &&
    w[0].vol === '2' && w[0].attempts === 3 && w[0].min === 0.2 && w[0].max === 1 && w[0].lastTs === 3000);
  ok('只做对过一次的题不进池',
    P.wrongBook([rec({ id: 'only', stem: '一直做对', ts: 100, mastery: 1 })]).length === 0);
  ok('只错过一次也在池',
    P.wrongBook([rec({ id: 'one', stem: '只错过一次', ts: 100, mastery: 0.2 })]).length === 1);

  // 再来一次「独立做出」→ 最后连续两条 1.0，移出
  rs.push(rec(Object.assign({}, base, { id: 'w4', ts: 4000, mastery: 1 })));
  w = P.wrongBook(rs);
  ok('连续 2 次独立做出自动移出', w.length === 0, 'len=' + w.length);

  // 中间夹一次回落，不算连对
  const rs2 = [
    rec(Object.assign({}, base, { id: 'm1', ts: 1000, mastery: 1 })),
    rec(Object.assign({}, base, { id: 'm2', ts: 2000, mastery: 0.2 })),
    rec(Object.assign({}, base, { id: 'm3', ts: 3000, mastery: 1 })),
  ];
  ok('1.0→0.2→1.0 仍留池（非连续）', P.wrongBook(rs2).length === 1);
})();

/* 5. 六维空数据 */
(function () {
  const ab = P.ability([]);
  ok('六维返回 6 项', ab.length === 6);
  ok('空数据全为 0 且 base=0', ab.every((x) => x.value === 0 && x.base === 0));
  ok('每维有名称/口径/样本量', ab.every((x) => x.key && x.name && x.desc && typeof x.base === 'number'));
})();

/* 6. 六维有数据时的口径 */
(function () {
  const ab = P.ability([
    rec({ id: 'p1', stem: '独立题', mastery: 1, kp: 'K1' }),
    rec({ id: 'p2', stem: '提示题', mastery: 0.6, kp: 'K2' }),
    rec({ id: 'p3', stem: '看答案题', mastery: 0.2, kp: 'K1' }),
  ]);
  const get = (k) => ab.filter((x) => x.key === k)[0];
  ok('平均掌握度 = 60', get('avg').value === 60, 'avg=' + get('avg').value);
  ok('独立做出率 = 33', get('solo').value === 33, 'solo=' + get('solo').value);
  ok('近期掌握有样本', get('recent').base === 3);
  ok('覆盖广度按去重考点计', get('cover').base === 2, 'base=' + get('cover').base);
  ok('所有 value 落在 0-100', ab.every((x) => x.value >= 0 && x.value <= 100));
  // 纠错提升：同一题 0.2 → 1.0
  const gain = P.ability([
    rec({ id: 'g1', stem: '纠错题', ts: 1000, mastery: 0.2 }),
    rec({ id: 'g2', stem: '纠错题', ts: 2000, mastery: 1 }),
  ]).filter((x) => x.key === 'gain')[0];
  ok('纠错提升识别从低到 1.0', gain.value === 100 && gain.base === 1, 'gain=' + gain.value + '/' + gain.base);
})();

/* 7. 脏数据不崩 */
(function () {
  const dirty = [
    undefined, null, 0, 'x', {},
    { mastery: '1.0' }, { mastery: 2 }, { mastery: -1 }, { mastery: NaN },
    { stem: '有题干没时间', ts: 'bad', kp: undefined, kpName: null },
  ];
  noThrow('flow 吃脏数据不崩', () => P.flow(dirty));
  noThrow('score 吃脏数据不崩', () => P.score(dirty));
  noThrow('wrongBook 吃脏数据不崩', () => P.wrongBook(dirty));
  noThrow('ability 吃脏数据不崩', () => P.ability(dirty));
  noThrow('非数组入参不崩', () => {
    P.flow(null); P.score(undefined); P.wrongBook('bad'); P.ability(123);
  });
  noThrow('stableKey 吃 undefined 不崩', () => P.stableKey(undefined));
})();

/* 8. 页面三视图冒烟（真实页面 JS + mock 存储） */
(function () {
  let page = null;
  global.Page = (cfg) => { page = cfg; };
  const mod = path.resolve(__dirname, '..', 'pages', 'progress', 'progress.js');
  delete require.cache[require.resolve(mod)];
  require(mod);
  page.setData = function (patch, cb) { Object.assign(this.data, patch); if (cb) cb(); };
  noThrow('页面 onShow 刷新不崩', () => page.onShow());
  ok('页面刷新后三视图数据就绪',
    Array.isArray(page.data.flow) && page.data.score && Array.isArray(page.data.wrong) &&
    Array.isArray(page.data.ability) && page.data.radarLabels.length === 6);
  page.onTab({ currentTarget: { dataset: { tab: 'wrong' } } });
  ok('切到错题视图', page.data.tab === 'wrong');
  noThrow('切到能力视图（canvas 节点 mock）不崩',
    () => page.onTab({ currentTarget: { dataset: { tab: 'ability' } } }));
  ok('切到能力视图成功', page.data.tab === 'ability');
})();

/* 9. 诊断页入口：navigateTo，不加 tab */
(function () {
  const navs = [];
  const oldNavigate = wx.navigateTo;
  wx.navigateTo = (o) => { navs.push(o.url); };
  let dg = null;
  global.Page = (cfg) => { dg = cfg; };
  const mod = path.resolve(__dirname, '..', 'pages', 'diagnose', 'diagnose.js');
  delete require.cache[require.resolve(mod)];
  noThrow('诊断页模块加载不崩', () => require(mod));
  if (dg) {
    noThrow('诊断页 goProgress 不崩', () => dg.goProgress());
    ok('入口走 navigateTo /pages/progress/progress，不加 tab',
      navs.length === 1 && navs[0] === '/pages/progress/progress', navs.join(','));
  }
  wx.navigateTo = oldNavigate;
})();

console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
