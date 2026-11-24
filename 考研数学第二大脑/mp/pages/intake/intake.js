const E = require('../../utils/engine.js');
const S = require('../../utils/store.js');
const IMG = require('../../utils/img.js');
const OCR = require('../../utils/ocr.js');
// 启发层的判据/权重/阈值/免责声明（skill assessment-rubric.json 原样转录）
const RUBRIC = require('../../data/rubric.js');

const VOLS = [
  { k: '1', n: '数学一' },
  { k: '2', n: '数学二' },
  { k: '3', n: '数学三' },
];

// 来源顺序就是界面上的按钮顺序：拍照最常用，其次是手机截图
const SOURCES = [
  { k: 'camera', n: '拍照' },
  { k: 'album', n: '相册截图' },
  { k: 'message', n: '微信图片' },
];

Page({
  data: {
    vols: VOLS,
    sources: SOURCES,
    vol: '1',

    // 图片
    imgPath: '',
    imgName: '',
    busy: '',
    busyText: '',

    // 登录态。null = 还不知道（onShow 里异步填），false 时识题需要先登录
    loggedIn: null,
    needLogin: false,
    loggingIn: false,

    // 识别结果
    ocr: null,
    original: null,
    practice: null,
    showOcrText: false,
    showPaste: false,

    // 题干与考点
    text: '',
    cands: [],
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

    // F1–F6 启发层：事实层（practice 四带）优先，本区可推翻、仅供参考
    assessFlags: [],
    assessTag: '',
    assessFormat: '解答',
    assessFormats: Object.keys(RUBRIC.default_minutes || {}),
    assessDefaults: RUBRIC.default_minutes || {},
    assessMinutes: '',
    assess: null,
    flagsNote: '',
    showRubric: false,
    rubricRows: (RUBRIC.dimensions || []).map(function (d) {
      return { key: d.key, name: d.name, weight: d.weight, origin: d.origin };
    }),
    rubricSummary: '阈值：值得做 ' + RUBRIC.thresholds.worth_score +
      ' / 可选 ' + RUBRIC.thresholds.optional_score +
      ' / 贴近度硬线 ' + RUBRIC.thresholds.hard_fidelity +
      ' / 值得做贴近度 ' + RUBRIC.thresholds.worth_fidelity +
      '；' + RUBRIC.value_formula + '；' + RUBRIC.coverage_formula,
  },

  async onLoad() {
    const last = wx.getStorageSync('ekb.vol') || '1';
    this.setData({ vol: last, pickerNames: this.namesOf(last) });
    // 清掉没人引用的旧图，避免本地空间被照片撑满
    IMG.prune(S.load().map(function (r) { return r.img; }));
  },

  async onShow() {
    // 从官方授权小程序回跳后，onShow 会再触发一次。先等 app.js 把授权码换成会话，
    // 再读登录态 —— 不等的话读到的是换票前的旧状态，登录成功后还会显示「需要登录」。
    const app = getApp();
    if (app && app.authReady) {
      await app.authReady;
    }
    // 必须在 refreshLogin 之前记下来：refreshLogin 会把 needLogin 清掉，
    // 之后再读就永远是 false，识别永远续不上。
    const wasBlocked = this.data.needLogin && !!this.data.imgPath;
    await this.refreshLogin();
    // 带着图回来、且刚才卡在「需要登录」上：登录成功就直接把识别续上，别让用户再点一次
    if (wasBlocked && this.data.loggedIn) {
      this.reOcr();
    }
  },

  async refreshLogin() {
    const ok = await OCR.isLoggedIn();
    // 未登录且没图时不打扰：只有真要识题才提示
    this.setData({ loggedIn: ok, needLogin: ok ? false : this.data.needLogin });
  },

  namesOf(v) {
    return E.listByVol(v).map(function (x) {
      return x.name + '（近六年 ' + x.n6 + ' 次）';
    });
  },

  /* ---------- 科目 ---------- */
  onVol(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.vol) return;
    wx.setStorageSync('ekb.vol', v);
    this.setData({
      vol: v, kpId: '', kpName: '', kpInfo: null, fams: [],
      famN: null, masteryIdx: -1, verdict: null, saved: false,
      pickerNames: this.namesOf(v), original: null,
      // 换卷后事实层必须重算：旧 band 不能配新卷种的启发层
      practice: null, assess: null, assessFlags: [], flagsNote: '',
    });
    // 换科目后重新按新科目找原题
    if (this.data.text) this.rematch();
  },

  /* ---------- 拍照 / 截图 / 微信图片 ---------- */
  onShoot(e) {
    this.shoot(e.currentTarget.dataset.src);
  },

  async shoot(source) {
    if (this.data.busy) return;
    let temp = '';
    try {
      temp = await IMG.pick(source);
    } catch (err) {
      const msg = (err && err.errMsg) || '';
      if (msg.indexOf('cancel') < 0) {
        wx.showToast({ title: '没拿到图片', icon: 'none' });
      }
      return;
    }
    if (!temp) return;

    this.setData({ busy: 'ocr', busyText: '正在处理图片…', saved: false });
    const small = await IMG.compress(temp);
    const name = await IMG.persist(small);
    this.setData({ imgPath: small, imgName: name });

    this.setData({ busyText: '正在识别题面…' });
    try {
      const r = await OCR.recognize(small);
      this.applyOcr(r);
    } catch (err) {
      this.onOcrFail(err);
    }
  },

  /** 同一张图重试识别，不用重拍 */
  async reOcr() {
    const p = this.data.imgPath;
    if (!p || this.data.busy) return;
    this.setData({ busy: 'ocr', busyText: '正在重新识别…' });
    try {
      const r = await OCR.recognize(p);
      this.applyOcr(r);
    } catch (err) {
      this.onOcrFail(err);
    }
  },

  /**
   * 识别失败。未登录是特殊的一种：toast 一闪就没了，用户不知道该干什么，
   * 所以把图留住、亮出「登录后识别」按钮，而不是让他以为图拍坏了。
   */
  onOcrFail(err) {
    const code = (err && err.code) || '';
    this.setData({ busy: '' });
    if (code === 'login_required') {
      this.setData({ needLogin: true, loggedIn: false });
      return;
    }
    const msg = OCR.mapError(err);
    if (msg) wx.showToast({ title: msg, icon: 'none' });
  },

  /** 用户点「登录后识别」。只能由按钮触发，不能在 onShow 里自动拉起授权 */
  async onLogin() {
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true });
    const { error } = await OCR.signIn('pages/intake/intake');
    this.setData({ loggingIn: false });
    // cancelled = 用户在微信跳转弹窗上点了取消，不算错，保留按钮让他重试
    if (error && error.code !== 'cancelled') {
      wx.showToast({ title: error.message || '登录没成功，再试一次', icon: 'none' });
    }
    // 成功只代表「已跳到授权页」。会话由 app.js onShow 的回调建立，
    // 回到本页时 onShow 会刷新登录态并自动续上识别 —— 这里不做任何假设。
  },

  /** 识别完就自动走一遍匹配；命中原题则预选考点 */
  applyOcr(r) {
    const text = r.stem || '';
    const cands = text ? E.matchStem(text) : [];
    const orig = text ? E.findOriginal(text, this.data.vol) : null;
    const practice = text ? E.practiceValue(text, this.data.vol) : null;
    const shown = Object.assign({}, r, {
      confPct: Math.round((r.confidence || 0) * 100),
    });

    this.setData({
      busy: '',
      ocr: shown,
      cands: cands,
      original: orig,
      practice: practice,
      text: text,
      showOcrText: false,
      kpId: '', kpName: '', kpInfo: null, fams: [], famN: null,
      masteryIdx: -1, verdict: null, saved: false,
    });
    this.initAssess(practice);

    if (!text) {
      wx.showToast({ title: '没认出文字，换张清晰点的', icon: 'none' });
      return;
    }
    // 高置信才预选；中等置信交给用户点，避免认错了没人发现
    if (orig && orig.sim >= 70) {
      this.loadKp(orig.kp);
    }
  },

  /* ---------- 题干 ---------- */
  onInput(e) {
    this.setData({ text: e.detail.value });
  },

  rematch() {
    const t = (this.data.text || '').trim();
    if (t.length < 8) return;
    const cands = E.matchStem(t);
    const orig = E.findOriginal(t, this.data.vol);
    const practice = E.practiceValue(t, this.data.vol);
    this.setData({ cands: cands, original: orig, practice: practice });
    this.initAssess(practice);
  },

  doMatch() {
    const t = (this.data.text || '').trim();
    if (t.length < 8) {
      wx.showToast({ title: '题干太短了，再多写一点', icon: 'none' });
      return;
    }
    this.setData({ matching: true });
    setTimeout(() => {
      this.rematch();
      this.setData({ matching: false });
      if (!this.data.cands.length) {
        wx.showToast({ title: '没匹配上，手动选考点', icon: 'none' });
      }
    }, 30);
  },

  pickCand(e) {
    this.loadKp(e.currentTarget.dataset.kp);
  },

  useOriginal() {
    const o = this.data.original;
    if (!o) return;
    this.setData({ text: o.stem });
    this.loadKp(o.kp);
  },

  /** 跳到真题详情页（分包）：题干自己想过一遍再看答案与解析，顺序不能反 */
  goExam() {
    const o = this.data.original;
    if (!o) return;
    wx.navigateTo({
      url: '/packageExam/pages/exam/exam?vol=' + o.vol + '&y=' + o.y + '&o=' + o.o +
        '&kpName=' + encodeURIComponent(o.kpName || ''),
    });
  },

  /** 刷题价值卡 → 看最接近的那道真题的解析 */
  goPracticeExam() {
    const p = this.data.practice;
    if (!p) return;
    wx.navigateTo({
      url: '/packageExam/pages/exam/exam?vol=' + p.vol + '&y=' + p.y + '&o=' + p.o +
        '&kpName=' + encodeURIComponent(p.kpName || ''),
    });
  },

  /* ---------- F1–F6 启发层（事实层优先，可推翻） ---------- */
  /**
   * 初始勾法只按 practice.band 给建议，绝不冒充「模型读过题」的结论：
   * exam → 全 1；worth → F1/F2/F5=1；edge/skip → 全 0（拿不准判 0）。
   */
  initAssess(practice) {
    if (!practice) {
      this.setData({ assess: null, assessFlags: [], flagsNote: '' });
      return;
    }
    const presets = { exam: [1, 1, 1, 1, 1, 1], worth: [1, 1, 0, 0, 1, 0] };
    const init = presets[practice.band] || [0, 0, 0, 0, 0, 0];
    const flags = (RUBRIC.fidelity || []).map(function (f, i) {
      return { code: f.code, name: f.name, desc: f.desc, on: init[i] || 0 };
    });
    const note = (practice.band === 'edge' || practice.band === 'skip')
      ? '拿不准判 0：六条里没把握的先不勾，判据可逐条改。'
      : '这是按真题分带给的初始建议，不是模型读题的结论；勾哪些由你定。';
    this.setData({ assessFlags: flags, flagsNote: note });
    this.refreshAssess();
  },

  /** 每次勾选/题型/耗时/编码变化都重算一遍，结果只由可见参数决定 */
  refreshAssess() {
    const d = this.data;
    if (!d.practice) { this.setData({ assess: null }); return; }
    const minutes = Number(d.assessMinutes);
    this.setData({
      assess: E.assessValue({
        examType: d.vol,
        tags: d.assessTag,
        format: d.assessFormat,
        minutes: (isFinite(minutes) && minutes > 0) ? minutes : undefined,
        fidelity: d.assessFlags.map(function (f) { return f.on; }),
        practiceBand: d.practice.band,
      }),
    });
  },

  toggleFlag(e) {
    const i = Number(e.currentTarget.dataset.i);
    const flags = this.data.assessFlags.map(function (f, idx) {
      return idx === i ? { code: f.code, name: f.name, desc: f.desc, on: f.on ? 0 : 1 } : f;
    });
    this.setData({ assessFlags: flags });
    this.refreshAssess();
  },

  onAssessTag(e) {
    this.setData({ assessTag: e.detail.value });
    this.refreshAssess();
  },

  onAssessMinutes(e) {
    this.setData({ assessMinutes: e.detail.value });
    this.refreshAssess();
  },

  pickAssessFormat(e) {
    this.setData({ assessFormat: e.currentTarget.dataset.f });
    this.refreshAssess();
  },

  toggleRubric() {
    this.setData({ showRubric: !this.data.showRubric });
  },

  toggleOcrText() {
    this.setData({ showOcrText: !this.data.showOcrText });
  },

  togglePaste() {
    this.setData({ showPaste: !this.data.showPaste });
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
    // 用户改选了别的考点，说明原题命中是错的：不能再拿那道题的题干存进去
    if (this.data.original && this.data.original.kp !== kpId) {
      this.setData({ original: null });
    }
  },

  /* ---------- 思路族 ---------- */
  pickFam(e) {
    this.setData({ famN: Number(e.currentTarget.dataset.n) });
    this.refresh();
  },

  pickNone() {
    this.setData({ famN: 0 });
    this.refresh();
  },

  /* ---------- 掌握度 ---------- */
  pickLevel(e) {
    this.setData({ masteryIdx: Number(e.currentTarget.dataset.i) });
    this.refresh();
  },

  refresh() {
    const d = this.data;
    if (!d.kpId) return;
    const hasFam = d.fams.length > 0;
    if (hasFam && d.famN === null) return this.setData({ verdict: null });
    if (!hasFam && d.masteryIdx < 0) return this.setData({ verdict: null });
    this.setData({ verdict: E.judge(d.kpId, d.vol, hasFam ? d.famN : null) });
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
      // 有原题就存原题的题干，不要存识别出来的乱码
      stem: (d.original ? d.original.stem : (d.text || '')).slice(0, 600),
      img: d.imgName || '',
      src: d.imgName ? 'photo' : 'text',
      ocrSim: d.original ? d.original.sim : 0,
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
      imgPath: '', imgName: '', ocr: null, original: null,
      practice: null, assess: null, assessFlags: [], assessTag: '',
      assessMinutes: '', flagsNote: '', showRubric: false,
      showOcrText: false, busy: '',
      // 登录提示是跟着那张图来的，图清了提示也该收；loggedIn 是真实登录态，不动
      needLogin: false,
    });
  },

  /** 点缩略图看大图；长按删掉这次拍的图 */
  previewImg() {
    if (!this.data.imgPath) return;
    wx.previewImage({ urls: [this.data.imgPath] });
  },

  goDiagnose() {
    wx.switchTab({ url: '/pages/diagnose/diagnose' });
  },
});
