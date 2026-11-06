const E = require('../../utils/engine.js');
const S = require('../../utils/store.js');

const VOLS = [
  { k: '1', n: '数学一' },
  { k: '2', n: '数学二' },
  { k: '3', n: '数学三' },
];

Page({
  data: {
    vols: VOLS,
    vol: '1',
    text: '',
    cands: [],
    matching: false,
    kpId: '',
    kpName: '',
    kpInfo: null,
    fams: [],
    famN: null,
    masteryIdx: -1,
    levels: S.MASTER,
    verdict: null,
    saved: false,
    pickerNames: [],
  },

  onLoad() {
    const last = wx.getStorageSync('ekb.vol') || '1';
    this.setData({ vol: last, pickerNames: this.namesOf(last) });
  },

  namesOf(v) {
    return E.listByVol(v).map(function (x) {
      return x.name + '（近六年 ' + x.n6 + ' 次）';
    });
  },

  onShow() {
    // 从其他页回来时刷新，避免数据陈旧
  },

  /* ---------- 科目 ---------- */
  onVol(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.vol) return;
    wx.setStorageSync('ekb.vol', v);
    this.setData({
      vol: v, kpId: '', kpName: '', kpInfo: null, fams: [],
      famN: null, masteryIdx: -1, verdict: null, cands: [], saved: false,
      pickerNames: this.namesOf(v),
    });
  },

  /* ---------- 题干 ---------- */
  onInput(e) {
    this.setData({ text: e.detail.value });
  },

  doMatch() {
    const t = (this.data.text || '').trim();
    if (t.length < 8) {
      wx.showToast({ title: '题干太短了，再多粘一点', icon: 'none' });
      return;
    }
    this.setData({ matching: true });
    wx.nextTick(() => {
      let cands = [];
      try {
        cands = E.matchStem(t);
      } catch (err) {
        cands = [];
      }
      this.setData({ cands: cands, matching: false });
      if (!cands.length) {
        wx.showToast({ title: '没匹配上，手动选考点', icon: 'none' });
      }
    });
  },

  pickCand(e) {
    this.loadKp(e.currentTarget.dataset.kp);
  },

  /* ---------- 手动选考点 ---------- */
  onPicker(e) {
    const i = Number(e.detail.value);
    const list = E.listByVol(this.data.vol);
    if (!list[i]) return;
    this.loadKp(list[i].id);
  },

  loadKp(kpId) {
    const node = E.KP_BY_ID[kpId];
    if (!node) return;
    const h = E.heat(node, this.data.vol);
    const fams = node.fam[this.data.vol] || [];
    this.setData({
      kpId: kpId,
      kpName: node.name,
      kpInfo: { n6: h.n6, total: h.total, hasJJ: !!node.jj[this.data.vol] },
      fams: fams,
      famN: null,
      masteryIdx: -1,
      verdict: null,
      saved: false,
    });
  },

  /* ---------- 思路族 ---------- */
  pickFam(e) {
    const n = Number(e.currentTarget.dataset.n);
    this.setData({ famN: n });
    this.refresh();
  },

  pickNone() {
    this.setData({ famN: 0 });
    this.refresh();
  },

  /* ---------- 掌握度 ---------- */
  pickLevel(e) {
    const i = Number(e.currentTarget.dataset.i);
    this.setData({ masteryIdx: i });
    this.refresh();
  },

  refresh() {
    const d = this.data;
    if (!d.kpId) return;
    const hasFam = d.fams.length > 0;
    if (hasFam && d.famN === null) {
      this.setData({ verdict: null });
      return;
    }
    if (!hasFam && d.masteryIdx < 0) {
      this.setData({ verdict: null });
      return;
    }
    const v = E.judge(d.kpId, d.vol, hasFam ? d.famN : null);
    this.setData({ verdict: v });
  },

  /* ---------- 保存 ---------- */
  save() {
    const d = this.data;
    if (!d.kpId) return;
    if (d.masteryIdx < 0) {
      wx.showToast({ title: '先选一下当时做得怎么样', icon: 'none' });
      return;
    }
    if (d.fams.length && d.famN === null) {
      wx.showToast({ title: '选一下卡在哪条思路', icon: 'none' });
      return;
    }
    const lv = d.levels[d.masteryIdx];
    const fam = d.famN > 0 ? d.fams.filter(function (f) { return f.n === d.famN; })[0] : null;
    S.add({
      kp: d.kpId,
      vol: d.vol,
      kpName: d.kpName,
      stem: (d.text || '').slice(0, 600),
      mastery: lv.v,
      levelLabel: lv.label,
      fam: d.famN,
      famText: fam ? fam.t : '',
      kind: d.verdict ? d.verdict.kind : 'unknown',
      title: d.verdict ? d.verdict.title : '',
    });
    this.setData({ saved: true });
    wx.showToast({ title: '已存入题库', icon: 'success' });
  },

  reset() {
    this.setData({
      text: '', cands: [], kpId: '', kpName: '', kpInfo: null,
      fams: [], famN: null, masteryIdx: -1, verdict: null, saved: false,
    });
  },

  goDiagnose() {
    wx.switchTab({ url: '/pages/diagnose/diagnose' });
  },
});
