/**
 * 统计 / 覆盖度 / 计划 / 校准 的纯逻辑层（skill 工作流 5/6/8/9 的移植）。
 *
 * 边界（跨机器别漂移）：
 *  1. 大纲树与真题树不合并、不互校。覆盖度只用 cards 的 H/L/P 标签对照
 *     data/syllabus.js 的章编码；records 的 kp 是真题树 id，不做映射。
 *  2. 「没笔记」≠「没掌握」。零笔记只是覆盖度缺口，不能推断为薄弱；
 *     薄弱只来自有记录的行为事实（records 的 mastery/kind）与 cards 的错因。
 *  3. 校准只读，绝不提供回写 rubric 权重的能力；权重只在 data/rubric.js。
 *  4. 不制造焦虑：倒计时只陈述日期事实，不评价能力。
 *  5. 旧结构套卷（2020 及以前）只作知识点训练，不计为限时全真模考、不比较分数。
 *
 * 规格来源：~/.workbuddy/skills/kaoyan-math-second-brain/SKILL.md 工作流 5/6/8/9
 * 与其 references/syllabus-history.md、syllabus-2027.md、templates.md（题评卡字段）。
 */
const C = require('./cards.js');
const E = require('./engine.js');
const SYLLABUS = require('../data/syllabus.js');
const FORMAT = require('../data/format.js');

/* ---------------- 公共口径常量（页面常驻展示，测试断言存在） ---------------- */

const COVERAGE_NOTE = '零笔记＝覆盖度缺口，只说明这个大纲编号下你还没有笔记；不能推断为「没掌握」。薄弱只从有记录的行为事实与错因得出。';
const CALIBRATE_WARNING = '题评与错题都存在自选择偏差，统计只反映用户自己的题源结构，不是官方命题频率，也不自动回写评分权重。要改权重需手工编辑 rubric 参数。';
const PLAN_PRINCIPLES = [
  '限时模考：上午 8:30–11:30 / 180 分钟 / 闭卷。',
  '只把 2021 起的套卷计为限时全真模考；2020 及以前的旧结构套卷归「知识点训练 / 专题题源」，不比较分数。',
  '真题优先于模拟卷；题源紧张时先用题评筛掉偏离真题的模拟题，再从值得做的题里按每 10 分钟收益排序取题。',
  '模考后必须安排错题归因时间；归因比堆题量更有效。',
  '不把刷套卷数量当进度指标。',
  '倒计时只是日期事实，不评价能力，不制造紧迫感。',
];
const OLD_PAPER_NOTE = '2020 及以前的旧结构套卷只作「知识点训练 / 专题题源」，不计为限时全真模考，分数不与现行模考比较。';

/* ---------------- 工具 ---------------- */

/** 数字卷号 / 中文卷名 / 数学X 归一到大纲引擎用的「数一/数二/数三」。 */
function normalizeExam(v) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (s === '1' || s === '数一' || s === '数学一') return '数一';
  if (s === '2' || s === '数二' || s === '数学二') return '数二';
  if (s === '3' || s === '数三' || s === '数学三') return '数三';
  return '数一'; // skill 缺省卷种
}

/** H2.3 / L5 / P7 → H2 / L5 / P7（章级编码）；非 H/L/P 前缀返回 null。 */
function chapterOfTag(tag) {
  const m = /^([HLP])(\d+)/i.exec(String(tag === undefined || tag === null ? '' : tag).trim());
  return m ? m[1].toUpperCase() + m[2] : null;
}

/** H2.3 / L5 → H / L / P（科目大类，calibrate 用） */
function subjectOfTag(tag) {
  const m = /^([HLP])/i.exec(String(tag === undefined || tag === null ? '' : tag).trim());
  return m ? m[1].toUpperCase() : null;
}

function uniq(arr) {
  const out = [];
  (arr || []).forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
  return out;
}

function round1(x) { return Math.round(x * 10) / 10; }

/* ---------------- C1. 大纲覆盖度（skill 工作流 5） ---------------- */

