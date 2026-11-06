/**
 * 小程序工程静态校验（不依赖微信开发者工具）。
 * 跑法：node scripts/check.js
 *
 * 能抓到的真问题：
 *  - WXML 标签不闭合、{{ }} 括号不配对
 *  - 模板里引用了 data 中不存在的根字段（这类笔误在真机上只会显示空白，很难发现）
 *  - 嵌套路径的叶子名在页面 JS 里完全找不到（如 ocr.stemm）
 *
 * 抓不到的：WXML 编译期语义、组件属性取值合法性、真机布局。
 * 这些只有微信开发者工具能验，别把这里的"全部通过"当成能跑。
 *  - 事件绑定指向不存在的函数
 *  - require 断链、页面文件缺失、app.json/tabBar 配置错误
 *  - WXSS 花括号不配对
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let problems = 0;
const err = (m) => { problems++; console.log('  ✗ ' + m); };

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    if (f === 'node_modules' || f === 'miniprogram_npm' || f.startsWith('.')) continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);

// 全工程 JS 语料：判断某个字段名是否真实存在时用它，
// 只看页面 JS 会把 engine.js / store.js 里产出的字段误判成笔误。
// 排除 scripts/ 自身：里面的示例文字（如注释里的 ocr.stemm）会污染语料，
// 让笔误检查恒为通过——这个坑真的踩过一次。
const JS_CORPUS = files
  .filter((f) => f.endsWith('.js') && path.relative(ROOT, f).indexOf('scripts') !== 0)
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const byRel = (ext) => files.filter((f) => f.endsWith(ext)).map((f) => path.relative(ROOT, f));

/* ---------- 1. JSON ---------- */
console.log('1) JSON');
for (const rel of byRel('.json')) {
  try {
    JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) { err(rel + ' 不是合法 JSON: ' + e.message); }
}

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
console.log('   页面 ' + app.pages.length + ' 个, tabBar ' + (app.tabBar ? app.tabBar.list.length : 0) + ' 项');
for (const pg of app.pages) {
  for (const ext of ['.js', '.wxml', '.json']) {
    if (!fs.existsSync(path.join(ROOT, pg + ext))) err('缺文件 ' + pg + ext);
  }
}
if (app.tabBar) {
  for (const it of app.tabBar.list) {
    if (!app.pages.includes(it.pagePath)) err('tabBar 页面未在 pages 声明: ' + it.pagePath);
  }
}

/* ---------- 2. WXML 结构 ---------- */
console.log('2) WXML 结构');
const SELF_CLOSE = new Set(['image', 'input', 'icon', 'progress', 'slider', 'switch', 'audio', 'video', 'camera', 'canvas', 'map']);
for (const rel of byRel('.wxml')) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const stripped = src.replace(/<!--[\s\S]*?-->/g, '');

  // {{ }} 配对
  const open = (stripped.match(/\{\{/g) || []).length;
  const close = (stripped.match(/\}\}/g) || []).length;
  if (open !== close) err(rel + ' {{ }} 不配对: ' + open + ' vs ' + close);

  // 标签栈
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(stripped))) {
    const [, closing, tag, , selfSlash] = m;
    if (closing) {
      const top = stack.pop();
      if (top !== tag) err(rel + ' 标签不匹配: 期望 </' + top + '>，实际 </' + tag + '>');
    } else if (!selfSlash && !SELF_CLOSE.has(tag)) {
      stack.push(tag);
    }
  }
  if (stack.length) err(rel + ' 未闭合标签: ' + stack.join(', '));
}

/* ---------- 3. 模板字段 vs data ---------- */
console.log('3) 模板字段引用');
function dataKeysOf(jsRel) {
  const src = fs.readFileSync(path.join(ROOT, jsRel), 'utf8');
  const at = src.indexOf('data:');
  if (at < 0) return new Set();
  const open = src.indexOf('{', at);
  if (open < 0) return new Set();

  // 逐字符扫，跳过字符串，只在深度 0（data 对象自身那一层）收键
  const keys = new Set();
  let depth = 0, buf = '', inStr = null;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    const prev = src[i - 1];
    if (inStr) {
      if (ch === inStr && prev !== '\\') inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; if (depth === 1) continue; }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0) break;
    }
    if (depth === 1 && ch === ',') {
      const m = buf.match(/([A-Za-z_$][\w$]*)\s*:/);
      if (m) keys.add(m[1]);
      buf = '';
      continue;
    }
    if (depth === 1) buf += ch;
  }
  const m = buf.match(/([A-Za-z_$][\w$]*)\s*:/);
  if (m) keys.add(m[1]);
  return keys;
}

