const E = require('../../utils/engine.js');
const S = require('../../utils/store.js');

function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return '今天';
  if (d === 1) return '昨天';
  if (d < 30) return d + ' 天前';
  return Math.floor(d / 30) + ' 个月前';
}

Page({
  data: {
    empty: true,
    total: 0,
    kpCount: 0,
    avgPct: 0,
    offCount: 0,
    offPct: 0,
    top: null,
    rows: [],
    stuck: [],
    recent: [],
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const recs = S.load();
    if (!recs.length) {
      this.setData({ empty: true, total: 0, rows: [], stuck: [], recent: [] });
      return;
    }
    const d = E.diagnose(recs);
    const recent = recs.slice(0, 8).map(function (r) {
      return {
        id: r.id,
        kpName: r.kpName || (E.KP_BY_ID[r.kp] ? E.KP_BY_ID[r.kp].name : r.kp),
        vol: E.VOL_NAME[r.vol],
        label: r.levelLabel,
        title: r.title,
        kind: r.kind,
        when: ago(r.ts),
        text: (r.stem || '').slice(0, 48),
      };
    });
    this.setData({
      empty: false,
      total: d.total,
      kpCount: d.kpCount,
      avgPct: Math.round(d.avg * 100),
      offCount: d.offCount,
      offPct: d.total ? Math.round(d.offCount / d.total * 100) : 0,
      top: d.top ? {
        name: d.top.name,
        n6: d.top.n6,
        n: d.top.n,
        masteryPct: Math.round(d.top.mastery * 100),
      } : null,
      rows: d.rows.slice(0, 6).map(function (r) {
        return {
          kp: r.kp,
          name: r.name,
          n6: r.n6,
          n: r.n,
          masteryPct: Math.round(r.mastery * 100),
          prioPct: Math.round(r.prio),
          gone: r.gone,
          vol: E.VOL_NAME[r.vol],
        };
      }),
      stuck: d.stuck.slice(0, 4),
      recent: recent,
    });
  },

  del(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删掉这条记录？',
      content: '删除后不影响其他题，但它不再计入诊断。',
      confirmColor: '#a6342a',
      success: (res) => {
        if (res.confirm) {
          S.remove(id);
          this.refresh();
        }
      },
    });
  },

  goIntake() {
    wx.switchTab({ url: '/pages/intake/intake' });
  },

  goMap(e) {
    const kp = e.currentTarget.dataset.kp;
    wx.setStorageSync('ekb.focusKp', kp || '');
    wx.switchTab({ url: '/pages/map/map' });
  },
});
