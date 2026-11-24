/**
 * 五类知识卡：wrong / concept / method / formula / assessment。
 *
 * 规格来源：本地 skill `kaoyan-math-second-brain` 的
 * - references/templates.md（frontmatter 字段、正文骨架、标签/错因/难度/era 枚举）
 * - SKILL.md 工作流 2/3/4（缺失记「待补」不编造；按 tag/错因/全文检索；
 *   间隔 1/3/7/15/30/60 天，答对升级、答错归零；清单按错因聚类→章节→难度）
 *
 * 独立存储 KEY='ekb.cards.v1'：绝不写 store.js 的 'ekb.records.v1'，
 * 两套数据分离，避免污染现有诊断统计。题评卡不进复习清单（skill 硬规则）。
 *
 * level 口径：0 = 归零/新录入，1..6 依次对应 1/3/7/15/30/60 天间隔。
 * 这是本阶段移植的显式裁决：skill 原脚本用 level 0..5 直接索引间隔表；
 * 这里按派单要求把「间隔对应 level 1..6」写清，导出 frontmatter 的 level
 * 可能为 6（60 天档），不再声称与 skill 脚本的 level 数值逐字相同。
 */
const KEY = 'ekb.cards.v1';

const TYPES = ['wrong', 'concept', 'method', 'formula', 'assessment'];
const TYPE_NAMES = {
  wrong: '错题', concept: '知识点', method: '方法', formula: '公式', assessment: '题评',
};
const ERROR_TYPES = ['思路缺失', '概念不清', '计算失误', '审题错误', '公式记错'];
// skill 的「优先安排思路缺失与概念不清」：这两类排在最前，其余按固定错因顺序聚类。
const ERROR_RANK = { '思路缺失': 0, '概念不清': 1, '计算失误': 2, '审题错误': 3, '公式记错': 4 };
const ERAS = ['post2021', 'pre2021'];
// skill brain.py: INTERVALS = [1, 3, 7, 15, 30, 60]
const INTERVALS = [1, 3, 7, 15, 30, 60];
const MAX_LEVEL = INTERVALS.length;
// skill brain.py 缺省 difficulty=3 / era=post2021；不凭空推断具体题目内容。
const DEFAULT_DIFFICULTY = 3;
const DEFAULT_ERA = 'post2021';
// 产品估算（非 skill 原文）：建议用时 3/5/8/12/15 分钟，UI 必须标注「建议用时，自己调整」。
const SUGGEST_MINUTES = [0, 3, 5, 8, 12, 15];

const BODY_SECTIONS = {
  wrong: ['题干要点', '我的做法卡点', '正解关键', '错因归因', '迁移规则', '关联'],
  concept: ['精确表述', '适用条件与反例', '与相邻考点的边界', '常考问法', '我的易错点'],
  method: ['适用信号', '步骤（可执行）', '失效情形', '代表性真题', '关联错题'],
  formula: ['公式', '成立条件 / 收敛域', '记忆锚点', '高频误用'],
  assessment: ['题干要点', '考点拆分', '评分明细', '结论与依据', '替代建议 / 处置', '关联'],
};
// 正文键用短名方便录入，导出时用 templates.md 的原标题（仅这一节有差别）。
const HEADING_OVERRIDE = { '我的做法卡点': '我的做法 / 卡在哪一步' };
// 派单要求的 frontmatter 字段；导出时按此顺序逐项写出，缺值写 null / 待补。
const FM_KEYS = ['id', 'type', 'title', 'tags', 'error_type', 'source', 'era',
  'difficulty', 'exam_type', 'created', 'last_review', 'level', 'next_review'];

const TAG_RE = /^[HLP]\d+(?:\.\d+)?$/i;
const PLACEHOLDER = '待补';

function str(v) {
  return v === undefined || v === null ? '' : String(v);
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function addDays(dateStr, n) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayStr();
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}

