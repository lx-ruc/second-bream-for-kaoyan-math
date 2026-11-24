/**
 * 官方大纲问答页 —— 第二棵树。
 *
 * 数据来自 skill「考研数学第二大脑 v1.3.0」的 outline.json（经 v2/build_syllabus.py
 * 转成 data/syllabus.js），按官方章号/章名/考点原文展示。与考点页的真题考点树
 * （data/kp.js，按真题出场归类）来源不同、并列、不合并、不互校。
 *
 * 卷别用独立 key `ekb.syl.vol`，绝不写 `ekb.vol`——切本页的卷不能影响
 * 考点页/诊断页/考频页的卷别。
 */
const E = require('../../utils/engine.js');
const SYL = require('../../data/syllabus.js');

const VOLS = [
  { k: '1', n: '数一', exam: '数一' },
  { k: '2', n: '数二', exam: '数二' },
  { k: '3', n: '数三', exam: '数三' },
];
const MODES = [
  { k: 'list', n: '按卷全表' },
  { k: 'code', n: '按编码' },
  { k: 'search', n: '搜考点' },
];
const SUBJECTS = [
  { k: 'calc', n: '高等数学 / 微积分' },
  { k: 'linear', n: '线性代数' },
  { k: 'prob', n: '概率论与数理统计' },
];

// outline.json 的 meta.scope 明确：「了解/理解/掌握」层级差异写入 notes，不单列。
// 所以没有逐条 level 字段，不许编造；只在章级说明里显示，并标注非条文。
const LEVEL_NOTE = '要求层级：outline.json 未逐条标注「了解/理解/掌握」；层级差异写在下方 skill 内置说明（非大纲条文）中。';

// 用户明确要的「两棵树并列」语义，原样常驻页脚。
const TWO_TREES = '本树是官方大纲章节—考点；真题考点树（考点页）是按真题出场归类，两者来源不同、不合并。数一真题索引缺向量代数和空间解析几何整章，但官方大纲有此章。';

Page({
  data: {
    vols: VOLS,
    vol: '1',
    exam: '数一',
    modes: MODES,
    mode: 'list',
    rows: [],
    count: 0,
    openCode: '',
    detail: null,
    codeKw: '',
    kw: '',
    sourceNote: SYL.meta.source_note,
    caveat: SYL.meta.caveat,
    levelNote: LEVEL_NOTE,
    twoTrees: TWO_TREES,
  },

  onShow() {
    const saved = wx.getStorageSync('ekb.syl.vol') || '1';
    const vol = VOLS.filter(function (v) { return v.k === saved; }).length ? saved : '1';
    const cur = VOLS.filter(function (v) { return v.k === vol; })[0];
    this.apply({ vol: vol, exam: cur.exam, openCode: '', detail: null });
  },

  onVol(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.vol) return;
    const cur = VOLS.filter(function (x) { return x.k === v; })[0];
    wx.setStorageSync('ekb.syl.vol', v); // 只写自己的 key，不碰 ekb.vol
    this.apply({ vol: v, exam: cur.exam, openCode: '', detail: null });
  },

  setMode(e) {
    const m = e.currentTarget.dataset.m;
    if (m === this.data.mode) return;
    this.apply({ mode: m, openCode: '', detail: null });
  },

  onCodeInput(e) {
    this.apply({ codeKw: e.detail.value, openCode: '', detail: null });
  },

  onKwInput(e) {
    this.apply({ kw: e.detail.value, openCode: '', detail: null });
  },

  /**
   * 单次 setData：用「本次要改的值」算出新行，再和 patch 一起一次提交。
   * input 每次敲键只触发一次 setData，不做整包重传（列表最多 25 行）。
   */
  apply(patch) {
    const pick = (k) => (patch[k] !== undefined ? patch[k] : this.data[k]);
    const rows = this.buildRows(pick('exam'), pick('mode'), pick('codeKw'), pick('kw'));
    const next = Object.assign({}, patch, { rows: rows, count: rows.length });
    this.setData(next);
  },

  /** 三个入口共用一种行结构，列表按科目插分组标题；纯计算，不碰 setData。 */
  buildRows(exam, mode, codeKw, kw) {
    let rows = [];

    if (mode === 'list') {
      const all = E.syllabusChapters(exam);
      SUBJECTS.forEach(function (s) {
        const list = all.filter(function (c) { return c.subjectKey === s.k; });
        list.forEach(function (c, i) {
          rows.push({
            key: c.code,
            code: c.code,
            title: c.title,
            pointCount: c.pointCount,
            group: i === 0 ? (s.n + ' · ' + list.length + ' 章') : '',
            standalone: true,
          });
        });
      });
    } else if (mode === 'code') {
      const k = (codeKw || '').trim().toUpperCase();
      E.syllabusChapters(exam).forEach(function (c) {
        rows.push({
          key: c.code, code: c.code, title: c.title,
          pointCount: c.pointCount, group: '', standalone: true,
        });
      });
      const codeOnly = (SYL.codeOnly || []).filter(function (x) {
        return x.exams.indexOf(exam) >= 0;
      });
      codeOnly.forEach(function (x, i) {
        rows.push({
          key: x.code, code: x.code, title: x.name, pointCount: 0,
          group: i === 0 ? '非独立章编码 · 并入所属章' : '', standalone: false,
        });
      });
      if (k) {
        rows = rows.filter(function (r) {
          return r.code.indexOf(k) >= 0 || r.title.indexOf(k) >= 0;
        });
      }
    } else {
      const q = (kw || '').trim();
      rows = E.syllabusQuery(q, exam).map(function (c) {
        return {
          key: c.code, code: c.code, title: c.title,
          pointCount: c.matchedPoints.length || c.pointCount,
          group: '', standalone: true, matchedPoints: c.matchedPoints,
        };
      });
    }
    return rows;
  },

  /** 折叠行：同一编码再点收起；搜索命中的只展示命中条目，其余入口展示全章条目。 */
  toggleChapter(e) {
    const code = e.currentTarget.dataset.code;
    if (this.data.openCode === code) {
      this.setData({ openCode: '' });
      return;
    }
    const view = E.syllabusChapter(code, this.data.exam);
    if (!view) return;
    const row = this.data.rows.filter(function (r) { return r.code === code; })[0];
    const use = (row && row.matchedPoints && row.matchedPoints.length)
      ? row.matchedPoints : view.points;
    const titles = Object.keys(view.titles || {}).map(function (x) {
      return { exam: x, title: view.titles[x] };
    });
    this.setData({
      openCode: code,
      detail: {
        code: view.code,
        title: view.title,
        pointCount: use.length,
        points: use,
        notes: view.notes,
        standalone: view.standalone,
        allTitles: titles,
      },
    });
  },
});
