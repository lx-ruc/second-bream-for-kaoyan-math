/**
 * 作答沉淀与分析：流水 / 错题本 / 六维能力。
 * 唯一数据源 store.load()（ekb.records.v1）；不引入题库、不做自评、不输出「该考点重要/该做」。
 */
const P = require('../../utils/progress.js');
const S = require('../../utils/store.js');

// 雷达几何：正上方起，顺时针每 60° 一维（沿用本项目 canvas 2d 画法，配色改为主色）
const START_ANGLE = -90;
const STEP_ANGLE = 60;
const RING_COUNT = 4;

function ago(ts) {
  if (!ts) return '时间未知';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return '今天';
  if (d === 1) return '昨天';
  if (d < 30) return d + ' 天前';
  return Math.floor(d / 30) + ' 个月前';
}

Page({
  data: {
    tab: 'flow',
    empty: true,
    total: 0,
    score: null,
    flow: [],
    wrong: [],
    wrongCount: 0,
    ability: [],
    abilityNote: P.ABILITY_NOTE,
    radarLabels: [],
    radarReady: false,
    radarFailed: false,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const recs = S.load();
    const sc = P.score(recs);
    const fl = P.flow(recs).map(function (r) {
      return Object.assign({}, r, { when: ago(r.ts) });
    });
    const wg = P.wrongBook(recs).map(function (r) {
      return Object.assign({}, r, { when: ago(r.lastTs) });
    });
    const ab = P.ability(recs);
    this.setData({
      total: sc.count,
      score: sc,
      flow: fl,
      wrong: wg,
      wrongCount: wg.length,
      ability: ab,
      abilityNote: P.ABILITY_NOTE,
      radarLabels: this.buildLabels(ab),
      empty: fl.length === 0,
    }, () => {
      // 只有当前就在能力视图时才取 canvas 节点（切视图后节点才存在）
      if (this.data.tab === 'ability') this.initRadar();
    });
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab: tab }, () => {
      if (tab === 'ability') this.initRadar();
    });
  },

  buildLabels(list) {
    return (list || []).map(function (axis, i) {
      const rad = ((START_ANGLE + i * STEP_ANGLE) * Math.PI) / 180;
      const x = 50 + Math.cos(rad) * 43;
      const y = 50 + Math.sin(rad) * 43;
      return {
        key: axis.key,
        name: axis.name,
        text: String(axis.value),
        style: 'left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%;',
      };
    });
  },

  initRadar() {
    const query = wx.createSelectorQuery();
    query.select('#radar-canvas').fields({ node: true, size: true }).exec((res) => {
      const item = res && res[0];
      if (!item || !item.node || !item.width) {
        this.setData({ radarFailed: true });
        return;
      }
      const canvas = item.node;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.setData({ radarFailed: true });
        return;
      }
      let dpr = 2;
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        dpr = (info && info.pixelRatio) || 2;
      } catch (e) {
        dpr = 2;
      }
      canvas.width = item.width * dpr;
      canvas.height = item.height * dpr;
      ctx.scale(dpr, dpr);
      this.radarCtx = ctx;
      this.radarSize = { w: item.width, h: item.height };
      this.setData({ radarReady: true, radarFailed: false });
      this.drawRadar();
    });
  },

  drawRadar() {
    const ctx = this.radarCtx;
    const radar = this.data.ability;
    if (!ctx || !radar || !radar.length || !this.radarSize) return;
    const w = this.radarSize.w;
    const h = this.radarSize.h;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.32; // 外圈留给维度标签
    const n = radar.length;

    const pointAt = (index, ratio) => {
      const rad = ((START_ANGLE + index * STEP_ANGLE) * Math.PI) / 180;
      return { x: cx + Math.cos(rad) * R * ratio, y: cy + Math.sin(rad) * R * ratio };
    };

    ctx.clearRect(0, 0, w, h);

    // 网格环
    for (let ring = 1; ring <= RING_COUNT; ring++) {
      const ratio = ring / RING_COUNT;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = pointAt(i, ratio);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === RING_COUNT ? '#e6dfd1' : '#f0ebe0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 轴线
    for (let i = 0; i < n; i++) {
      const p = pointAt(i, 1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = '#efe9dc';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 数据多边形
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ratio = Math.max(0.02, Math.min(1, radar[i].value / 100));
      const p = pointAt(i, ratio);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(166, 52, 42, 0.16)';
    ctx.fill();
    ctx.strokeStyle = '#a6342a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 数据点
    for (let i = 0; i < n; i++) {
      const ratio = Math.max(0.02, Math.min(1, radar[i].value / 100));
      const p = pointAt(i, ratio);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#a6342a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  goIntake() {
    wx.switchTab({ url: '/pages/intake/intake' });
  },
});
