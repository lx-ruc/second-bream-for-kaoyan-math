/**
 * 数据模块完整性回归。跑法：node scripts/test-data.js
 *
 * 为什么要有这个：WXML 的 wx:key 取值唯一性是数据决定的，静态校验看不见。
 * 真踩过的坑——同一考点同年出两道题（map 页 wx:key="y" 撞了 83 处）、
 * 考频表有重名考点（prior 页 wx:key="name" 撞了 1 处）。撞 key 在真机上
 * 的表现是列表渲染错位或 console 警告，很难从代码看出来。
 *
 * 另含考频页排序数据 kpPrior 的完整性：92 条、同分并列、名次跳号、
 * 三卷 scope、分项字段——这些是「数据分不出高下不许假装分得出」的防线。
 */
const KP = require('../data/kp.js').nodes;
const STEM = require('../data/stem.js');
const PRIOR = require('../data/prior.js');
const QBANK = require('../packageExam/data/qbank.js');

let fail = 0;
const bad = (msg) => { fail++; console.log('  ✗ ' + msg); };
const good = (msg) => console.log('  ✓ ' + msg);

console.log('--- 1. 考点树结构 ---');
let nBad = 0;
const seen = {};
KP.forEach(function (n) {
  if (seen[n.id]) { bad('考点 ID 重复: ' + n.id); nBad++; }
  seen[n.id] = 1;
  if (!n.name || !n.scope || !n.qs || !n.qs.length) { bad(n.id + ' 基础字段缺失'); nBad++; }
  n.scope.split('').forEach(function (v) {
    if (!n.chap[v]) { bad(n.id + ' 缺 chap[' + v + ']'); nBad++; }
    if (n.jj[v] && !n.jj[v].u) { bad(n.id + ' jj[' + v + '] 缺 .u'); nBad++; }
    if (n.fam[v]) {
      (n.fam[v] || []).forEach(function (f, i) {
        if (f.n !== i + 1) { bad(n.id + ' fam[' + v + '] 编号不连续'); nBad++; }
        if (!f.t || f.t.length < 4) { bad(n.id + ' fam[' + v + '] 文本过短'); nBad++; }
      });
    }
  });
});
if (!nBad) good(KP.length + ' 个考点结构完整');

console.log('--- 2. 坐标唯一性（wx:key 的数据基础）---');
let dupQ = 0;
KP.forEach(function (n) {
  ['1', '2', '3'].forEach(function (v) {
    const seen = {};
    n.qs.forEach(function (q) {
      if (q[0] !== v) return;
      const k = q[1] + '-' + q[2];
      if (seen[k]) { bad(n.id + ' 同卷同年同题号重复: ' + k); dupQ++; }
      seen[k] = 1;
    });
  });
});
if (!dupQ) good('每条坐标（卷|年|题号）唯一 → map 页 key 唯一');

console.log('--- 3. 题干语料 ---');
let sBad = 0;
const byId = {};
KP.forEach(function (n) { byId[n.id] = 1; });
Object.keys(STEM).forEach(function (k) {
  const parts = k.split('|');
  if (parts.length !== 2 || !byId[parts[0]]) { bad('stem key 指向不存在的考点: ' + k); sBad++; }
  STEM[k].forEach(function (q) {
    if (!q.y || !q.o || !q.s || q.s.length < 5) { bad(k + ' 题干字段异常'); sBad++; }
  });
});
const stemCount = Object.keys(STEM).reduce(function (a, k) { return a + STEM[k].length; }, 0);
if (!sBad) good(stemCount + ' 条题干全部挂在考点树上');

