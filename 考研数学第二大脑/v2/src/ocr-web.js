/**
 * 网页端图像识别（浏览器直连云网关）。
 *
 * 为什么网页端能免密钥调模型：网关按 Origin 放行，`file://` 打开时 Origin 是 null，
 * localhost 也放行，所以单文件离线版双击就能跑识别，不需要后端中转。
 * （2026-11-09 实测：Origin: null / http://localhost:3000 均 200，任意其它来源 403。）
 *
 * 与非浏览器端一致的设计：识别只做**检索**，不做阅读。
 * 公式转写精度撑不起「把题面读给你看」，但撑得起「在 1224 道真题里认出这是哪一道」。
 * 命中之后用库里的标准题干替换，识别错字全部丢弃。
 */

// 网关只接受 stream:true —— 非流式一律 request_invalid_parameter（实测）。所以必须走 SSE。
const ENDPOINT = "https://mp-api.app.workbuddy.host/.cloud/llm/chat/completions";
const KEY = "wbpk_0O2obdqnkhk3o0ON9v837l_n7TVBndWZ7dYTiswWl6HrZcyvaFdkF31";
const MODEL = "glm-5.3-flash";
const PRICE_URL = "https://mp-api.app.workbuddy.host/.cloud/llm/models";
const MODEL_CACHE = "ekb.ocr.model.v1";

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

/* ---------------- 图片预处理 ---------------- */

/** 等比缩到长边 maxSide，再按质量导出 JPEG。原图动辄几 MB，base64 之后更大，直接喂会超时。 */
function shrink(file, maxSide, quality) {
  maxSide = maxSide || 1600;
  quality = quality || 0.85;
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', quality));
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('图片读不出来，换一张试试'));
    };
    img.src = url;
  });
}

/* ---------------- SSE 流式读取 ---------------- */

function readDataUrl(url) {
  const i = url.indexOf(',');
  return url.slice(i + 1);
}

async function callModel(dataUrl, extraHint) {
  const userText = extraHint
    ? '把这道题的题面转写成规定格式的 JSON。用户补充说明（以此为准）：' + extraHint
    : '把这道题的题面转写成规定格式的 JSON。';
  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wb-webapp-access-key': KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messages,
      stream: true,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch (e) { /* 忽略 */ }
    const err = new Error('HTTP ' + res.status + (detail ? ' · ' + detail : ''));
    err.status = res.status;
    throw err;
  }

  // 逐行读 SSE。read 可能把一行切成两半，所以必须留残留缓冲。
  const reader = res.body.getReader();
  const dec = new TextDecoder('utf-8');
  let buf = '';
  let text = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line || line.charAt(0) === ':') continue;
      if (line.indexOf('data:') !== 0) continue;
      const body = line.slice(5).trim();
      if (body === '[DONE]') return text;
      let d;
      try { d = JSON.parse(body); } catch (e) { continue; }
      if (d.error) throw new Error(d.error.message || d.error.code || '模型返回错误');
      const ch = d.choices && d.choices[0] && d.choices[0].delta;
      if (ch && ch.content) text += ch.content;
    }
  }
  return text;
}

/* ---------------- 文本清洗（与小程序同口径） ---------------- */

const LATEX_SYM = {
  leq: '≤', le: '≤', leqslant: '≤', geq: '≥', ge: '≥', geqslant: '≥',
  neq: '≠', ne: '≠', approx: '≈', equiv: '≡', infty: '∞', cdot: '·',
  times: '×', div: '÷', pm: '±', to: '→', rightarrow: '→', Rightarrow: '⇒',
  in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', emptyset: '∅',
  forall: '∀', exists: '∃', partial: '∂', int: '∫', iint: '∬', iiint: '∭',
  oint: '∮', sum: '∑', prod: '∏', cdots: '⋯', ldots: '…', dots: '…',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ',
  psi: 'ψ', omega: 'ω', Omega: 'Ω', Delta: 'Δ', Sigma: 'Σ', Lambda: 'Λ',
  lim: 'lim', sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec',
  csc: 'csc', arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
  ln: 'ln', log: 'log', exp: 'exp', max: 'max', min: 'min', sup: 'sup',
  inf: 'inf', det: 'det', rank: 'rank', tr: 'tr', grad: 'grad',
};
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ' };
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ' };

function toScript(body, table) {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const ch = table[body[i]];
    // 转不了必须加空格，否则 \lim_{x\to1} 会粘成 \limx，整条命令作废
    if (!ch) return ' ' + body + ' ';
    out += ch;
  }
  return out;
}

function delatex(s) {
  let t = s || '';
  t = t.replace(/\\[()\[\]]/g, '');
  t = t.replace(/\$\$?/g, '');
  ['text', 'mathrm', 'mathbb', 'mathbf', 'mathcal', 'operatorname', 'overline', 'underline']
    .forEach(function (name) {
      t = t.replace(new RegExp('\\\\' + name + '\\s*\\{([^{}]*)\\}', 'g'), '$1');
    });
  t = t.replace(/\\(?:left|right|big|Big|bigl|bigr|Bigl|Bigr)\s*/g, '');
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\^\{([^{}]*)\}/g, function (_, b) { return toScript(b, SUP); });
    t = t.replace(/_\{([^{}]*)\}/g, function (_, b) { return toScript(b, SUB); });
  }
  t = t.replace(/\^([0-9])(?![0-9])/g, function (_, b) { return toScript(b, SUP); });
  t = t.replace(/_([0-9a-zA-Z])(?![0-9a-zA-Z])/g, function (_, b) { return toScript(b, SUB); });
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  }
  t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, '($2)^(1/$1)');
  t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  t = t.replace(/\\[,;:! ]/g, ' ');
  t = t.replace(/\\([a-zA-Z]+)/g, function (m, name) {
    return Object.prototype.hasOwnProperty.call(LATEX_SYM, name) ? LATEX_SYM[name] : '';
  });
  return t.replace(/[{}]/g, '').replace(/\\(?![a-zA-Z])/g, '');
}

