/**
 * 页面逻辑端到端（Node 内跑真实页面 JS，wx 全 mock）。
 * 跑法：node scripts/test-flow.js
 *
 * 与 test-e2e.js 的分工：那个要开发者工具且 App 域被登录墙挡着；
 * 这个不依赖 IDE，直接驱动 pages/intake 的真实方法把录题闭环走完，
 * 存进 mock storage，再用 pages/diagnose 读回来验证。
 * 覆盖：考点加载 → 思路族 → 掌握度 → 判定分档 → 存库字段 → 诊断聚合。
 */
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
};

/* ---------------- wx mock ---------------- */
const storage = {};
const wx = {
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: () => {},
  showModal: () => {},
  switchTab: () => {},
  previewImage: () => {},
  setClipboardData: () => {},
  getFileSystemManager: () => ({ readdirSync: () => [], unlinkSync: () => {}, accessSync: () => {}, mkdirSync: () => {}, copyFileSync: () => {}, statSync: () => ({ size: 0 }), readFile: () => {} }),
  env: { USER_DATA_PATH: '/tmp' },
};

/* ---------------- Page/App harness ---------------- */
function loadPage(rel) {
  let page = null;
  global.Page = (cfg) => { page = cfg; };
  global.App = (cfg) => cfg;
  global.wx = wx;
  global.getCurrentPages = () => [];
  // 干净的模块缓存：每个页面独立 require 一份
  const real = path.resolve(__dirname, '..', 'pages', rel);
  const moduleKey = path.resolve(real);
  delete require.cache[require.resolve(moduleKey)];
  require(moduleKey);
  // 运行时注入：setData 直接并进 data（浅合并够用）
  page.setData = function (patch) { Object.assign(this.data, patch); };
  return page;
}

(async function main() {
  console.log('--- 1. 录题闭环（真实 intake 页面逻辑）---');
  const intake = loadPage('intake/intake.js');
  intake.onLoad();
  ok('onLoad 后有考点候选列表', intake.data.pickerNames.length > 50, 'got ' + intake.data.pickerNames.length);

  // 粘一道库里的真题原文 → 匹配
  const STEM = require(path.resolve(__dirname, '..', 'data', 'stem.js'));
  const firstKey = Object.keys(STEM)[0];
  const kpId = firstKey.split('|')[0];
  const stemText = STEM[firstKey][0].s;
  intake.setData({ text: stemText });
  intake.rematch();
  ok('matchStem 给出候选', intake.data.cands.length > 0);
  const orig = intake.data.original;
  ok('findOriginal 认出原题', !!orig && orig.kp === kpId, orig ? 'sim=' + orig.sim : 'null');
  ok('原题命中后题干用库内原文', orig && orig.stem === stemText);

  // 用原题 → 自动预选考点
  intake.useOriginal();
  ok('useOriginal 选中原题考点', intake.data.kpId === kpId);

  // 选思路族 1 + 掌握度「看答案才懂」
  const fams = intake.data.fams;
  if (fams.length) {
    intake.pickFam({ currentTarget: { dataset: { n: 1 } } });
    intake.pickLevel({ currentTarget: { dataset: { i: 2 } } });
    ok('出判定卡', !!intake.data.verdict);
    ok('判定是贴合类（ok-*）', /^ok-/.test(intake.data.verdict.kind), intake.data.verdict.kind);
  } else {
    intake.pickLevel({ currentTarget: { dataset: { i: 2 } } });
    ok('无精讲考点出 nodata 判定', intake.data.verdict.kind === 'nodata', intake.data.verdict.kind);
  }

  // 存库
  intake.save();
  ok('saved 置位', intake.data.saved === true);
  const records = storage['ekb.records.v1'];
  ok('记录已入 storage', Array.isArray(records) && records.length === 1);
  const rec = records[0];
  ok('题干存的是原题原文', rec.stem === stemText);
  ok('掌握度记为 0.2（看答案）', rec.mastery === 0.2);
  ok('来源记为 photo/text', rec.src === 'text' || rec.src === 'photo', rec.src);

  console.log('\n--- 2. 族外解法路径 ---');
  intake.reset();
  intake.setData({ text: stemText });
  intake.rematch();
  intake.useOriginal();
  if (intake.data.fams.length) {
    intake.pickNone(); // 「都不是」= 族外
    intake.pickLevel({ currentTarget: { dataset: { i: 3 } } }); // 还是不会
    ok('族外判定 off-method', intake.data.verdict.kind === 'off-method', intake.data.verdict.kind);
    intake.save();
    const recs2 = storage['ekb.records.v1'];
    ok('第二条已存，kind=off-method', recs2.length === 2 && recs2[0].kind === 'off-method');
  } else {
    console.log('  - 该考点无思路族，跳过族外路径');
  }

  console.log('\n--- 3. 诊断回读（真实 diagnose 页面 + 引擎聚合）---');
  const E = require(path.resolve(__dirname, '..', 'utils', 'engine.js'));
  const S = require(path.resolve(__dirname, '..', 'utils', 'store.js'));
  const all = S.load();
  const d = E.diagnose(all);
  ok('诊断总量 = 记录数', d.total === all.length, d.total + ' vs ' + all.length);
  ok('offCount 统计到族外', d.offCount === (intake.data.fams && intake.data.fams.length ? 1 : 0), 'off=' + d.offCount);
  ok('优先级行存在', d.rows.length >= 1);
  const topRow = d.rows[0];
  ok('优先级行字段齐', ['kp', 'name', 'n', 'n6', 'mastery', 'prio'].every(k => topRow[k] !== undefined));
  ok('族外解法占比能算', typeof d.avg === 'number' && d.avg >= 0 && d.avg <= 1);

  // 遗留脏记录（考点树换版）不炸诊断
  storage['ekb.records.v1'] = all.concat([{ id: 'x', ts: Date.now(), kp: 'K_GONE', vol: '1', mastery: 0, famText: '洛必达法则' }]);
  const d2 = E.diagnose(storage['ekb.records.v1']);
  ok('遗留脏考点不崩溃', d2.rows.length === d.rows.length + 1, d2.rows.length + ' vs ' + (d.rows.length + 1));

  // 删记录
  S.remove(records[0].id);
  ok('删除后少一条', S.load().length === records.length);

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('挂了:', e.stack); process.exit(1); });