/** 当前卷应考的全部章编码：独立章 + 该卷适用的非独立章编码（H9/H10/L7）。 */
function targetChapters(examType) {
  const exam = normalizeExam(examType);
  const standalone = E.syllabusChapters(exam).map(function (ch) { return ch.code; });
  const codeOnly = (SYLLABUS.codeOnly || []).filter(function (x) {
    return (x.exams || []).indexOf(exam) >= 0;
  }).map(function (x) { return x.code; });
  return uniq(standalone.concat(codeOnly)).sort();
}

function chapterTitle(code, examType) {
  const v = E.syllabusChapter(code, examType);
  return v ? v.title || v.code : code;
}

/**
 * 覆盖度：应考章总数、已记笔记章数、零笔记章编号清单。
 * 只统计 cards 的 tags；题评卡也算笔记（有标签即这个编号下有笔记），
 * 但题评卡不进复习位，这里只作「覆盖」不计「掌握」。
 */
function coverage(cards, examType) {
  const exam = normalizeExam(examType);
  const target = targetChapters(exam);
  const noted = {};
  (cards || []).forEach(function (c) {
    (c && c.tags || []).forEach(function (t) {
      const ch = chapterOfTag(t);
      if (ch) noted[ch] = true;
    });
  });
  const covered = target.filter(function (c) { return noted[c]; });
  const gaps = target.filter(function (c) { return !noted[c]; }).map(function (code) {
    return { code: code, title: chapterTitle(code, exam) };
  });
  return {
    exam: exam,
    targetCount: target.length,
    coveredCount: covered.length,
    pct: target.length ? Math.round(covered.length / target.length * 100) : 0,
    gaps: gaps,
    gapsText: gaps.map(function (g) { return g.code + ' ' + g.title; }).join('；'),
    note: COVERAGE_NOTE,
  };
}

/* ---------------- C2. 错因分布五类（skill 工作流 5） ---------------- */

/** 只从 wrong 卡的 error_type 统计；五类全列，无数据写 0，不推断。 */
function errorDistribution(cards) {
  const types = C.ERROR_TYPES.slice();
  const counts = {};
  types.forEach(function (t) { counts[t] = 0; });
  let total = 0;
  (cards || []).forEach(function (c) {
    if (!c || c.type !== 'wrong') return;
    if (counts[c.error_type] === undefined) return;
    counts[c.error_type]++;
    total++;
  });
  return {
    total: total,
    rows: types.map(function (t) {
      return { name: t, n: counts[t], pct: total ? Math.round(counts[t] / total * 100) : 0 };
    }),
    note: '五类错因来自你录入的错题卡；没有错因记录的卡不计入，不会替你推断。',
  };
}

/* ---------------- C3. 连续答错（skill 工作流 5） ---------------- */

/**
 * 两个来源：
 *  - cards：last_review 非空且 level=0 → 答错归零（新录入 level=0 不算）。
 *  - records：同一 kp 末尾连续 mastery===0（四档行为的「还是不会」）≥2 条。
 * 两棵树分开列，不合并、不互校。
 */
function streaks(cards, records) {
  const reset = (cards || []).filter(function (c) {
    return c && c.type !== 'assessment' && c.last_review && Number(c.level) === 0;
  }).map(function (c) {
    return {
      source: 'card',
      id: c.id,
      name: c.title,
      tags: uniq((c.tags || []).map(chapterOfTag)).slice(0, 3),
      errorType: c.error_type || '',
      when: c.last_review,
    };
  });

  const byKp = {};
  (records || []).forEach(function (r) {
    if (!r) return;
    const k = r.kp || '';
    if (!byKp[k]) byKp[k] = [];
    byKp[k].push(r);
  });
  const rec = Object.keys(byKp).map(function (k) {
    const list = byKp[k].slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    let n = 0;
    for (let i = list.length - 1; i >= 0 && Number(list[i].mastery) === 0; i--) n++;
    const last = list[list.length - 1] || {};
    return { source: 'record', kp: k, name: last.kpName || k, n: n };
  }).filter(function (x) { return x.n >= 2; }).sort(function (a, b) { return b.n - a.n; });

  return {
    reset: reset,
    records: rec,
    note: '卡片侧：有复习记录且 level=0 才是答错归零，新录入的 0 级不算。记录侧：同一考点末尾连续「还是不会」≥2 条。',
  };
}

