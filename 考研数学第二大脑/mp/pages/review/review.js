/** 今日复习：到期清单 + 错因聚类→章节→难度排序 + 答对升级 / 答错归零。 */
const C = require('../../utils/cards.js');

function overdueText(nextReview, today) {
  const a = Date.parse(nextReview + 'T00:00:00Z');
  const b = Date.parse(today + 'T00:00:00Z');
  if (!isFinite(a) || !isFinite(b)) return '待补日期';
  const n = Math.floor((b - a) / 86400000);
  return n > 0 ? '逾期 ' + n + ' 天' : '今日到期';
}

function groupText(card) {
  if (card.type === 'wrong') {
    if (card.error_type === '思路缺失' || card.error_type === '概念不清') {
      return '优先 · ' + card.error_type;
    }
    return card.error_type || '错因待补';
  }
  return C.TYPE_NAMES[card.type] || card.type;
}

Page({
  data: {
    today: '',
    rows: [],
    total: 0,
    minutes: 0,
    empty: true,
    tip: '建议用时，自己调整',
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const today = C.todayStr();
    const rows = C.dueList(today).map(function (c) {
      return {
        id: c.id,
        title: c.title,
        groupText: groupText(c),
        tagsText: (c.tags || []).join(' / ') || C.PLACEHOLDER,
        minutes: C.minutesFor(c.difficulty),
        level: c.level,
        dueText: overdueText(c.next_review, today),
        incomplete: !!c.incomplete,
      };
    });
    let minutes = 0;
    rows.forEach(function (r) { minutes += r.minutes; });
    this.setData({ today: today, rows: rows, total: rows.length, minutes: minutes, empty: rows.length === 0 });
  },

  onDone(e) {
    const ds = e.currentTarget.dataset;
    const ok = ds.ok === 'yes';
    const card = C.markDone(ds.id, ok);
    if (!card) { wx.showToast({ title: '卡片不存在', icon: 'none' }); return; }
    this.refresh();
    wx.showToast({
      title: ok ? '答对 · ' + card.level + ' 级 · ' + card.next_review : '答错 · 归零 · 今天再来',
      icon: 'none',
    });
  },

  onOpen(e) {
    wx.navigateTo({ url: '/pages/card-edit/card-edit?id=' + e.currentTarget.dataset.id });
  },

  goNew() {
    wx.navigateTo({ url: '/pages/card-edit/card-edit' });
  },
});
