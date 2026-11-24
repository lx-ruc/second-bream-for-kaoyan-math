/**
 * 冲刺计划页（skill 工作流 6/8）。
 * 输入考试日期 / 剩余天数 → 结合 cards.dueList 到期量与 S.load() 诊断薄弱章节生成逐日计划。
 * 所有原则常驻页面；倒计时只陈述日期事实，不评价能力、不制造焦虑。
 */
const T = require('../../utils/stats.js');
const S = require('../../utils/store.js');
const E = require('../../utils/engine.js');
const C = require('../../utils/cards.js');

/** 薄弱章节只从行为事实（records 的 mastery）得出，不从「没笔记」推断。 */
function weakNamesOf() {
  const d = E.diagnose(S.load() || []);
  return (d.rows || []).slice(0, 3).map(function (r) { return r.name; });
}

Page({
  data: {
    examDate: '2026-12-20',
    daysInput: '',
    today: '',
    plan: null,
    principles: T.PLAN_PRINCIPLES,
    oldPaperNote: T.OLD_PAPER_NOTE,
    note: '',
    hint: '',
  },

  onShow() {
    this.setData({ today: C.todayStr(), hint: '' });
    this.generate();
  },

  onDate(e) {
    this.setData({ examDate: e.detail.value });
  },

  onDays(e) {
    this.setData({ daysInput: e.detail.value });
  },

  generate() {
    const plan = T.buildPlan({
      examDate: this.data.examDate,
      days: this.data.daysInput,
      today: C.todayStr(),
      cards: C.load(),
      records: S.load(),
      weakNames: weakNamesOf(),
    });
    this.setData({
      plan: plan,
      hint: plan.days === 0 && !this.data.daysInput
        ? '考试日期已过或就在今天，剩余天数为 0；可手工填写天数查看计划结构。'
        : '',
    });
  },
});
