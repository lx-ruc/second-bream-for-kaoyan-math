/** 知识卡检索：标签 / 错因 / 类型 / 全文四种筛选，可组合。 */
const C = require('../../utils/cards.js');

function excerpt(card) {
  const vals = [];
  Object.keys(card.body || {}).forEach(function (k) { vals.push(card.body[k]); });
  vals.push(card.migration, card.source);
  const text = vals.filter(function (v) { return v && v.trim(); }).join(' · ').replace(/\s+/g, ' ');
  return text.slice(0, 72) || '（正文待补）';
}

Page({
  data: {
    tag: '',
    errorType: '',
    type: '',
    text: '',
    rows: [],
    searched: false,
    total: 0,
    hint: '',
    types: [],
    errorTypes: [],
  },

  onLoad() {
    this.setData({
      types: C.TYPES.map(function (k) { return { k: k, n: C.TYPE_NAMES[k] }; }),
      errorTypes: C.ERROR_TYPES.slice(),
    });
  },

  onShow() {
    if (this.data.searched) this.onSearch();
  },

  onInput(e) {
    const patch = {};
    patch[e.currentTarget.dataset.f] = e.detail.value;
    this.setData(patch);
  },

  pickType(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ type: this.data.type === k ? '' : k });
  },

  pickError(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ errorType: this.data.errorType === v ? '' : v });
  },

  onSearch() {
    const d = this.data;
    const found = C.query({
      tag: d.tag.trim(),
      errorType: d.errorType,
      type: d.type,
      text: d.text.trim(),
    });
    const rows = found.map(function (c) {
      return {
        id: c.id,
        title: c.title,
        typeName: C.TYPE_NAMES[c.type] || c.type,
        tagsText: (c.tags || []).join(' / ') || C.PLACEHOLDER,
        errorText: c.error_type || C.TYPE_NAMES[c.type] || '',
        summary: excerpt(c),
        incomplete: !!c.incomplete,
      };
    });
    this.setData({ rows: rows, total: rows.length, searched: true });
  },

  openCard(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/card-edit/card-edit?id=' + id });
  },

  goNew() {
    wx.navigateTo({ url: '/pages/card-edit/card-edit' });
  },
});