/* ---------------- C4. 冲刺计划（skill 工作流 6/8） ---------------- */

function parseDate(s) {
  const str = String(s === undefined || s === null ? '' : s).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : '';
}

/** 两个 YYYY-MM-DD 之间的自然日差（b - a），同一天为 0。 */
function daysBetween(a, b) {
  const x = parseDate(a), y = parseDate(b);
  if (!x || !y) return 0;
  const da = new Date(x + 'T00:00:00Z'), db = new Date(y + 'T00:00:00Z');
  return Math.round((db - da) / 86400000);
}

/**
 * @param {Object} o { examDate, days, today, cards, records, weakNames }
 *  - days 省略时由 examDate - today 推出（下限 0）。
 *  - 到期题按天均分进入逐日计划；薄弱章节来自诊断页传来的行为事实结论。
 *  - 每 7 天第 7 日安排一次限时全真模考（仅 2021 起套卷），次日安排归因。
 */
function buildPlan(o) {
  const opt = o || {};
  const today = parseDate(opt.today) || C.todayStr();
  const examDate = parseDate(opt.examDate) || '2026-12-20';
  let days = parseInt(opt.days, 10);
  if (!isFinite(days) || days < 0) days = Math.max(0, daysBetween(today, examDate));
  days = Math.min(days, 400); // 防止误输入撑爆页面

  const due = C.dueList(today) || [];
  const weak = uniq(opt.weakNames || []).slice(0, 6);
  const perDay = days > 0 ? Math.ceil(due.length / days) : due.length;
  const rows = [];
  for (let i = 0; i < days; i++) {
    const date = C.addDays(today, i);
    const batch = due.slice(i * perDay, (i + 1) * perDay);
    const isMock = days >= 7 && (i + 1) % 7 === 0;
    const isReview = days >= 7 && (i + 1) % 7 === 0 && (i + 1) % 14 === 0;
    rows.push({
      date: date,
      dayNo: i + 1,
      dueCount: batch.length,
      dueMinutes: batch.reduce(function (s, c) { return s + (Number(c.minutes) || 0); }, 0),
      dueItems: batch.map(function (c) {
        return { id: c.id, title: c.title || c.id, minutes: Number(c.minutes) || 0, tags: (c.tags || []).slice(0, 3) };
      }),
      focus: weak.length ? weak[i % weak.length] : '按今日到期清单回顾（暂无行为事实层面的薄弱结论）',
      mock: isMock && !isReview,
      mockText: isMock && !isReview
        ? '限时全真模考 8:30–11:30 / 180 分钟 / 闭卷；只用 2021 起的套卷，旧结构套卷不比较分数。'
        : '',
      attribution: isMock ? '模考后安排错题归因：按错因聚类 → 章节 → 难度，优先「思路缺失 / 概念不清」。' : '',
      oldPaperNote: OLD_PAPER_NOTE,
    });
  }

  return {
    examDate: examDate,
    today: today,
    days: days,
    remaining: daysBetween(today, examDate),
    dueTotal: due.length,
    rows: rows,
    principles: PLAN_PRINCIPLES.slice(),
    note: '倒计时只是日期事实，不评价能力。计划按到期量与薄弱章节排布，不用套卷数量衡量进度。',
  };
}

/* ---------------- C5. 题源校准只读报告（skill 工作流 9） ---------------- */

/** 数值收益只取真实存过的字段，缺失就是 null，绝不编造。 */
function rewardOf(card) {
  const v = card && (card.reward !== undefined ? card.reward : card.R);
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && isFinite(n) ? n : null;
}

/** 结论归一：skill 模板写「值得做」；小程序评估层写 worth。 */
function isWorth(verdict) {
  return verdict === 'worth' || verdict === '值得做';
}

