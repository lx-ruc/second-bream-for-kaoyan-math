/**
 * 识别结果的文本清洗。纯函数，不依赖 wx，可以在 Node 里直接跑测试。
 *
 * 存在意义：模型即使被要求「不要用 LaTeX」，仍会时不时吐出 \dfrac{}{}、$...$、
 * \\left( 这类东西。这些字符一旦流进 2-gram 匹配器，会让本该命中 90% 的题掉到 40%。
 * 所以在进入匹配前必须统一成库里那套 Unicode 写法。
 */

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

function stripFence(s) {
  let t = (s || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return t.trim();
}

/**
 * 全字符都能映射才转成上下标，否则原样返回。
 * 不然 \lim_{x\to 1} 会被拆成半截下标（x 没有下标字符），读起来更糟。
 */
function toScript(body, table) {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const ch = table[body[i]];
    // 转不了就原样返回，但必须加空格：否则去掉花括号后，
    // \lim_{x\to 1} 会粘成 \limx，整个命令被当成未知命令丢掉，lim 就没了。
    if (!ch) return ' ' + body + ' ';
    out += ch;
  }
  return out;
}

/**
 * 粗粒度 LaTeX → Unicode。
 *
 * 处理顺序是错的代价很大，踩过两次：
 * ① 先转 \frac 再转 ^{}，会让 \dfrac{x^{2}-1}{x-1} 的嵌套花括号匹配失败，
 *    输出成 {x²-1}{x-1}；
 * ② 先转 _{} 再转 \to，会让 \lim_{x\to 1} 里的命令被当成普通字符拆掉，输出成 ₁。
 * 所以顺序固定为：剥外层包装 → 上下标 → 分式/根号 → 剩余命令 → 清残留花括号。
 */
function delatex(s) {
  let t = s || '';

  // 1. 数学环境标记
  t = t.replace(/\\[()\[\]]/g, '');
  t = t.replace(/\$\$?/g, '');

  // 2. 只保留内容的外层包装
  ['text', 'mathrm', 'mathbb', 'mathbf', 'mathcal', 'operatorname', 'overline', 'underline']
    .forEach(function (name) {
      const re = new RegExp('\\\\' + name + '\\s*\\{([^{}]*)\\}', 'g');
      t = t.replace(re, '$1');
    });
  t = t.replace(/\\(?:left|right|big|Big|bigl|bigr|Bigl|Bigr)\s*/g, '');

  // 3. 上下标（先做，剥掉花括号，后面的分式才好匹配）
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\^\{([^{}]*)\}/g, function (_, b) { return toScript(b, SUP); });
    t = t.replace(/_\{([^{}]*)\}/g, function (_, b) { return toScript(b, SUB); });
  }

  // 无花括号的简单上下标：x^2 / a_n
  t = t.replace(/\^([0-9])(?![0-9])/g, function (_, b) { return toScript(b, SUP); });
  t = t.replace(/_([0-9a-zA-Z])(?![0-9a-zA-Z])/g, function (_, b) { return toScript(b, SUB); });

  // 4. 分式与根号
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  }
  t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, '($2)^(1/$1)');
  t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');

  // 5. 间距命令换成空格（不能直接删，会把 \varphi\,dr 粘成一个词）
  t = t.replace(/\\[,;:! ]/g, ' ');

  // 6. 剩余命令 → 符号；认不出的直接丢掉
  t = t.replace(/\\([a-zA-Z]+)/g, function (m, name) {
    return Object.prototype.hasOwnProperty.call(LATEX_SYM, name) ? LATEX_SYM[name] : '';
  });

  // 7. 清掉残留花括号和孤立反斜杠
  t = t.replace(/[{}]/g, '').replace(/\\(?![a-zA-Z])/g, '');
  return t;
}

const NOISE = [
  /（本题满分\s*\d+\s*分）/g, /\(\s*本题满分\s*\d+\s*分\s*\)/g,
  /第\s*\d+\s*页\s*(共\s*\d+\s*页)?/g, /共\s*\d+\s*页/g,
  /^\s*第\s*\d+\s*题[:：.、]?\s*/gm, /^\s*[（(]\s*\d+\s*[）)]\s*/gm,
  /^\s*\d+\s*[、.．]\s*/gm,
  /微信公众号[^\n]{0,20}/g, /扫码[^\n]{0,15}/g, /关注[^\n]{0,10}公众号/g,
  /小红书[^\n]{0,12}/g, /知乎[^\n]{0,12}/g,
];

function clean(s) {
  let t = delatex(s || '');
  // 全角数字/字母/符号 → 半角
  t = t.replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  t = t.replace(/\u3000/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&le;/g, '≤').replace(/&ge;/g, '≥').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  NOISE.forEach(function (re) { t = t.replace(re, ' '); });
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return t;
}

/** 从模型输出里抠出 JSON。模型偶尔会带前后废话，不能直接 JSON.parse。 */
function parsePayload(raw) {
  const t = stripFence(raw);
  try {
    return JSON.parse(t);
  } catch (e) { /* 继续 */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) { /* 继续 */ }
  }
  // 完全不是 JSON：整段当题面，至少还能拿去匹配
  return { stem: t, subject: '不确定', kind: '不确定', confidence: 0.3, note: '返回格式异常，已按纯文本处理' };
}

module.exports = {
  stripFence: stripFence,
  delatex: delatex,
  clean: clean,
  parsePayload: parsePayload,
};