function load() {
  try {
    const v = wx.getStorageSync(KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function save(list) {
  try {
    wx.setStorageSync(KEY, Array.isArray(list) ? list : []);
    return true;
  } catch (e) {
    if (wx.showToast) wx.showToast({ title: '卡片保存失败', icon: 'none' });
    return false;
  }
}

function normalizeTags(tags) {
  const arr = Array.isArray(tags) ? tags : str(tags).split(/[,，、\s]+/);
  const out = [];
  arr.forEach((t) => {
    const v = str(t).trim();
    if (v && out.indexOf(v) < 0) out.push(v);
  });
  return out;
}

function invalidTags(tags) {
  return normalizeTags(tags).filter((t) => !TAG_RE.test(t));
}

function normalizeBody(type, body) {
  const keys = BODY_SECTIONS[type] || [];
  const out = {};
  keys.forEach((k) => { out[k] = ''; });
  if (body && typeof body === 'object') {
    keys.forEach((k) => { out[k] = str(body[k]); });
  }
  return out;
}

/** 追加为新段落，不覆盖已有段落（skill 硬规则：不擅自改动用户笔记）。 */
function appendParagraph(oldText, newText) {
  const a = str(oldText).trim();
  const b = str(newText).trim();
  if (!b) return a;
  if (!a || a === b) return a || b;
  return a + '\n\n' + b;
}

function makeId(day, list) {
  const prefix = day.replace(/-/g, '');
  let max = 0;
  (list || []).forEach((c) => {
    const m = new RegExp('^' + prefix + '-(\\d{3})$').exec(str(c && c.id));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + '-' + String(max + 1).padStart(3, '0');
}

function diffValue(v) {
  const n = parseInt(v, 10);
  return n >= 1 && n <= 5 ? n : DEFAULT_DIFFICULTY;
}

/** 质量线：迁移规则为空的错题卡视为未完成。返回问题清单，空数组表示通过。 */
function validate(card) {
  const issues = [];
  if (!card) return ['卡片不存在'];
  if (!str(card.title).trim() || card.title === PLACEHOLDER) issues.push('标题待补');
  if (card.type === 'wrong') {
    if (!str(card.migration).trim()) issues.push('没有迁移规则的错题卡视为未完成');
    if (!str(card.error_type).trim() || card.error_type === PLACEHOLDER) issues.push('错因待补');
  }
  const bad = invalidTags(card.tags);
  if (bad.length) issues.push('标签格式待核对：' + bad.join('、') + '（应为 H2.3 / L5 / P7 形如 H/L/P+数字）');
  return issues;
}

function add(data, dayArg) {
  if (!data || TYPES.indexOf(data.type) < 0) {
    throw new Error('卡片类型须为 ' + TYPES.join('/'));
  }
  const day = dayArg || todayStr();
  const list = load();
  const type = data.type;
  const body = normalizeBody(type, data.body);
  const migration = str(data.migration || body['迁移规则'] || '').trim();
  if (type === 'wrong') body['迁移规则'] = migration;
  const card = {
    id: makeId(day, list),
    type: type,
    title: str(data.title).trim() || PLACEHOLDER,
    tags: normalizeTags(data.tags),
    error_type: type === 'wrong' ? (str(data.error_type).trim() || PLACEHOLDER) : null,
    source: str(data.source).trim() || PLACEHOLDER,
    era: ERAS.indexOf(data.era) >= 0 ? data.era : DEFAULT_ERA,
    difficulty: diffValue(data.difficulty),
    exam_type: str(data.exam_type).trim() || PLACEHOLDER,
    created: day,
    last_review: null,
    level: 0,
    next_review: addDays(day, INTERVALS[0]),
    body: body,
    migration: migration,
    updated: day,
    incomplete: type === 'wrong' && !migration,
  };
  list.unshift(card);
  save(list);
  return card;
}

/** 编辑：简单字段覆盖，正文逐节追加新段落；复习状态（level/last_review/next_review）不由编辑改动。 */
function update(id, patch, dayArg) {
  const list = load();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const prev = list[idx];
  const day = dayArg || todayStr();
  const next = Object.assign({}, prev);
  const type = patch.type && TYPES.indexOf(patch.type) >= 0 ? patch.type : prev.type;

  next.type = type;
  next.body = normalizeBody(type, prev.body);
  if (patch.title !== undefined) next.title = str(patch.title).trim() || PLACEHOLDER;
  if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags);
  if (patch.error_type !== undefined) next.error_type = type === 'wrong' ? (str(patch.error_type).trim() || PLACEHOLDER) : null;
  if (patch.source !== undefined) next.source = str(patch.source).trim() || PLACEHOLDER;
  if (patch.era !== undefined) next.era = ERAS.indexOf(patch.era) >= 0 ? patch.era : DEFAULT_ERA;
  if (patch.difficulty !== undefined) next.difficulty = diffValue(patch.difficulty);
  if (patch.exam_type !== undefined) next.exam_type = str(patch.exam_type).trim() || PLACEHOLDER;

  if (patch.body && typeof patch.body === 'object') {
    BODY_SECTIONS[type].forEach((k) => {
      if (patch.body[k] !== undefined) next.body[k] = appendParagraph(prev.body && prev.body[k], patch.body[k]);
    });
  }
  const prevMigration = str(prev.migration || (prev.body && prev.body['迁移规则']));
  next.migration = patch.migration === undefined
    ? prevMigration
    : appendParagraph(prevMigration, patch.migration);
  if (type === 'wrong') next.body['迁移规则'] = next.migration;
  next.incomplete = type === 'wrong' && !str(next.migration).trim();
  next.updated = day;
  list[idx] = next;
  save(list);
  return next;
}

function remove(id) {
  const list = load().filter((c) => c.id !== id);
  save(list);
  return list;
}

/** 四种筛选可单独用，也可同时给（取交集）。全文 = 标题 + 来源 + 标签 + 错因 + 所有正文节 + 迁移规则。 */
function query(opts) {
  const o = opts || {};
  const text = str(o.text).trim().toLowerCase();
  return load().filter((c) => {
    if (o.type && c.type !== o.type) return false;
    if (o.tag && (c.tags || []).indexOf(o.tag) < 0) return false;
    if (o.errorType && c.error_type !== o.errorType) return false;
    if (text) {
      const hay = [c.title, c.source, c.error_type, (c.tags || []).join(' '),
        JSON.stringify(c.body || {}), c.migration].join(' ').toLowerCase();
      if (hay.indexOf(text) < 0) return false;
    }
    return true;
  });
}

function minutesFor(difficulty) {
  const n = diffValue(difficulty);
  return SUGGEST_MINUTES[n];
}

function priorityOf(card) {
  if (card.type !== 'wrong') return 5;
  const r = ERROR_RANK[card.error_type];
  return r === undefined ? 4 : r;
}

function firstTag(card) {
  return (card.tags && card.tags[0]) || PLACEHOLDER;
}

/** 今日到期（含逾期），题评卡不占复习位；按错因聚类→章节→难度排序。 */
function dueList(dayArg) {
  const day = dayArg || todayStr();
  return load().filter((c) => c.type !== 'assessment' && str(c.next_review) && c.next_review <= day)
    .sort((a, b) => {
      const d = priorityOf(a) - priorityOf(b);
      if (d) return d;
      const t = firstTag(a).localeCompare(firstTag(b), 'zh-CN');
      if (t) return t;
      const diff = diffValue(b.difficulty) - diffValue(a.difficulty);
      if (diff) return diff;
      return str(a.id).localeCompare(str(b.id));
    })
    .map((c) => Object.assign({}, c, { minutes: minutesFor(c.difficulty) }));
}

/** ok：level+1（上限 6），按新 level 的间隔算下次；again：归零并安排在今天。 */
function markDone(id, ok, dayArg) {
  const day = dayArg || todayStr();
  const list = load();
  const card = list.filter((c) => c.id === id)[0];
  if (!card) return null;
  if (ok) {
    card.level = Math.min(MAX_LEVEL, (parseInt(card.level, 10) || 0) + 1);
    card.next_review = addDays(day, INTERVALS[card.level - 1]);
  } else {
    card.level = 0;
    card.next_review = day;
  }
  card.last_review = day;
  card.updated = day;
  save(list);
  return card;
}

// YAML 值用 JSON.stringify，与 skill brain.py 的 yval() 同口径（中文不转义）。
function yamlVal(v) {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return String(v);
  return JSON.stringify(str(v));
}

/** 按 templates.md 的 frontmatter + 正文骨架导出纯 Markdown（不写文件，便于测试）。 */
function toMarkdown(card) {
  if (!card) return '';
  const tags = normalizeTags(card.tags);
  const fm = [
    '---',
    'id: ' + yamlVal(card.id),
    'type: ' + yamlVal(card.type),
    'title: ' + yamlVal(card.title),
    'tags: [' + tags.join(', ') + ']',
    'error_type: ' + yamlVal(card.error_type),
    'source: ' + yamlVal(card.source),
    'era: ' + yamlVal(card.era),
    'difficulty: ' + yamlVal(diffValue(card.difficulty)),
    'exam_type: ' + yamlVal(card.exam_type),
    'created: ' + yamlVal(card.created),
    'last_review: ' + yamlVal(card.last_review),
    'level: ' + yamlVal(parseInt(card.level, 10) || 0),
    'next_review: ' + yamlVal(card.next_review),
    '---',
  ].join('\n');
  const lines = ['# ' + str(card.title), ''];
  (BODY_SECTIONS[card.type] || []).forEach((k) => {
    let text = k === '迁移规则' ? str(card.migration || (card.body && card.body[k]))
      : str(card.body && card.body[k]);
    if (!text.trim()) text = '（待补）';
    lines.push('## ' + (HEADING_OVERRIDE[k] || k), '', text, '');
  });
  return fm + '\n\n' + lines.join('\n').replace(/\s+$/, '') + '\n';
}

/**
 * 导出到小程序沙盒：USER_DATA_PATH/obsidian/<id>.md。
 * 小程序不能写用户的 Documents/Obsidian vault，只能写沙盒；UI 必须写明这一点。
 */
function exportOne(id) {
  const card = load().filter((c) => c.id === id)[0];
  if (!card) return null;
  const FS = wx.getFileSystemManager();
  const dir = wx.env.USER_DATA_PATH + '/obsidian';
  try { FS.mkdirSync(dir, true); } catch (e) { /* 目录已存在 */ }
  const file = dir + '/' + card.id + '.md';
  FS.writeFileSync(file, toMarkdown(card), 'utf8');
  return file;
}

module.exports = {
  KEY: KEY,
  TYPES: TYPES,
  TYPE_NAMES: TYPE_NAMES,
  ERROR_TYPES: ERROR_TYPES,
  ERAS: ERAS,
  INTERVALS: INTERVALS,
  MAX_LEVEL: MAX_LEVEL,
  DEFAULT_DIFFICULTY: DEFAULT_DIFFICULTY,
  DEFAULT_ERA: DEFAULT_ERA,
  BODY_SECTIONS: BODY_SECTIONS,
  SUGGEST_MINUTES: SUGGEST_MINUTES,
  FM_KEYS: FM_KEYS,
  PLACEHOLDER: PLACEHOLDER,
  todayStr: todayStr,
  addDays: addDays,
  minutesFor: minutesFor,
  invalidTags: invalidTags,
  validate: validate,
  load: load,
  save: save,
  add: add,
  update: update,
  remove: remove,
  query: query,
  dueList: dueList,
  markDone: markDone,
  toMarkdown: toMarkdown,
  exportOne: exportOne,
};
