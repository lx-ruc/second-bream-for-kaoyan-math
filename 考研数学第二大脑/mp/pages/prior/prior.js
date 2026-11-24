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
    kw: '',
    rows: [],
    volCount: 0,
  },

  onShow() {
    // 与 map 页共用 ekb.vol：从别的页面切了卷别，回来也是同一卷
    const vol = wx.getStorageSync('ekb.vol') || '1';
    this.setData({ vol: vol });
    this.apply(vol, this.data.kw);
  },

  onVol(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.vol) return;
    wx.setStorageSync('ekb.vol', v);
    this.setData({ vol: v });
    this.apply(v, this.data.kw);
  },

  onInput(e) {
    const kw = e.detail.value;
    this.setData({ kw: kw });
    this.apply(this.data.vol, kw);
  },

  // 切卷/搜索都重建列表；搜索只隐藏行，rank 与 volRank 都在 engine 里算好，不在这里改名次
  apply(vol, kw) {
    const rows = E.priorKpRows(vol, kw).map(function (r) {
      return {
        id: r.id,
        name: r.name,
        rank: r.rank,
        volRank: r.volRank,
        chapName: r.chapName,
        S: r.S,
        F: r.F,
        D: r.D,
        py: r.py,
        pn: r.pn,
        hard: r.hard,
        nrow: r.nrow,
        small: r.nrow <= 2,
        open: false,
      };
    });
    // volCount 是本卷全部考点数（不随搜索变），分母始终是 92
    this.setData({ rows: rows, volCount: E.priorKpRows(vol, '').length });
  },

  // 只更新一行的展开态，不整包重传列表
  onToggle(e) {
    const i = e.currentTarget.dataset.i;
    const patch = {};
    patch['rows[' + i + '].open'] = !this.data.rows[i].open;
    this.setData(patch);
  },
});
