/**
 * 判定引擎：热度统计、题干匹配、纠偏判定、诊断聚合。
 * 全部跑在本地，不依赖网络和模型。
 */
const KP_DATA = require('../data/kp.js');
const STEM = require('../data/stem.js');
const PRIOR = require('../data/prior.js');

const NODES = KP_DATA.nodes;
const KP_BY_ID = {};
NODES.forEach(function (n) { KP_BY_ID[n.id] = n; });

const VOL_NAME = { '1': '数学一', '2': '数学二', '3': '数学三' };
const RECENT_FROM = 2021; // 近六年 = 2021-2026

// 拍照识别后反查原题的阈值。实测（475 道真题，模拟 12% 漏字 + 3% 乱码）：
// 命中自身的相似度中位 0.639、p05 0.489；错配到其它题的最高相似度 p95 只有 0.415。
// 取 0.55 → 召回 86%、误报 3%。宁可不认，也不能认错题。
const ORIGINAL_MIN = 0.55;

/* ---------------- 基础统计 ---------------- */

function inScope(node, vol) {
  return !!node && node.scope.indexOf(vol) >= 0;
}

function qsOf(node, vol) {
  return node.qs.filter(function (q) { return !vol || q[0] === vol; });
}

function heat(node, vol) {
  const qs = qsOf(node, vol);
  let n6 = 0;
  for (let i = 0; i < qs.length; i++) if (qs[i][1] >= RECENT_FROM) n6++;
  return { total: qs.length, n6: n6 };
}

function yearBars(node, vol) {
  const map = {};
  node.qs.forEach(function (q) {
    if (vol && q[0] !== vol) return;
    map[q[1]] = (map[q[1]] || 0) + 1;
  });
  const out = [];
  for (let y = 2009; y <= 2026; y++) out.push({ y: y, n: map[y] || 0, recent: y >= RECENT_FROM });
  return out;
}

function listByVol(vol) {
  return NODES.filter(function (n) { return inScope(n, vol); })
    .map(function (n) {
      const h = heat(n, vol);
      const fam = n.fam[vol] || [];
      return {
        id: n.id,
        name: n.name,
        total: h.total,
        n6: h.n6,
        fams: fam.length,
        jj: !!n.jj[vol],
        band: h.n6 >= 6 ? '热' : (h.n6 >= 3 ? '常' : (h.n6 >= 1 ? '冷' : '停')),
      };
    })
    .sort(function (a, b) { return b.n6 - a.n6 || b.total - a.total; });
}

/* ---------------- 题干相似度匹配 ---------------- */

/**
 * 归一化的两件事，都是为了「同一个人在说同一道题」能被算出来：
 *
 * 1) Unicode 上/下标 → ASCII。库内题干是 Unicode 形态（x²、P₁⁻¹），
 *    模型识别也可能给 LaTeX（x^{2}）或纯文本（x^2），不归一就永远对不上。
 * 2) 去掉 ^ _ 这两个标记。它们不是题目内容，留着只会放大形态差异
 *    （e^(xₙ) vs e^(xn) vs e^{x_n}）。抹掉标记后比的是实际字符。
 *
 * 库内数据实测：含 ^ 的 812 处、含 _ 的 1291 处，属于高频形态，不能不管。
 */
const SCRIPT_REV = (function () {
  const m = {};
  '⁰0 ¹1 ²2 ³3 ⁴4 ⁵5 ⁶6 ⁷7 ⁸8 ⁹9 ⁺+ ⁻- ⁼= ⁽( ⁾) ⁿn ⁱi ₀0 ₁1 ₂2 ₃3 ₄4 ₅5 ₆6 ₇7 ₈8 ₉9 ₙn ᵢi ⱼj ₖk'
    .split(' ').forEach(function (p) {
      if (p.length === 2) m[p.charAt(0)] = p.charAt(1);
    });
  return m;
})();
const SCRIPT_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉ₙᵢⱼₖ]/g;

