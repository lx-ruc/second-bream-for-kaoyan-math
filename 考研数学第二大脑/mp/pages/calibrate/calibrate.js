/**
 * 题源校准只读报告页（skill 工作流 9）。
 * 本页没有任何写入口：不改 cards、不改 records、不改 rubric 权重。
 * 常驻 skill 原文口径：自选择偏差 + 不是官方命题频率 + 不自动回写权重。
 */
const T = require('../../utils/stats.js');
const S = require('../../utils/store.js');
const C = require('../../utils/cards.js');

Page({
  data: {
    report: null,
    warning: T.CALIBRATE_WARNING,
    note: '',
  },

  onShow() {
    this.setData({
      report: T.calibrate(S.load(), C.load()),
      note: '题评卡不进复习位；做题记录没有题源文本，真题来源分布只取自卡片的 source 字段。',
    });
  },
});
