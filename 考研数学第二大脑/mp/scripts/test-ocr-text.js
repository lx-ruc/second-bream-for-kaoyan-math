/**
 * 识别文本处理与题面匹配的回归测试。
 * 跑法：node scripts/test-ocr-text.js
 *
 * 这些用例对应的是真人会踩的坑，不是凑数：
 * 模型不听话吐 LaTeX、只拍到半道题、题面被 OCR 漏字、返回不是 JSON。
 */
const TXT = require('../utils/ocr-text.js');
const E = require('../utils/engine.js');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = got === want;
  if (ok) pass++; else { fail++; console.log('  ✗', name, '\n     得到:', got, '\n     期望:', want); }
}
function has(name, got, sub) {
  const ok = String(got).indexOf(sub) >= 0;
  if (ok) pass++; else { fail++; console.log('  ✗', name, '\n     得到:', got, '\n     应包含:', sub); }
}
function notHas(name, got, sub) {
  const ok = String(got).indexOf(sub) < 0;
  if (ok) pass++; else { fail++; console.log('  ✗', name, '\n     得到:', got, '\n     不该包含:', sub); }
}

console.log('--- 1. LaTeX 还原 ---');
eq('分式', TXT.clean('$\\dfrac{x^{2}-1}{x-1}$'), '(x²-1)/(x-1)');
eq('上标', TXT.clean('$x^{2}+y^{2}$'), 'x²+y²');
eq('裸上标', TXT.clean('x^2 + a_n'), 'x² + aₙ');
eq('根号', TXT.clean('$\\sqrt{x^{2}+y^{2}}$'), '√(x²+y²)');
notHas('不留反斜杠', TXT.clean('$\\iint_{D}\\sqrt{x^{2}}$'), '\\');
notHas('不留花括号', TXT.clean('$\\mathbb{R}^{3}$ 上'), '{');
has('命令转符号', TXT.clean('$a\\leqslant b$'), '≤');
has('希腊字母', TXT.clean('$\\alpha+\\beta$'), 'α');
has('极限保留', TXT.clean('$\\lim_{x\\to 1}f(x)$'), 'lim');

console.log('--- 2. 噪声清理 ---');
eq('分值标记', TXT.clean('（本题满分12分）求极限'), '求极限');
eq('页码', TXT.clean('第 3 页 共 8 页 求极限'), '求极限');
eq('题号', TXT.clean('第12题 求极限'), '求极限');
eq('公众号水印', TXT.clean('求极限 微信公众号：某某考研'), '求极限');
eq('全角数字转半角', TXT.clean('共１２分'), '共12分');

console.log('--- 3. 返回解析容错 ---');
eq('标准 JSON', TXT.parsePayload('{"stem":"求极限","confidence":0.9}').stem, '求极限');
eq('代码块包裹', TXT.parsePayload('```json\n{"stem":"求极限"}\n```').stem, '求极限');
eq('前后有废话', TXT.parsePayload('好的：\n{"stem":"求极限"}\n希望有帮助').stem, '求极限');
has('非 JSON 兜底', TXT.parsePayload('这是一道求极限的题').stem, '求极限');
eq('兜底会标 note', TXT.parsePayload('随便一段话').note.indexOf('格式异常') >= 0, true);

console.log('--- 4. 找原题（用真实题干反查自身）---');
const STEM = require('../data/stem.js');
const items = [];
Object.keys(STEM).forEach(function (k) {
  const parts = k.split('|');
  STEM[k].forEach(function (q) { if ((q.s || '').length >= 20) items.push({ kp: parts[0], vol: parts[1], s: q.s }); });
});

function dropout(s, keep) {
  const chars = s.split('');
  const n = Math.max(12, Math.floor(chars.length * keep));
  let out = '';
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.10) continue;
    out += chars[i];
  }
  return out;
}

function measure(label, maker) {
  let hit = 0, wrong = 0, simSum = 0;
  items.forEach(function (it) {
    const text = TXT.clean(maker(it.s));
    const o = E.findOriginal(text, it.vol);
    if (!o) return;
    simSum += o.sim;
    if (o.kp === it.kp) hit++; else wrong++;
  });
  const rate = (100 * hit / items.length).toFixed(0);
  console.log('  ' + label + ': 命中 ' + hit + '/' + items.length + ' (' + rate + '%)'
    + '  错认考点 ' + wrong + '  平均相似度 ' + (hit + wrong ? Math.round(simSum / (hit + wrong)) : '-') + '%');
  if (hit / items.length < 0.85) { fail++; console.log('    ✗ 命中率低于 85%'); } else pass++;
}

measure('原文直出', function (s) { return s; });
measure('漏字 10%', function (s) { return dropout(s, 1.0); });

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
