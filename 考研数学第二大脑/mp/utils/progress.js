/**
 * 作答沉淀与分析 · 纯逻辑层
 *
 * 数据源唯一：ekb.records.v1（拍照/粘贴沉淀的题目 + 四档掌握度）。
 * 边界（与本项目既定口径一致，改动前先读这里）：
 *  1. 掌握度只有四档行为事实 mastery = 1.0 / 0.6 / 0.2 / 0.0，绝不二值化「对错」；
 *     不采自评、不引入星标打分。
 *  2. 本模块只统计用户自己记录过的题；没记 ≠ 没掌握。数据分不出高下就并列，不假装分得出。
 *  3. 重要性只由真题统计（engine.heat 的 n6）得出；本模块不输出「该考点重要 / 该做」这类结论。
 *  4. 两套语料不互校：不引入选择题库、不引入相似度校准，只复用本项目 engine 的
 *     normText 思路与近六年真题计数。
 *  5. 尽量不碰 wx，便于 Node 直接单测。
 */
const E = require('./engine.js');

/* ---------------- 常量 ---------------- */

const MASTER_LEVELS = [
  { v: 1.0, k: 'solo', label: '独立做出' },
  { v: 0.6, k: 'hint', label: '提示后做出' },
  { v: 0.2, k: 'read', label: '看答案才懂' },
  { v: 0.0, k: 'none', label: '还是不会' },
];

const RECENT_N = 10;   // 「近期掌握」取最近 N 条
const WIN_N = 2;       // 连续 WIN_N 次独立做出才把题移出错题池

const ABILITY_NOTE = '六维只反映你记录过的题，没记 ≠ 没掌握；全部来自四档行为事实（1.0/0.6/0.2/0.0），不含自评，也不判断「该考点重要 / 该做」。样本少的维度只是描述，不代表能力高低。';

// 与 engine.normText 同一套归一思路：上下标还原、去空格标点、转小写；
// 额外把半角括号一并归一（OCR 里全角/半角常混用，同一题不能被拆成两道）。
const SCRIPT_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉ₙᵢⱼₖ]/g;
const SCRIPT_REV = (() => {
  const m = {};
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ';
  const supV = '0123456789+-=()ni';
  const sub = '₀₁₂₃₄₅₆₇₈₉ₙᵢⱼₖ';
  const subV = '0123456789nijk';
  for (let i = 0; i < sup.length; i++) m[sup.charAt(i)] = supV.charAt(i);
  for (let i = 0; i < sub.length; i++) m[sub.charAt(i)] = subV.charAt(i);
  return m;
})();

/* ---------------- 小工具（脏数据兜底） ---------------- */

