const E = require('../../utils/engine.js');

Page({
  data: {
    kw: '',
    rows: [],
    total: 0,
    shown: 60,
    all: [],
  },

  onLoad() {
    this.apply('');
  },

  onInput(e) {
    const kw = e.detail.value;
    this.setData({ kw: kw, shown: 60 });
    this.apply(kw);
  },

  apply(kw) {
    const list = E.priorRows(kw).map(function (r) {
      return {
        chap: r.chap,
        pt: r.pt,
        name: r.name,
        fr: r.fr || '—',
        diff: r.diff || '',
        target: r.target || '',
        hot: r.fr && r.fr !== '0.0%' && r.fr !== '—',
      };
    });
    this.setData({ all: list, total: list.length, rows: list.slice(0, this.data.shown) });
  },

  more() {
    const n = this.data.shown + 60;
    this.setData({ shown: n, rows: this.data.all.slice(0, n) });
  },
});
