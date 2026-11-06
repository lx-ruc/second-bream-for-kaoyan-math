const E = require('../../utils/engine.js');

const VOLS = [
  { k: '1', n: '数学一' },
  { k: '2', n: '数学二' },
  { k: '3', n: '数学三' },
];

Page({
  data: {
    vols: VOLS,
    vol: '1',
    list: [],
    open: '',
    detail: null,
    filter: 'all',
    hotCount: 0,
    totalCount: 0,
  },

  onShow() {
    const vol = wx.getStorageSync('ekb.vol') || '1';
    const focus = wx.getStorageSync('ekb.focusKp');
    this.setData({ vol: vol });
    this.build(vol);
    if (focus) {
      wx.removeStorageSync('ekb.focusKp');
      this.openKp(focus);
    }
  },

  onVol(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.vol) return;
    wx.setStorageSync('ekb.vol', v);
    this.setData({ vol: v, open: '', detail: null });
    this.build(v);
  },

  setFilter(e) {
    const f = e.currentTarget.dataset.f;
    this.setData({ filter: f });
    this.build(this.data.vol);
  },

  build(vol) {
    let list = E.listByVol(vol);
    const hotCount = list.filter(function (x) { return x.n6 >= 3; }).length;
    const totalCount = list.length;
    const f = this.data.filter;
    if (f === 'hot') list = list.filter(function (x) { return x.n6 >= 3; });
    if (f === 'cold') list = list.filter(function (x) { return x.n6 < 3; });
    if (f === 'jj') list = list.filter(function (x) { return x.jj; });
    this.setData({ list: list, hotCount: hotCount, totalCount: totalCount });
  },

  tapKp(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.open === id) {
      this.setData({ open: '', detail: null });
      return;
    }
    this.openKp(id);
  },

  openKp(id) {
    const node = E.KP_BY_ID[id];
    if (!node) return;
    const vol = this.data.vol;
    const h = E.heat(node, vol);
    const bars = E.yearBars(node, vol);
    const maxN = Math.max.apply(null, bars.map(function (b) { return b.n; })) || 1;
    const qs = node.qs.filter(function (q) { return q[0] === vol; })
      .sort(function (a, b) { return b[1] - a[1] || a[2] - b[2]; })
      .map(function (q) {
        // 同一考点同年可能出两道题（选择+解答），key 必须带题号才唯一
        return { k: q[1] + '-' + q[2], y: q[1], no: q[2], t: q[3], sc: q[4], has: q[5] === 1 };
      });
    const fams = (node.fam[vol] || []).map(function (f) { return { n: f.n, t: f.t }; });
    this.setData({
      open: id,
      detail: {
        id: id,
        name: node.name,
        n6: h.n6,
        total: h.total,
        hasJJ: !!node.jj[vol],
        url: node.jj[vol] ? node.jj[vol].u : '',
        chap: node.chap[vol] || '',
        bars: bars.map(function (b) { return { y: b.y, n: b.n, h: Math.round(b.n / maxN * 100), recent: b.recent }; }),
        qs: qs,
        fams: fams,
        hasStem: qs.filter(function (q) { return q.has; }).length,
      },
    });
  },

  copyUrl() {
    const d = this.data.detail;
    if (!d || !d.url) {
      wx.showToast({ title: '这个考点还没有精讲', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: d.url,
      success: function () {
        wx.showToast({ title: '链接已复制，去腾讯文档打开', icon: 'none' });
      },
    });
  },
});
