/**
 * 试卷结构查询页：改革前 / 改革后两套口径，逐项照 brain.py format --era both 实测转录。
 * 常驻免责说明：两套口径都正确，按题源年代选用；旧结构套卷不能计入全真模考成绩。
 */
const F = require('../../data/format.js');

const ERAS = [
  { k: 'post2021', n: '改革后（2021 起）' },
  { k: 'pre2021', n: '改革前（2020 及以前）' },
];

function pct(v, approx) {
  const n = Math.round(Number(v) * 100);
  return (approx ? '约' : '') + n + '%';
}

function viewOf(key) {
  const e = F[key];
  if (!e) return null;
  return {
    label: e.label,
    totalLine: e.total_score + ' 分 / ' + e.minutes + ' 分钟 / 闭卷笔试 / 共 ' + e.qcount + ' 题',
    choicesLine: '单项选择题：' + e.choices.count + ' 小题 × ' + e.choices.each + ' 分 = ' + e.choices.total + ' 分',
    fillsLine: '填空题：' + e.fills.count + ' 小题 × ' + e.fills.each + ' 分 = ' + e.fills.total + ' 分',
    solutionsLine: '解答题（含证明）：' + e.solutions.count + ' 小题 = ' + e.solutions.total + ' 分'
      + (e.solutions.note ? '（' + e.solutions.note + '）' : ''),
    objectiveLine: '客观题 ' + e.objective + ' 分（约 ' + e.objectivePct + '%） / 主观题 ' + e.subjective + ' 分',
    ratioRows: ['数一', '数二', '数三'].map(function (vol) {
      const r = e.ratio[vol] || {};
      return {
        vol: vol,
        H: pct(r.H, e.ratioApprox),
        L: pct(r.L, e.ratioApprox),
        P: r.P === 0 ? '不考概率' : pct(r.P, e.ratioApprox),
      };
    }),
    usage: e.usage,
  };
}

Page({
  data: {
    eras: ERAS,
    era: 'post2021',
    view: viewOf('post2021'),
    diff: F.diff,
    disclaimer: F.disclaimer,
    source: F.source,
  },

  pickEra(e) {
    const k = e.currentTarget.dataset.k;
    if (!F[k]) return;
    this.setData({ era: k, view: viewOf(k) });
  },
});