function normText(s) {
  return (s === undefined || s === null ? '' : String(s))
    .replace(SCRIPT_RE, function (c) { return SCRIPT_REV[c] || c; })
    .replace(/[\^_]/g, '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[，。、；：？！“”‘’（）【】《》「」(),.;:?!"'`]/g, '')
    .toLowerCase();
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function validMastery(r) {
  const raw = r && r.mastery;
  // 只认 0~1 的数字：字符串 / NaN / 越界值视作「本条没有掌握度」，不参与统计分母。
  if (typeof raw !== 'number' || !isFinite(raw) || raw < 0 || raw > 1) return null;
  return raw;
}

function tsOf(r) {
  const t = Number(r && r.ts);
  return isFinite(t) && t > 0 ? t : 0;
}

function cleanList(records) {
  return Array.isArray(records)
    ? records.filter(function (r) { return !!r && typeof r === 'object'; })
    : [];
}

function pct(x) {
  if (!isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function round2(x) { return Math.round(x * 100) / 100; }

function levelOf(m) {
  for (let i = 0; i < MASTER_LEVELS.length; i++) {
    if (MASTER_LEVELS[i].v === m) return MASTER_LEVELS[i];
  }
  return null;
}

/**
 * 同一题的稳定 key。
 * 拍照题没有 questionId：有题干（原题 stem 或识别文本）就归一后取哈希；
 * 题干缺失时退到图片名 / 记录 id，避免所有空题被聚成同一道。
 */
function stableKey(rec) {
  const r = rec && typeof rec === 'object' ? rec : {};
  const stem = normText(r.stem || r.text);
  if (stem) return 'q:' + hash(stem);
  if (r.img) return 'i:' + hash(normText(String(r.img)));
  return 'r:' + String(r.id === undefined || r.id === null ? '' : r.id);
}

/* ---------------- 1. 作答流水 ---------------- */

/** 按时间倒序的作答流水；每条带题干、四档掌握度、思路族、时间、判定。 */
function flow(records) {
  return cleanList(records)
    .slice()
    .sort(function (a, b) { return tsOf(b) - tsOf(a); })
    .map(function (r, i) {
      const m = validMastery(r);
      const lv = levelOf(m);
      return {
        id: r.id === undefined || r.id === null ? 'f' + i : String(r.id),
        key: stableKey(r),
        stem: String(r.stem || r.text || '').slice(0, 200),
        kp: r.kp === undefined || r.kp === null ? '' : String(r.kp),
        kpName: String(r.kpName || ''),
        vol: r.vol === undefined || r.vol === null ? '' : String(r.vol),
        mastery: m,
        levelLabel: lv ? lv.label : '未记录掌握度',
        fam: typeof r.fam === 'number' ? r.fam : 0,
        famText: String(r.famText || ''),
        kind: r.kind === undefined || r.kind === null ? 'unknown' : String(r.kind),
        title: String(r.title || ''),
        ts: tsOf(r),
        fromPhoto: r.src === 'photo' || !!r.img,
      };
    });
}

/* ---------------- 2. 四档得分累计 ---------------- */

/**
 * 得分 = 四档 mastery 加权累计（1.0 / 0.6 / 0.2 / 0.0），不是「对/错」计数。
 * 无效 mastery 的记录不计入分母，避免把脏数据当成「还是不会」。
 */
function score(records) {
  const byMastery = {};
  MASTER_LEVELS.forEach(function (lv) {
    byMastery[String(lv.v)] = { n: 0, label: lv.label, points: lv.v };
  });
  let total = 0, count = 0;
  cleanList(records).forEach(function (r) {
    const m = validMastery(r);
    if (m === null) return;
    count++;
    total += m;
    const k = String(m);
    if (!byMastery[k]) byMastery[k] = { n: 0, label: '其他', points: m };
    byMastery[k].n++;
  });
  const levels = MASTER_LEVELS.map(function (lv) {
    const cell = byMastery[String(lv.v)];
    return { key: String(lv.v), label: lv.label, points: lv.v, n: cell.n };
  });
  return { total: round2(total), count: count, byMastery: byMastery, levels: levels };
}

/* ---------------- 3. 错题本（连对 2 次移出） ---------------- */

/**
 * 同一题按 stableKey 归并，按时间升序看最后两次：
 *  - 从没低于 1.0 的题不进池（它就没错过）；
 *  - 最后连续 WIN_N 次 mastery=1.0（独立做出）→ 自动移出；
 *  - 否则留在池，元数据带 kp / kpName / vol / 最近掌握度 / 次数 / 最近时间。
 */
function wrongBook(records) {
  const groups = {};
  // flow 已按时间倒序，反转即升序
  flow(records).slice().reverse().forEach(function (f) {
    if (!groups[f.key]) groups[f.key] = [];
    groups[f.key].push(f);
  });

  const out = [];
  Object.keys(groups).forEach(function (key) {
    const g = groups[key];
    const ms = g.map(function (x) { return x.mastery; }).filter(function (x) { return x !== null; });
    if (!ms.some(function (x) { return x < 1; })) return; // 从未低于独立做出，不是错题
    const last = g[g.length - 1];
    const prev = g[g.length - 2];
    if (prev && last && prev.mastery === 1 && last.mastery === 1) return; // 连对移出
    out.push({
      key: key,
      stem: last.stem,
      kp: last.kp,
      kpName: last.kpName,
      vol: last.vol,
      mastery: last.mastery,
      levelLabel: last.levelLabel,
      attempts: g.length,
      min: ms.length ? Math.min.apply(null, ms) : null,
      max: ms.length ? Math.max.apply(null, ms) : null,
      lastTs: last.ts,
    });
  });
  return out.sort(function (a, b) { return b.lastTs - a.lastTs; });
}

/* ---------------- 4. 六维能力 ---------------- */

function groupsByKey(records) {
  const groups = {};
  flow(records).slice().reverse().forEach(function (f) {
    if (!groups[f.key]) groups[f.key] = [];
    groups[f.key].push(f); // 按时间升序
  });
  return groups;
}

/** 该记录所在考点是否在近六年（2021-2026）真题里考过；真题统计只由 engine 给出。 */
function isRecentExamKp(r) {
  const node = E.KP_BY_ID && E.KP_BY_ID[r.kp];
  if (!node || !Array.isArray(node.qs)) return false;
  try { return E.heat(node, r.vol).n6 > 0; } catch (e) { return false; }
}

function mean(vals) {
  if (!vals.length) return 0;
  let s = 0;
  vals.forEach(function (v) { s += v; });
  return s / vals.length;
}

/**
 * 六维口径（每维 0-100，value 是展示值，base 是样本量）：
 *  1. 独立做出率：mastery=1.0 的条数 / 有效记录条数
 *  2. 平均掌握度：四档 mastery 均值 × 100
 *  3. 高频考点掌握：近六年真题考点上记录的 mastery 均值 × 100（考点是否「高频」只由真题统计给出）
 *  4. 近期掌握：最近 RECENT_N 条记录的 mastery 均值 × 100
 *  5. 覆盖广度：记过的去重考点数 / 全部考点数（真题树的考点总数）
 *  6. 纠错提升：曾低于 1.0 的题里，之后做到 1.0 的比例 × 100
 * 空数据时全部为 0，并且 base=0 —— 0 表示「没有记录」，不表示掌握差。
 */
function ability(records) {
  const list = cleanList(records);
  const valid = list.filter(function (r) { return validMastery(r) !== null; });
  const ms = valid.map(validMastery);
  const groups = groupsByKey(records);

  // 独立做出率 + 平均掌握度
  const soloN = ms.filter(function (m) { return m === 1; }).length;
  const soloVal = ms.length ? pct(soloN / ms.length * 100) : 0;
  const avgVal = ms.length ? pct(mean(ms) * 100) : 0;

  // 高频考点掌握（近六年真题考点）
  const hotMs = valid.filter(isRecentExamKp).map(validMastery);
  const hotVal = hotMs.length ? pct(mean(hotMs) * 100) : 0;

  // 近期掌握：flow 已按时间倒序
  const recentMs = flow(records).slice(0, RECENT_N)
    .map(function (f) { return f.mastery; }).filter(function (m) { return m !== null; });
  const recentVal = recentMs.length ? pct(mean(recentMs) * 100) : 0;

  // 覆盖广度：去重考点数 / 全考点库（真题树）总数
  const kps = {};
  valid.forEach(function (r) { if (r.kp !== undefined && r.kp !== null && r.kp !== '') kps[String(r.kp)] = 1; });
  const kpCount = Object.keys(kps).length;
  const allKp = E.NODES && Array.isArray(E.NODES) ? E.NODES.length : 0;
  const coverVal = allKp > 0 ? pct(kpCount / allKp * 100) : 0;

  // 纠错提升：同一题按时间升序，首次低于 1.0 之后是否出现过 1.0
  let everLow = 0, improved = 0;
  Object.keys(groups).forEach(function (key) {
    const seq = groups[key].map(function (x) { return x.mastery; })
      .filter(function (m) { return m !== null; });
    let firstLow = -1;
    for (let i = 0; i < seq.length; i++) { if (seq[i] < 1) { firstLow = i; break; } }
    if (firstLow < 0) return;
    everLow++;
    for (let i = firstLow + 1; i < seq.length; i++) {
      if (seq[i] === 1) { improved++; break; }
    }
  });
  const gainVal = everLow ? pct(improved / everLow * 100) : 0;

  return [
    { key: 'solo', name: '独立做出率', value: soloVal, base: ms.length,
      desc: '「独立做出」（mastery=1.0）条数 ÷ 有效记录条数。' },
    { key: 'avg', name: '平均掌握度', value: avgVal, base: ms.length,
      desc: '四档 mastery（1.0/0.6/0.2/0.0）的均值 × 100。' },
    { key: 'hot', name: '高频考点掌握', value: hotVal, base: hotMs.length,
      desc: '近六年（2021-2026）真题考过的考点上，你记录的 mastery 均值；考点是否考过只由真题统计给出。' },
    { key: 'recent', name: '近期掌握', value: recentVal, base: recentMs.length,
      desc: '最近 ' + RECENT_N + ' 条记录的 mastery 均值 × 100。' },
    { key: 'cover', name: '覆盖广度', value: coverVal, base: kpCount,
      desc: '记过的去重考点数 ÷ 全部考点数（真题树 ' + allKp + ' 个）。广，不等于掌握好。' },
    { key: 'gain', name: '纠错提升', value: gainVal, base: everLow,
      desc: '曾低于 1.0 的题里，之后做到「独立做出」的比例；按同一题的时间顺序算。' },
  ];
}

module.exports = {
  MASTER_LEVELS: MASTER_LEVELS,
  ABILITY_NOTE: ABILITY_NOTE,
  RECENT_N: RECENT_N,
  WIN_N: WIN_N,
  stableKey: stableKey,
  flow: flow,
  score: score,
  wrongBook: wrongBook,
  ability: ability,
};