const BUILTIN = new Set(['item', 'index', 'true', 'false', 'null', 'undefined', 'wx', 'Math', 'Date', 'JSON', 'String', 'Number', 'Boolean', 'Object', 'Array', 'parseInt', 'parseFloat']);

for (const rel of byRel('.wxml')) {
  const jsRel = rel.replace(/\.wxml$/, '.js');
  if (!fs.existsSync(path.join(ROOT, jsRel))) continue;
  const keys = dataKeysOf(jsRel);
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // 收集 wx:for 的循环变量别名
  const aliases = new Set();
  (src.match(/wx:for-item="([^"]+)"/g) || []).forEach((s) => aliases.add(s.split('"')[1]));

  const exprs = src.match(/\{\{[\s\S]*?\}\}/g) || [];
  for (const raw of exprs) {
    const expr = raw.slice(2, -2);
    // 去掉字符串字面量，避免把中文当成标识符
    const noStr = expr.replace(/'[^']*'|"[^"]*"/g, "''");
    const ids = noStr.match(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)/g) || [];
    for (const token of ids) {
      const id = token.replace(/^[^A-Za-z_$]+/, '');
      if (!id || BUILTIN.has(id) || aliases.has(id)) continue;
      if (keys.has(id)) continue;
      // 对象字面量里的键（如 {kp:'x'}）会误报，简单跳过后跟冒号的
      const after = noStr.slice(noStr.indexOf(id) + id.length);
      if (/^\s*:/.test(after)) continue;
      err(rel + ' 引用了 data 里没有的字段: ' + id + '  （来自 ' + raw.slice(0, 40) + '）');
    }

    // 嵌套路径：叶子名在页面 JS 里一次都没出现过，基本就是打错字
    const chains = noStr.match(/\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+/g) || [];
    for (const ch of chains) {
      const segs = ch.split('.');
      const leaf = segs[segs.length - 1];
      if (BUILTIN.has(leaf)) continue;
      if (new RegExp('\\b' + leaf + '\\s*:').test(JS_CORPUS)) continue;
      if (new RegExp('\\.' + leaf + '\\b').test(JS_CORPUS)) continue;
      err(rel + ' 路径里的字段名在全工程 JS 中都找不到: ' + ch);
    }
  }
}

/* ---------- 4. 事件绑定 ---------- */
console.log('4) 事件绑定');
for (const rel of byRel('.wxml')) {
  const jsRel = rel.replace(/\.wxml$/, '.js');
  if (!fs.existsSync(path.join(ROOT, jsRel))) continue;
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, jsRel), 'utf8');
  const handlers = new Set();
  (src.match(/(?:bind|catch)[a-z]+="([A-Za-z_$][\w$]*)"/g) || []).forEach((s) => handlers.add(s.split('"')[1]));
  for (const h of handlers) {
    if (!new RegExp('(^|[\\s{,])' + h + '\\s*\\(').test(js)) err(rel + ' 事件函数未实现: ' + h);
  }
}

/* ---------- 5. require ---------- */
console.log('5) 模块引用');
for (const rel of byRel('.js')) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const re = /require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // npm 包交给构建
    const target = path.resolve(path.dirname(path.join(ROOT, rel)), spec);
    if (!fs.existsSync(target) && !fs.existsSync(target + '.js')) {
      err(rel + ' require 断链: ' + spec);
    }
  }
}

/* ---------- 6. WXSS ---------- */
console.log('6) WXSS');
for (const rel of byRel('.wxss')) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const o = (src.match(/\{/g) || []).length;
  const c = (src.match(/\}/g) || []).length;
  if (o !== c) err(rel + ' 花括号不配对: ' + o + ' vs ' + c);
}

/* ---------- 7. 数据文件 ---------- */
console.log('7) 数据模块');
for (const name of ['kp', 'stem', 'prior']) {
  const p = path.join(ROOT, 'data', name + '.js');
  if (!fs.existsSync(p)) { err('缺数据模块 data/' + name + '.js'); continue; }
  try {
    const mod = require(p);
    const size = fs.statSync(p).size;
    console.log('   ' + name + '.js ' + Math.round(size / 1024) + 'KB');
    if (name === 'kp' && (!mod.nodes || !mod.nodes.length)) err('kp.js 没有 nodes');
  } catch (e) {
    err('data/' + name + '.js 加载失败: ' + e.message);
  }
}

console.log('\n' + (problems ? '发现 ' + problems + ' 个问题' : '全部通过'));
process.exit(problems ? 1 : 0);