console.log('--- 4. 真题库（qbank 分包）---');
let qBad = 0;
const kpIds = {};
KP.forEach(function (n) { kpIds[n.id] = 1; });
const stemCoords = {};
Object.keys(STEM).forEach(function (k) {
  const vol = k.split('|')[1];
  STEM[k].forEach(function (q) { stemCoords[vol + '|' + q.y + '|' + q.o] = 1; });
});
const qCoords = {};
Object.keys(QBANK).forEach(function (k) {
  const q = QBANK[k];
  const m = k.match(/^([123])\|(20\d\d)\|(\d+)$/);
  if (!m) { bad('qbank key 格式异常: ' + k); qBad++; return; }
  qCoords[k] = 1;
  if (!q.s || q.s.length < 5) { bad('qbank 题干过短: ' + k); qBad++; }
  if (!q.sol || q.sol.length < 10) { bad('qbank 缺解析: ' + k); qBad++; }
  if (!q.kp || !kpIds[q.kp]) { bad('qbank.kp 指向不存在的考点: ' + k); qBad++; }
  if (!stemCoords[k]) { bad('qbank 坐标在 stem.js 里没有(主包匹配不到): ' + k); qBad++; }
});
Object.keys(stemCoords).forEach(function (k) {
  if (!qCoords[k]) { bad('stem 坐标在 qbank 里没有(详情页会落空): ' + k); qBad++; }
});
if (!qBad) good(Object.keys(QBANK).length + ' 题与主包题干坐标一一对应，解析全非空');

console.log('--- 5. 考频表 ---');
let pBad = 0;
const names = {};
PRIOR.forEach(function (r) {
  if (r.length < 6) { bad('prior 行缺字段: ' + r[2]); pBad++; }
  names[r[2]] = (names[r[2]] || 0) + 1;
});
const dups = Object.keys(names).filter(function (nm) { return names[nm] > 1; });
if (dups.length) {
  // 语料固有现象（数一/数三各一条同名），不是数据错误；prior 页 key 已带序号兜底
  console.log('  ! 考频考点重名（页面 key 已兜底）: ' + dups.join('、'));
}
if (!pBad) good(PRIOR.length + ' 行字段完整' + (dups.length ? '，含重名 ' + dups.length + ' 组' : ''));

console.log('--- 6. 92 考点排序数据（kpPrior，考频页单一视图用）---');
const KP_PRIOR = require('../data/kpPrior.js');
const KPL = KP_PRIOR.kp;
let kBad = 0;
const KCHK = (cond, msg) => { if (!cond) { bad(msg); kBad++; } };

KCHK(KPL.length === 92, 'kpPrior 应有 92 条，实际 ' + KPL.length);
const M = KP_PRIOR.meta || {};
KCHK(M.w_freq === 0.7 && M.w_diff === 0.3, 'kpPrior.meta 权重不符');
KCHK(M.years === 34 && M.n_scored === 92 && M.n_kp === 92, 'kpPrior.meta 年份/条数不符');

// 字段完整性 + id 唯一 + 必须挂在考点树上（wx:key 用 id）
const kpSeen = {};
let kFieldBad = 0;
KPL.forEach(function (r) {
  if (kpSeen[r.id]) { bad('kpPrior id 重复: ' + r.id); kFieldBad++; }
  kpSeen[r.id] = 1;
  if (!seen[r.id]) { bad('kpPrior id 不在考点树: ' + r.id); kFieldBad++; }
  ['name', 'scope', 'chap', 'F', 'D', 'S', 'rank', 'py', 'pn', 'hard', 'nrow'].forEach(function (f) {
    if (r[f] === undefined || r[f] === null || r[f] === '') {
      bad('kpPrior 缺字段 ' + f + ': ' + r.id); kFieldBad++;
    }
  });
});
if (!kFieldBad) good(KPL.length + ' 条字段完整、id 唯一且都在考点树上');