/**
 * 只读报告，结构对齐 brain.py calibrate：
 *   assessed / avgReward / worth / realNotes / 来源分布。
 * 不接收任何权重参数，也没有任何写回函数（硬约束）。
 */
function calibrate(records, cards) {
  const all = cards || [];
  const assessments = all.filter(function (c) { return c && c.type === 'assessment'; });
  const byCode = {};

  function row(code) {
    if (!byCode[code]) {
      byCode[code] = { code: code, title: chapterTitle(code, ''), assessed: 0,
        rewardSum: 0, rewardN: 0, worth: 0, verdictN: 0, realNotes: 0 };
    }
    return byCode[code];
  }

  assessments.forEach(function (c) {
    const codes = uniq((c.tags || []).map(subjectOfTag)); // calibrate 按 H/L/P 大类，与 skill top_tag 一致
    const reward = rewardOf(c);
    const hasVerdict = c.verdict !== undefined && c.verdict !== null && c.verdict !== '';
    codes.forEach(function (code) {
      const r = row(code);
      r.assessed++;
      if (reward !== null) { r.rewardSum += reward; r.rewardN++; }
      if (hasVerdict) { r.verdictN++; if (isWorth(c.verdict)) r.worth++; }
    });
  });

  // skill 的 real_notes 来自 index.json 里 source 含「真题」的笔记（小程序 = 非题评卡）。
  const realNotes = all.filter(function (c) {
    return c && c.type !== 'assessment' && String(c.source || '').indexOf('真题') >= 0;
  });
  realNotes.forEach(function (c) {
    uniq((c.tags || []).map(subjectOfTag)).forEach(function (code) { row(code).realNotes++; });
  });

  const rows = Object.keys(byCode).map(function (k) {
    const r = byCode[k];
    return {
      code: r.code,
      title: r.title,
      assessed: r.assessed,
      avgReward: r.rewardN ? round1(r.rewardSum / r.rewardN) : null,
      rewardRecorded: r.rewardN,
      worth: r.worth,
      verdictRecorded: r.verdictN,
      worthPct: r.verdictN ? Math.round(r.worth / r.verdictN * 100) : null,
      realNotes: r.realNotes,
    };
  }).sort(function (a, b) { return b.assessed - a.assessed || a.code.localeCompare(b.code); });

  // 来源分布：卡片 source 原文直出，标出是否含「真题」；不猜年代、不补题源。
  const srcMap = {};
  all.forEach(function (c) {
    if (!c) return;
    const s = String(c.source || '').trim();
    const key = s || '（未填来源）';
    if (!srcMap[key]) srcMap[key] = { source: key, n: 0, isReal: s.indexOf('真题') >= 0 };
    srcMap[key].n++;
  });
  const sources = Object.keys(srcMap).map(function (k) { return srcMap[k]; })
    .sort(function (a, b) { return b.n - a.n; });

  return {
    assessedCount: assessments.length,
    realNoteCount: realNotes.length,
    recordCount: (records || []).length,
    rows: rows,
    sources: sources,
    warning: CALIBRATE_WARNING,
    note: '题评卡不进复习位；做题记录没有题源文本，真题来源分布只取自卡片的 source 字段。',
  };
}

module.exports = {
  COVERAGE_NOTE: COVERAGE_NOTE,
  CALIBRATE_WARNING: CALIBRATE_WARNING,
  PLAN_PRINCIPLES: PLAN_PRINCIPLES,
  OLD_PAPER_NOTE: OLD_PAPER_NOTE,
  FORMAT: FORMAT,
  normalizeExam: normalizeExam,
  chapterOfTag: chapterOfTag,
  subjectOfTag: subjectOfTag,
  targetChapters: targetChapters,
  chapterTitle: chapterTitle,
  coverage: coverage,
  errorDistribution: errorDistribution,
  streaks: streaks,
  parseDate: parseDate,
  daysBetween: daysBetween,
  buildPlan: buildPlan,
  rewardOf: rewardOf,
  isWorth: isWorth,
  calibrate: calibrate,
};
