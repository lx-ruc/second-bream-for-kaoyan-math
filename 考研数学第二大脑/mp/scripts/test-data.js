/**
 * 数据模块完整性回归。跑法：node scripts/test-data.js
 *
 * 为什么要有这个：WXML 的 wx:key 取值唯一性是数据决定的，静态校验看不见。
 * 真踩过的坑——同一考点同年出两道题（map 页 wx:key="y" 撞了 83 处）、
 * 考频表有重名考点（prior 页 wx:key="name" 撞了 1 处）。撞 key 在真机上
 * 的表现是列表渲染错位或 console 警告，很难从代码看出来。
 */
const KP = require('../data/kp.js').nodes;
const STEM = require('../data/stem.js');
const PRIOR = require('../data/prior.js');

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

console.log('--- 4. 考频表 ---');
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

console.log('\n结果: ' + (fail ? fail + ' 个问题' : '全部通过'));
process.exit(fail ? 1 : 0);
