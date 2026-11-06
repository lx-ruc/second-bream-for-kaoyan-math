/**
 * 拍照识题。
 *
 * 设计前提（决定了整个交互）：
 * 数学公式的识别精度做不到「给用户看」—— 分式、积分上下限、分段函数一旦打散，
 * 用户看到的就是乱码。所以这里的 OCR 不做「读题」，只做「检索」：
 * 只要转写结果够用来匹配真题库，就能用库里的标准题干把乱码盖掉。
 *
 * 于是提示词刻意要求 Unicode 近似（x²、∫₀¹、lim(x→0)）而不是 LaTeX：
 * 一是跟库里 475 道真题的文本形态同口径（同口径才能算相似度），
 * 二是模型少写一层 LaTeX，就少一层出错的面。
 */
const { cloud } = require('./cloud.js');
const IMG = require('./img.js');
const TXT = require('./ocr-text.js');

const MODEL_KEY = 'ekb.ocr.model';
const DAILY_KEY = 'ekb.ocr.calls';
const DAILY_CAP = 80;

const SYSTEM = [
  '你是考研数学题目的录入助手。用户会给你一张题目的照片或截图。',
  '你的任务是把题面转写成纯文本，供后续在真题库里检索。',
  '规则：',
  '1. 只转写题目本身。忽略手写批注、草稿、答案、页码、水印、广告、软件界面。',
  '2. 图中有多道题时，只转写结构最完整的那一道。',
  '3. 公式用 Unicode 近似表达，不要用 LaTeX。例如：x²、x₁、∫₀¹、lim(x→0)、≤、≠、√2、π。',
  '4. 分式写成 a/b，带括号保证不歧义，例如 (x+1)/(x-1)。',
  '5. 不要解题，不要补充原图里没有的条件。',
  '6. 只输出一个 JSON 对象，不要代码块，不要任何解释。',
  'JSON 字段：',
  '{"stem":"题面文本","subject":"数学一|数学二|数学三|不确定","kind":"选择题|填空题|解答题|不确定",',
  ' "formula_heavy":true或false,"confidence":0到1的小数,"note":"图不清晰时说明哪里不确定，否则空字符串"}',
].join('\n');

/* ---------------- 模型 ---------------- */

let _model = null;

async function pickModel() {
  if (_model) return _model;
  const cached = wx.getStorageSync(MODEL_KEY);
  if (cached && cached.id && Date.now() - (cached.ts || 0) < 86400000) {
    _model = cached;
    return _model;
  }
  const list = await cloud.llm.models.list();
  const usable = (list || []).filter(function (m) { return m.disabled !== true; });
  if (!usable.length) {
    const err = new Error('NO_MODEL');
    err.code = 'no_model';
    throw err;
  }
  // 必须能读图；supportsImages 缺省视为未知，排在已知可用之后
  const vision = usable.filter(function (m) { return m.supportsImages === true; });
  const chosen = vision[0] || usable[0];
  _model = { id: chosen.id, name: chosen.name || chosen.id, vision: chosen.supportsImages === true };
  wx.setStorageSync(MODEL_KEY, { id: _model.id, name: _model.name, vision: _model.vision, ts: Date.now() });
  return _model;
}

/* ---------------- 配额自保 ---------------- */

function guardQuota() {
  const today = new Date().toISOString().slice(0, 10);
  const rec = wx.getStorageSync(DAILY_KEY) || {};
  if (rec.day !== today) {
    wx.setStorageSync(DAILY_KEY, { day: today, n: 0 });
    return;
  }
  if ((rec.n || 0) >= DAILY_CAP) {
    const err = new Error('TODAY_LIMIT');
    err.code = 'local_daily_limit';
    throw err;
  }
}

function bumpQuota() {
  const today = new Date().toISOString().slice(0, 10);
  const rec = wx.getStorageSync(DAILY_KEY) || {};
  const n = rec.day === today ? (rec.n || 0) + 1 : 1;
  wx.setStorageSync(DAILY_KEY, { day: today, n: n });
}

/* ---------------- 错误文案 ---------------- */

function mapError(err) {
  const code = (err && err.error && err.error.code) || (err && err.code) || '';
  if (code === 'no_model') return '没有可用的识别模型，稍后再试';
  if (code === 'image_too_large') return '图片太大了，重拍一张或换成截图';
  if (code === 'local_daily_limit') return '今天识别次数用完了，明天再来';
  if (String(code).indexOf('quota_') === 0) return '识别额度已用完，请联系开发者';
  if (String(code).indexOf('auth_') === 0) return '鉴权失败：小程序请求域名未加白名单';
  if (String(code).indexOf('gateway_') === 0 || String(code).indexOf('model_') === 0) return '模型服务暂时不可用，稍后重试';
  if (String(code).indexOf('request_') === 0) return '请求参数不对，换张图试试';
  if (String(code).indexOf('internal_') === 0) return '服务异常，稍后重试';
  const msg = (err && err.errMsg) || (err && err.message) || '';
  if (msg.indexOf('cancel') >= 0) return '';
  return '识别失败，换张图或直接手选考点';
}

/* ---------------- 主流程 ---------------- */

/**
 * @param {string} filePath 图片路径
 * @returns {Promise<{stem:string,subject:string,kind:string,confidence:number,note:string,model:string}>}
 */
async function recognize(filePath) {
  guardQuota();
  const model = await pickModel();
  const b64 = await IMG.toBase64(filePath);
  if (b64.length > 3 * 1024 * 1024) {
    const err = new Error('IMAGE_TOO_LARGE');
    err.code = 'image_too_large';
    throw err;
  }

  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: '把这道题的题面转写成规定格式的 JSON。' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } },
      ],
    },
  ];

  let raw = '';
  const stream = await cloud.llm.chat.completions.create({
    model: model.id,
    messages: messages,
    stream: true,
    temperature: 0.1,
  });
  for await (const chunk of stream) {
    const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
    if (d && d.content) raw += d.content;
  }
  bumpQuota();

  const p = TXT.parsePayload(raw);
  return {
    stem: TXT.clean(p.stem || ''),
    subject: p.subject || '不确定',
    kind: p.kind || '不确定',
    formulaHeavy: p.formula_heavy === true,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
    note: p.note || '',
    model: model.name,
  };
}

module.exports = {
  recognize: recognize,
  pickModel: pickModel,
  mapError: mapError,
  clean: TXT.clean,
  delatex: TXT.delatex,
  parsePayload: TXT.parsePayload,
};
