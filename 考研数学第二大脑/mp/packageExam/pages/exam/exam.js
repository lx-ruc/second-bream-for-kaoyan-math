/**
 * 真题详情页(分包):题干 + 答案 + 完整解析。
 *
 * 入参 vol/y/o(卷|年|题号,与 exams 坐标、findOriginal 返回值同口径)。
 * qbank 在分包里,主包页面只负责跳转过来——主包不能 require 分包模块,
 * 反方向(分包 require 主包 data/kp.js)没有限制。
 * 答案与解析默认折叠:这一页是拿来刷题的,不是拿来抄的。
 */
const QBANK = require('../../data/qbank.js');
const KP_DATA = require('../../../data/kp.js');

const VOL_NAME = { '1': '数学一', '2': '数学二', '3': '数学三' };
const T_NAME = { '选': '选择题', '填': '填空题', '解': '解答题' };

Page({
  data: {
    found: false,
    label: '',
    kpName: '',
    typeSc: '',
    stem: '',
    ans: '',
    sol: '',
    reveal: false,
    fams: [],
    jjUrl: '',
  },

  onLoad(options) {
    const vol = options.vol || '';
    const y = parseInt(options.y, 10) || 0;
    const o = parseInt(options.o, 10) || 0;
    const q = QBANK[vol + '|' + y + '|' + o];

    let node = null;
    if (q && q.kp) {
      const byId = {};
      KP_DATA.nodes.forEach(function (n) { byId[n.id] = n; });
      node = byId[q.kp] || null;
    }

    this.setData({
      found: !!q,
      label: y + ' ' + (VOL_NAME[vol] || '') + ' 第' + o + '题',
      kpName: node ? node.name : (options.kpName || ''),
      typeSc: options.t && T_NAME[options.t] ? T_NAME[options.t] + (options.sc ? ' · ' + options.sc + ' 分' : '') : (options.sc ? options.sc + ' 分' : ''),
      stem: q ? q.s : '',
      ans: q ? q.a : '',
      sol: q ? q.sol : '',
      fams: node && node.fam[vol] ? node.fam[vol] : [],
      jjUrl: node && node.jj[vol] ? node.jj[vol].u : '',
    });

    wx.setNavigationBarTitle({ title: this.data.kpName || '真题' });
  },

  reveal() {
    this.setData({ reveal: true });
  },

  copyUrl() {
    if (!this.data.jjUrl) {
      wx.showToast({ title: '这个考点还没有精讲', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.jjUrl,
      success: function () {
        wx.showToast({ title: '链接已复制，去腾讯文档打开', icon: 'none' });
      },
    });
  },
});