function normText(s) {
  return (s || '')
    .replace(SCRIPT_RE, function (c) { return SCRIPT_REV[c] || c; })
    .replace(/[\^_]/g, '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[，。、；：？！“”‘’（）【】《》「」,.;:?!"'`]/g, '')
    .toLowerCase();
}

function grams(s, n) {
  n = n || 2;
  const t = normText(s);
  const set = {};
  for (let i = 0; i + n <= t.length; i++) set[t.substr(i, n)] = 1;
  return set;
}

let _idx = null;
function index() {
  if (_idx) return _idx;
  const arr = [];
  Object.keys(STEM).forEach(function (k) {
    const parts = k.split('|');
    const kp = parts[0], vol = parts[1];
    STEM[k].forEach(function (q) {
      const g = grams(q.s);
      const keys = Object.keys(g);
      if (keys.length >= 8) arr.push({ kp: kp, vol: vol, y: q.y, o: q.o, s: q.s, keys: keys, set: g });
    });
  });
  _idx = arr;
  return arr;
}

function jaccard(a, b) {
  let inter = 0;
  const small = a.keys.length < b.keys.length ? a : b;
  const big = small === a ? b : a;
  for (let i = 0; i < small.keys.length; i++) {
    if (big.set[small.keys[i]]) inter++;
  }
  return inter / (a.keys.length + b.keys.length - inter);
}

/**
 * 返回 top3 考点候选。
 * 相似度是真实算出来的，不调模型；但结果必须由用户确认。
 */
function matchStem(text) {
  const g = grams(text);
  const keys = Object.keys(g);
  if (keys.length < 6) return [];
  const probe = { keys: keys, set: g };
  const arr = index();
  const best = {};
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    const s = jaccard(probe, it);
    if (!best[it.kp] || s > best[it.kp].sim) {
      best[it.kp] = { kp: it.kp, sim: s, y: it.y, o: it.o, vol: it.vol };
    }
  }
  const list = Object.keys(best).map(function (k) { return best[k]; })
    .filter(function (x) { return x.sim > 0.08; })
    .sort(function (a, b) { return b.sim - a.sim; })
    .slice(0, 3);
  const top = list[0] ? list[0].sim : 0;
  const second = list[1] ? list[1].sim : 0;
  // 置信度：领先幅度比绝对相似度更能说明问题
  const conf = Math.min(1, top * 1.6 + (top - second) * 1.2);
  return list.map(function (x, i) {
    const n = KP_BY_ID[x.kp];
    return {
      kp: x.kp,
      name: n ? n.name : '',
      sim: Math.round(x.sim * 100),
      conf: i === 0 ? Math.round(conf * 100) : 0,
      sample: x.y + ' ' + VOL_NAME[x.vol] + ' 第' + x.o + '题',
    };
  });
}

/** 在题库里找最接近的一道题（无阈值）。findOriginal / practiceValue 共用。 */
function closestInBank(text, vol) {
  const g = grams(text);
  const keys = Object.keys(g);
  if (keys.length < 6) return null;
  const probe = { keys: keys, set: g };
  const arr = index();
  let best = null;
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    if (vol && it.vol !== vol) continue;
    const s = jaccard(probe, it);
    if (!best || s > best.sim) best = { it: it, sim: s };
  }
  if (!best) return null;
  const it = best.it;
  const n = KP_BY_ID[it.kp];
  return {
    kp: it.kp,
    kpName: n ? n.name : '',
    vol: it.vol,
    y: it.y,
    o: it.o,
    stem: it.s,
    sim: best.sim, // 0-1 原始值，调用方自己取整
    heat: n ? heat(n, it.vol) : { total: 0, n6: 0 },
    label: it.y + ' ' + VOL_NAME[it.vol] + ' 第' + it.o + '题',
  };
}

/**
 * 找「这道题就是库里的哪一道」。
 * 匹配不是满分：OCR 转写有噪音，所以阈值必须留出容错空间（实测见 README）。
 * 命中后用库里的标准题干替换识别结果——这是让拍照录入可用的关键一步。
 */
function findOriginal(text, vol) {
  const best = closestInBank(text, vol);
  if (!best || best.sim < ORIGINAL_MIN) return null;
  const out = {};
  for (const k in best) {
    if (k !== 'heat') out[k] = best[k];
  }
  out.sim = Math.round(best.sim * 100);
  return out;
}

/* ---------------- 刷题价值判定 ---------------- */

// 分带阈值用题库自身标定（2026-11-08，1224 题全量两两比对）：
//   同考点不同题 5873 对：p50 0.128 / p90 0.281 / p95 0.338，≥0.55 仅 0.5%（近乎原题的变式）
//   跨考点 14365 对：p95 0.139 / p99 0.226 —— 低于 0.23 与巧合分不开
// 判据只有相似度统计，没有模型观点——「值不值得刷」由真题库说了算。
const PRACTICE_EXAM = 0.55;   // 原题级（= ORIGINAL_MIN）
const PRACTICE_WORTH = 0.34;  // 同考点真题对的 p95：比 95% 的同考点不同题都更接近真题
const PRACTICE_EDGE = 0.23;   // 跨考点噪声 p99：再低就是对不上任何真题考法

/**
 * 刷题价值判定：这道题与真题库最接近到什么程度，值不值得投入。
 * 是 findOriginal 的无阈值版 + 分带解读，供录入前的「先纠偏后做题」。
 */
function practiceValue(text, vol) {
  const best = closestInBank(text, vol);
  if (!best) return null;
  const sim = Math.round(best.sim * 100);
  const h = best.heat;
  let band, title, desc;
  if (best.sim >= PRACTICE_EXAM) {
    band = 'exam';
    title = '真题级 · 值得精刷';
    desc = '与 ' + best.label + ' 相似度 ' + sim + '%，就是这道真题（或其轻微变式）。';
  } else if (best.sim >= PRACTICE_WORTH) {
    band = 'worth';
    title = '同考法 · 值得刷';
    desc = '最接近 ' + best.label + '（' + sim + '%）。这个接近程度超过 95% 的同考点真题对，考法在真题射程内。';
  } else if (best.sim >= PRACTICE_EDGE) {
    band = 'edge';
    title = '考法存疑 · 挑着做';
    desc = '最接近 ' + best.label + '（' + sim + '%）。考点沾边，但考法与真题有距离，做过对答案即可，别深究。';
  } else {
    band = 'skip';
    title = '真题不考 · 建议跳过';
    desc = '与全部真题最接近也只有 ' + sim + '%（低于跨考点噪声线）。近 18 年没这么考过，做它是在花时间。';
  }
  return {
    band: band, title: title, desc: desc, sim: sim,
    kp: best.kp, kpName: best.kpName, vol: best.vol, y: best.y, o: best.o,
    label: best.label, n6: h.n6, total: h.total,
  };
}

/* ---------------- 纠偏判定 ---------------- */
/**
 * @param {string} kpId
 * @param {string} vol
 * @param {number|null} famN  选中的思路族编号；0 表示「都不是」（族外解法）；null 表示还没选
 */
function judge(kpId, vol, famN) {
  const node = KP_BY_ID[kpId];
  if (!node) return { kind: 'error', title: '考点不存在', desc: '' };
  if (!inScope(node, vol)) {
    return {
      kind: 'off',
      title: '超纲 · 直接跳过',
      desc: '这个考点不在' + VOL_NAME[vol] + '的考试范围内，做它是在花时间。',
      heat: heat(node, vol),
    };
  }
  const h = heat(node, vol);
  const fams = node.fam[vol] || [];
  if (!fams.length) {
    return {
      kind: 'nodata',
      title: '只记掌握度 · 不出纠偏',
      desc: '这个考点还没有逐题精讲，没有标准思路族可比对。先把它记进题库，等语料补上再判定。',
      heat: h,
    };
  }
  if (famN === null || famN === undefined) {
    return { kind: 'pending', title: '等你选完思路', desc: '', heat: h, fams: fams };
  }
  if (famN === 0) {
    return {
      kind: 'off-method',
      title: '偏离 · 族外解法',
      desc: '你用的解法不落在这个考点的 ' + fams.length + ' 条标准思路里。考研极少奖励偏门技巧，先回到标准解法，别在这条路上加练。',
      heat: h,
      fams: fams,
    };
  }
  const fam = fams.filter(function (f) { return f.n === famN; })[0];
  if (h.n6 >= 3) {
    return {
      kind: 'ok-hot',
      title: '贴合 · 高频考点',
      desc: '思路「' + fam.t + '」在射程内，这个考点近六年考了 ' + h.n6 + ' 次。这类题值得反复练到不用想。',
      heat: h, fams: fams, fam: fam,
    };
  }
  if (h.n6 >= 1) {
    return {
      kind: 'ok-cold',
      title: '贴合 · 低频考点',
      desc: '思路对，但这个考点近六年只考了 ' + h.n6 + ' 次。掌握思路即可，不必刷同类题。',
      heat: h, fams: fams, fam: fam,
    };
  }
  return {
    kind: 'ok-gone',
    title: '贴合 · 近六年未考',
    desc: '思路是对的，但这个考点 2021 年以来没再出现。有余力再做，优先级排在后面。',
    heat: h, fams: fams, fam: fam,
  };
}

/* ---------------- 诊断聚合 ---------------- */

const HALF_LIFE_DAYS = 83;

// 跨考点聚合「卡在哪」不能靠思路族原文比对——每个考点的措辞都是另写的。
// 按方法标签归并，才能得到「你在泰勒展开上卡了 3 次」这种结论。
const METHODS = [
  '拉格朗日中值定理', '拉格朗日乘数法', '柯西中值定理', '积分中值定理', '单调有界准则',
  '等价无穷小', '夹逼准则', '洛必达法则', '泰勒公式', '泰勒展开', '分部积分', '换元积分',
  '轮换对称性', '对称性', '极坐标', '球坐标', '柱坐标', '格林公式', '高斯公式', '斯托克斯公式',
  '幂级数', '傅里叶级数', '特征值', '特征向量', '相似对角化', '二次型', '正定性',
  '初等变换', '全概率公式', '贝叶斯', '分布函数', '最大似然', '矩估计', '区间估计', '假设检验',
  '一阶线性微分方程', '常数变易法', '隐函数求导', '参数方程', '旋转体', '形心', '方向导数',
  '条件极值', '零点定理', '介值定理', '夹逼', '洛必达', '泰勒', '拉格朗日', '罗尔',
].sort(function (a, b) { return b.length - a.length; });

function tagsOf(text) {
  let rest = text || '';
  const out = [];
  for (let i = 0; i < METHODS.length; i++) {
    const m = METHODS[i];
    if (rest.indexOf(m) >= 0) {
      out.push(m);
      rest = rest.split(m).join('');
    }
    if (out.length >= 3) break;
  }
  return out;
}

function decay(ts) {
  const days = Math.max(0, (Date.now() - ts) / 86400000);
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/**
 * @param {Array} records  本地记录
 */
function diagnose(records) {
  const groups = {};
  records.forEach(function (r) {
    const key = r.kp + '|' + r.vol;
    if (!groups[key]) groups[key] = { kp: r.kp, vol: r.vol, list: [] };
    groups[key].list.push(r);
  });

  const rows = Object.keys(groups).map(function (k) {
    const g = groups[k];
    // 考点树换版后旧记录可能指向已不存在的考点：热度归零，别让诊断页整个挂掉
    const node = KP_BY_ID[g.kp];
    const h = node ? heat(node, g.vol) : { total: 0, n6: 0 };
    let sum = 0, wsum = 0;
    g.list.forEach(function (r) {
      const w = decay(r.ts);
      sum += r.mastery * w;
      wsum += w;
    });
    const mastery = wsum ? sum / wsum : 0;
    const heatScore = Math.min(100, h.n6 / 8 * 100);
    return {
      kp: g.kp,
      vol: g.vol,
      name: node ? node.name : g.kp,
      n: g.list.length,
      n6: h.n6,
      total: h.total,
      mastery: mastery,
      prio: heatScore * (1 - mastery),
      gone: h.n6 === 0,
      last: Math.max.apply(null, g.list.map(function (r) { return r.ts; })),
    };
  }).sort(function (a, b) { return b.prio - a.prio; });

  // 反复卡点：同一种方法在不止一道题上卡住，跨考点看
  const stuck = {};
  records.forEach(function (r) {
    if (r.mastery > 0.6) return;
    const tags = tagsOf(r.famText);
    const keys = tags.length ? tags : (r.famText ? [r.famText.slice(0, 10)] : []);
    keys.forEach(function (key) {
      if (!stuck[key]) stuck[key] = { text: key, n: 0, kps: {}, kpNames: {}, sample: r.famText || '' };
      const s = stuck[key];
      s.n++;
      s.kps[r.kp] = 1;
      const node = KP_BY_ID[r.kp];
      if (node) s.kpNames[node.name] = 1;
    });
  });
  const stuckList = Object.keys(stuck).map(function (k) {
    const s = stuck[k];
    return {
      text: s.text, n: s.n, kps: Object.keys(s.kps).length,
      names: Object.keys(s.kpNames), sample: s.sample, tagged: METHODS.indexOf(s.text) >= 0,
    };
  }).sort(function (a, b) { return b.n - a.n || b.kps - a.kps; });

  let sum = 0;
  records.forEach(function (r) { sum += r.mastery; });
  const avg = records.length ? sum / records.length : 0;
  const offCount = records.filter(function (r) { return r.kind === 'off-method'; }).length;

  return {
    rows: rows,
    stuck: stuckList,
    total: records.length,
    kpCount: rows.length,
    avg: avg,
    offCount: offCount,
    top: rows[0] || null,
  };
}

/* ---------------- 考频先验 ---------------- */

function priorRows(kw, band) {
  const k = (kw || '').trim();
  return PRIOR.filter(function (r) {
    if (k && r[0].indexOf(k) < 0 && r[1].indexOf(k) < 0 && r[2].indexOf(k) < 0) return false;
    return true;
  }).slice(0, 200).map(function (r) {
    return { chap: r[0], pt: r[1], name: r[2], fr: r[3], diff: r[4], target: r[5] };
  });
}

module.exports = {
  NODES: NODES,
  KP_BY_ID: KP_BY_ID,
  VOL_NAME: VOL_NAME,
  RECENT_FROM: RECENT_FROM,
  inScope: inScope,
  heat: heat,
  yearBars: yearBars,
  listByVol: listByVol,
  matchStem: matchStem,
  findOriginal: findOriginal,
  practiceValue: practiceValue,
  judge: judge,
  diagnose: diagnose,
  priorRows: priorRows,
  decay: decay,
  tagsOf: tagsOf,
};