// rank 非降且允许跳号；S 单调不增；同分⇔同 rank（competition ranking 充要条件）
let kRankBad = 0, kSBad = 0;
const byS = {}, rankByS = {}, sByRank = {};
KPL.forEach(function (r, i) {
  if (i && r.rank < KPL[i - 1].rank) { bad('rank 下降: ' + r.name); kRankBad++; }
  if (i && r.S > KPL[i - 1].S) { bad('S 上升: ' + r.name); kSBad++; }
  (byS[r.S] = byS[r.S] || []).push(r);
  if (rankByS[r.S] !== undefined && rankByS[r.S] !== r.rank) {
    bad('同分未并列: ' + r.name + ' S=' + r.S); kRankBad++;
  }
  rankByS[r.S] = r.rank;
  if (sByRank[r.rank] !== undefined && sByRank[r.rank] !== r.S) {
    bad('不同分同 rank: ' + r.name); kRankBad++;
  }
  sByRank[r.rank] = r.S;
});
const tieSs = Object.keys(byS).filter(function (s) { return byS[s].length > 1; });
// 跳号数必须正好等于并列「吃掉」的名次数，防止有人把并列硬拆成 1..92
const lost = KPL.length - Object.keys(sByRank).length;
const tieLost = tieSs.reduce(function (a, s) { return a + byS[s].length - 1; }, 0);
KCHK(lost === tieLost, '名次跳号数与并列 deficit 不符: ' + lost + ' vs ' + tieLost);
if (!kRankBad) good('rank 非降、允许并列与跳号；' + tieSs.length + ' 组同分全部并列（' +
  KPL.length + ' 条 / ' + Object.keys(sByRank).length + ' 个不同名次，跳号 ' + lost + '）');
if (!kSBad) good('S 单调不增');

// scope 覆盖三卷（评分数据本身没有 scope，由 build_mp_prior.py 从 kp.json 补）
const scopeCnt = { '1': 0, '2': 0, '3': 0 };
KPL.forEach(function (r) {
  r.scope.forEach(function (v) { if (scopeCnt[v] !== undefined) scopeCnt[v]++; });
});
KCHK(scopeCnt['1'] > 0 && scopeCnt['2'] > 0 && scopeCnt['3'] > 0,
  'scope 未覆盖三卷: ' + JSON.stringify(scopeCnt));
if (!kBad) good('scope 覆盖三卷: 数一 ' + scopeCnt['1'] + ' / 数二 ' + scopeCnt['2'] + ' / 数三 ' + scopeCnt['3']);

console.log('--- 7. 排序视图引擎（priorKpRows）---');
const E = require('../utils/engine.js');
let eBad = 0;
['1', '2', '3'].forEach(function (v) {
  const list = E.priorKpRows(v, '');
  const expect = KPL.filter(function (r) { return r.scope.indexOf(v) >= 0; }).length;
  if (list.length !== expect) { bad('priorKpRows(' + v + ') 条数 ' + list.length + ' ≠ ' + expect); eBad++; }
  list.forEach(function (r, i) {
    if (r.volRank !== i + 1) { bad('本卷序号不连续: ' + r.name); eBad++; }
    if (i && r.rank < list[i - 1].rank) { bad('卷内全局 rank 下降: ' + r.name); eBad++; }
    if (r.S === undefined || r.F === undefined || r.D === undefined || r.py === undefined) {
      bad('排序行缺分项: ' + r.name); eBad++;
    }
  });
});
if (!eBad) good('三卷过滤后均按全局 rank 升序、本卷序号 1..N 连续');

// 关键词过滤只隐藏行：留下来的行 rank / volRank 必须和不过滤时一致
const vol1 = E.priorKpRows('1', '');
const sub = E.priorKpRows('1', '微分方程');
let kfBad = 0;
sub.forEach(function (r) {
  const base = vol1.filter(function (x) { return x.id === r.id; })[0];
  if (!base || base.rank !== r.rank || base.volRank !== r.volRank) {
    bad('搜索改变了名次: ' + r.name); kfBad++;
  }
});
if (!kfBad) good('关键词过滤只隐藏行，不改变三卷名次与本卷序号');
if (!E.priorRows('极限').length) bad('旧 priorRows 回归失败（239 行表数据仍需保留）');
if (!kfBad && E.priorRows('极限').length) good('旧 priorRows 仍可用（回归断言未断）');

console.log('\n结果: ' + (fail ? fail + ' 个问题' : '全部通过'));
process.exit(fail ? 1 : 0);