/**
 * 试卷元信息噪声。这些字不是题目的一部分，留着只会稀释相似度：
 * 实测同一道题，「带元信息」的相似度 0.615，「带元信息 + 12% 漏字」掉到 0.545，
 * 刚好压到阈值 0.55 下面 → 明明认出来了却判「没认出来」。所以必须清。
 *
 * 顺序有意义：带括号的整块必须先删，否则括号里的年份被单独删掉后，
 * 会留下一个孤零零的半边括号和逗号，拼出新噪声。
 */
const NOISE = [
  // (2022 年 数学一 第 15 题,10 分) —— 最常见形态，整块带括号
  /[（(][^)）\n]{0,10}\d{4}\s*年[^)）\n]{0,24}[)）]/g,
  // 2022 年全国硕士研究生招生考试数学（一）试题
  /\d{4}\s*年\s*(?:全国硕士研究生招生考试|硕士研究生入学考试)?\s*数学\s*[（(]?\s*[一二三]\s*[)）]?\s*(?:试题|真题)?/g,
  // 数学一 第 15 题
  /数学\s*[（(]?\s*[一二三]\s*[)）]?\s*第\s*\d+\s*题/g,
  // (10 分) （10分）
  /[（(]\s*\d{1,3}\s*分\s*[)）]/g,
  // ,10 分（后接行尾或句号）
  /[,，、]\s*\d{1,3}\s*分\s*(?=[\n。]|$)/g,
  // 分值孤零零挂在行尾
  /\s\d{1,3}\s*分\s*$/g,
  // ---- 原有规则 ----
  /（本题满分\s*\d+\s*分）/g, /\(\s*本题满分\s*\d+\s*分\s*\)/g,
  /第\s*\d+\s*页\s*(共\s*\d+\s*页)?/g, /共\s*\d+\s*页/g,
  /^\s*第\s*\d+\s*题[:：.、]?\s*/gm, /^\s*[（(]\s*\d+\s*[）)]\s*/gm,
  /^\s*\d+\s*[、.．]\s*/gm,
  /微信公众号[^\n]{0,20}/g, /扫码[^\n]{0,15}/g, /关注[^\n]{0,10}公众号/g,
  /小红书[^\n]{0,12}/g, /知乎[^\n]{0,12}/g,
];

function clean(s) {
  let t = delatex(s || '');
  t = t.replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  t = t.replace(/\u3000/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&le;/g, '≤').replace(/&ge;/g, '≥')
       .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  NOISE.forEach(function (re) { t = t.replace(re, ' '); });
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

/** 从模型输出里抠 JSON。模型偶尔带前后废话，不能直接 parse。 */
function parsePayload(raw) {
  let t = (raw || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch (e) { /* 继续 */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) { /* 继续 */ }
  }
  // 完全不是 JSON：整段当题面，至少还能拿去匹配
  return { stem: t, subject: '不确定', kind: '不确定', confidence: 0.3, note: '返回格式异常，已按纯文本处理' };
}

/* ---------------- 主流程 ---------------- */

/**
 * @param {File} file 用户选的图片
 * @param {function} onStage 阶段回调（'compress' | 'upload'），用于更新界面文案
 * @param {string} hint 用户补充的纠错说明
 * @returns {Promise<{stem:string, subject:string, kind:string, confidence:number, note:string, model:string, preview:string}>}
 */
async function recognize(file, onStage, hint) {
  if (onStage) onStage('compress');
  const dataUrl = await shrink(file, 1600, 0.85);
  if (readDataUrl(dataUrl).length > 3 * 1024 * 1024) {
    throw new Error('图片太大了，换张截图或重拍');
  }
  if (onStage) onStage('upload');
  const raw = await callModel(dataUrl, hint);
  const p = parsePayload(raw);
  return {
    stem: clean(p.stem || ''),
    subject: p.subject || '不确定',
    kind: p.kind || '不确定',
    formulaHeavy: p.formula_heavy === true,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
    note: p.note || '',
    model: MODEL,
    preview: dataUrl,
  };
}

/** 模型清单：只用来给界面显示「视觉可用」，失败不影响识别 */
async function listModels() {
  try {
    const cached = sessionStorage.getItem(MODEL_CACHE);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* 忽略 */ }
  const res = await fetch(PRICE_URL, { headers: { 'x-wb-webapp-access-key': KEY } });
  if (!res.ok) throw new Error('模型清单拿不到');
  const list = await res.json();
  try { sessionStorage.setItem(MODEL_CACHE, JSON.stringify(list)); } catch (e) { /* 忽略 */ }
  return list;
}

window.OCR = { recognize: recognize, clean: clean, delatex: delatex, parsePayload: parsePayload, listModels: listModels, MODEL: MODEL };
