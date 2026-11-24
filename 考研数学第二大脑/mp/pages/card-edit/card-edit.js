/**
 * 知识卡录入 / 查看 / 编辑。
 * 五类卡切换；wrong 卡必须有迁移规则（skill 质量线），未填可强制保存但标注未完成。
 * 编辑走 cards.update：正文逐节追加新段落，不覆盖用户已有段落。
 */
const C = require('../../utils/cards.js');

function sectionsOf(type, prev) {
  return C.BODY_SECTIONS[type].map(function (key) {
    let value = '';
    if (prev && Array.isArray(prev)) {
      const hit = prev.filter(function (s) { return s.key === key; })[0];
      if (hit) value = hit.value || '';
    }
    return { key: key, title: key === '我的做法卡点' ? '我的做法 / 卡在哪一步' : key, value: value };
  });
}

function freshState() {
  return {
    id: '',
    isNew: true,
    type: 'wrong',
    title: '',
    tagsText: '',
    errorType: C.ERROR_TYPES[0],
    source: '',
    era: C.DEFAULT_ERA || 'post2021',
    examType: '',
    difficulty: 3,
    migration: '',
    sections: sectionsOf('wrong'),
    hint: '',
    savedId: '',
    exportPath: '',
    incomplete: false,
  };
}

Page({
  // 扁平字面量：scripts/check.js 只从 data 字面量收集根字段，不能拆成 Object.assign。
  data: {
    today: '',
    id: '',
    isNew: true,
    type: 'wrong',
    title: '',
    tagsText: '',
    errorType: '思路缺失',
    source: '',
    era: 'post2021',
    examType: '',
    difficulty: 3,
    migration: '',
    sections: [],
    hint: '',
    savedId: '',
    exportPath: '',
    incomplete: false,
    types: [],
    errorTypes: [],
    eras: [],
    difficulties: [],
  },

  onLoad(q) {
    let state = Object.assign({
      today: C.todayStr(),
      types: C.TYPES.map(function (k) { return { k: k, n: C.TYPE_NAMES[k] }; }),
      errorTypes: C.ERROR_TYPES.slice(),
      eras: [
        { k: 'post2021', n: '现行（2021 起，22 题结构）' },
        { k: 'pre2021', n: '早年（2020 及以前，23 题结构）' },
      ],
      difficulties: [1, 2, 3, 4, 5],
    }, freshState());
    const id = q && q.id;
    if (id) {
      const card = C.load().filter(function (c) { return c.id === id; })[0];
      if (card) {
        state = Object.assign(state, {
          id: card.id,
          isNew: false,
          type: card.type,
          title: card.title,
          tagsText: (card.tags || []).join('、'),
          errorType: card.error_type || C.ERROR_TYPES[0],
          source: card.source === C.PLACEHOLDER ? '' : card.source,
          era: card.era,
          examType: card.exam_type === C.PLACEHOLDER ? '' : card.exam_type,
          difficulty: card.difficulty,
          migration: card.migration || '',
          sections: sectionsOf(card.type, null).map(function (s) {
            return { key: s.key, title: s.title, value: (card.body && card.body[s.key]) || '' };
          }),
          incomplete: !!card.incomplete,
        });
      }
    }
    this.setData(state);
  },

  pickType(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ type: k, sections: sectionsOf(k, this.data.sections) });
  },

  pickError(e) {
    this.setData({ errorType: e.currentTarget.dataset.v });
  },

  pickDifficulty(e) {
    this.setData({ difficulty: parseInt(e.currentTarget.dataset.n, 10) });
  },

  pickEra(e) {
    this.setData({ era: e.currentTarget.dataset.k });
  },

  onInput(e) {
    const patch = {};
    patch[e.currentTarget.dataset.f] = e.detail.value;
    this.setData(patch);
  },

  onSection(e) {
    const key = e.currentTarget.dataset.k;
    const value = e.detail.value;
    const sections = this.data.sections.map(function (s) {
      return s.key === key ? { key: s.key, title: s.title, value: value } : s;
    });
    this.setData({ sections: sections });
  },

  onMigration(e) {
    this.setData({ migration: e.detail.value });
  },

  form() {
    const d = this.data;
    const body = {};
    d.sections.forEach(function (s) { body[s.key] = s.value; });
    return {
      type: d.type,
      title: d.title,
      tags: d.tagsText,
      error_type: d.errorType,
      source: d.source,
      era: d.era,
      difficulty: d.difficulty,
      exam_type: d.examType,
      body: body,
      migration: d.migration,
    };
  },

  onSave() {
    const d = this.data;
    const form = this.form();
    const bad = C.invalidTags(form.tags);
    if (bad.length) {
      this.setData({ hint: '标签格式待核对：' + bad.join('、') + '（H2.3 / L5 / P7 形式，系统不替你推断编码）' });
    } else {
      this.setData({ hint: '' });
    }
    if (!d.isNew && d.id) {
      const card = C.update(d.id, form);
      if (!card) { wx.showToast({ title: '这张卡已不存在', icon: 'none' }); return; }
      this.setData({
        migration: card.migration || '',
        incomplete: !!card.incomplete,
        hint: card.incomplete
          ? '没有迁移规则的错题卡视为未完成（已标注）。补上规则再保存即可。'
          : (bad.length ? this.data.hint : '已追加新段落，原有正文未被覆盖。'),
      });
      wx.showToast({ title: '已保存' });
      return;
    }
    if (form.type === 'wrong' && !form.migration.trim()) {
      const self = this;
      wx.showModal({
        title: '没有迁移规则的错题卡视为未完成',
        content: '只抄答案不算复盘。可以不填先存，这张卡会标注「未完成」，之后补上规则即可。',
        confirmText: '仍然保存',
        cancelText: '回去补',
        success: function (res) { if (res.confirm) self.doAdd(true); },
      });
      return;
    }
    this.doAdd(true);
  },

  doAdd(force) {
    const form = this.form();
    const card = C.add(form);
    this.setData({
      id: card.id,
      isNew: false,
      savedId: card.id,
      incomplete: !!card.incomplete,
      hint: card.incomplete
        ? '没有迁移规则的错题卡视为未完成（已标注）。之后补上规则即可。'
        : '已保存：' + card.id + ' · 首次复习 ' + card.next_review,
    });
    if (force && wx.showToast) wx.showToast({ title: '已保存' });
  },

  onExport() {
    if (!this.data.id) { wx.showToast({ title: '先保存卡片', icon: 'none' }); return; }
    const file = C.exportOne(this.data.id);
    if (!file) { wx.showToast({ title: '卡片不存在', icon: 'none' }); return; }
    this.setData({ exportPath: file });
    wx.setClipboardData({ data: file });
  },

  onNew() {
    this.setData(Object.assign({ today: C.todayStr() }, freshState()));
  },
});
