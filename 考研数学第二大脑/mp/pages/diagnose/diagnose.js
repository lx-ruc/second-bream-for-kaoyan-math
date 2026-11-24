const E = require('../../utils/engine.js');
const S = require('../../utils/store.js');
const IMG = require('../../utils/img.js');
const C = require('../../utils/cards.js');
const T = require('../../utils/stats.js');

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
    dueCount: 0,
    showStats: false,
    examName: '数一',
    coverage: null,
    errors: null,
    streakCards: [],
    streakRecords: [],
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const recs = S.load();
    // 知识卡是独立存储（ekb.cards.v1），不参与原有掌握度诊断聚合；
    // 只给今日复习入口计数 + 独立的覆盖度/错因/连续答错区块使用（skill 工作流 5）。
    const cards = C.load();
    const dueCount = C.dueList().length;
    const examName = T.normalizeExam(wx.getStorageSync('ekb.syl.vol')
      || wx.getStorageSync('ekb.vol') || '1');
    const cov = T.coverage(cards, examName);
    const errs = T.errorDistribution(cards);
    const st = T.streaks(cards, recs);
    const extra = {
      examName: examName,
      coverage: cov,
      errors: errs,
      streakCards: st.reset.slice(0, 5),
      streakRecords: st.records.slice(0, 5),
    };
    if (!recs.length) {
      this.setData(Object.assign({
        empty: true, total: 0, rows: [], stuck: [], recent: [], dueCount: dueCount,
      }, extra));
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
        img: r.img ? IMG.abs(r.img) : '',
        fromPhoto: !!r.img,
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
          // 同一考点可能在两卷各记过题，key 要带卷号才唯一
          key: r.kp + '-' + r.vol,
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
      dueCount: dueCount,
      examName: extra.examName,
      coverage: extra.coverage,
      errors: extra.errors,
      streakCards: extra.streakCards,
      streakRecords: extra.streakRecords,
    });
  },

  toggleStats() {
    this.setData({ showStats: !this.data.showStats });
  },

  del(e) {
    const id = e.currentTarget.dataset.id;
    const rec = S.load().filter(function (r) { return r.id === id; })[0];
    wx.showModal({
      title: '删掉这条记录？',
      content: '删除后不影响其他题，但它不再计入诊断。拍过的原图也会一起删掉。',
      confirmColor: '#a6342a',
      success: (res) => {
        if (res.confirm) {
          if (rec && rec.img) IMG.remove(rec.img);
          S.remove(id);
          this.refresh();
        }
      },
    });
  },

  viewImg(e) {
    const src = e.currentTarget.dataset.src;
    if (src) wx.previewImage({ urls: [src] });
  },

  goIntake() {
    wx.switchTab({ url: '/pages/intake/intake' });
  },

  goMap(e) {
    const kp = e.currentTarget.dataset.kp;
    wx.setStorageSync('ekb.focusKp', kp || '');
    wx.switchTab({ url: '/pages/map/map' });
  },

  // tabBar 已满 5 项，知识卡三页一律从这里 navigateTo 进入，不新增 tab。
  goCardEdit() {
    wx.navigateTo({ url: '/pages/card-edit/card-edit' });
  },

  goCardSearch() {
    wx.navigateTo({ url: '/pages/card-search/card-search' });
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' });
  },

  // 第四阶段三个新页：tabBar 仍 5 项，一律从这里 navigateTo 进入。
  goPlan() {
    wx.navigateTo({ url: '/pages/plan/plan' });
  },

  goFormat() {
    wx.navigateTo({ url: '/pages/format/format' });
  },

  goCalibrate() {
    wx.navigateTo({ url: '/pages/calibrate/calibrate' });
  },
});
