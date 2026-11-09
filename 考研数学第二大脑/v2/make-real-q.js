/**
 * 把一道真题题干渲染成 PNG，用来验证拍照识别链路。
 *
 * 为什么要有这个：验证「识别 → 找原题」不能拿随便一张图凑数，
 * 必须是题库里真实存在的题，否则「没命中原题」到底是识别不行还是题库没有，分不清。
 * 这个脚本直接读 data/jj.json，保证测的是库里真有的题。
 *
 * 为什么用 Chromium 而不是 matplotlib：PingFang SC 缺 U+207B（上标负号），
 * 上标会渲染成方框，识别测试就不严谨了。HTML 的 <sup> 没这问题。
 *
 * 跑法：
 *   node make-real-q.js                      # 默认渲染 2022 数学一 第 15 题
 *   STEM_KP=K985c2677 STEM_Y=2022 STEM_NO=15 OUT=/tmp/q.png node make-real-q.js
 */
const fs = require('fs');
const path = require('path');
const PW = '/Users/lixin/.workbuddy/plugins/cache/codebuddy-plugins-official/playwright-cli/0.1.0/node_modules/playwright';
const CHROME = '/Users/lixin/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const { chromium } = require(PW);

const KP = process.env.STEM_KP || 'K985c2677';
const VOL = process.env.STEM_VOL || '1';
const Y = +(process.env.STEM_Y || 2022);
const NO = +(process.env.STEM_NO || 15);
const OUT = process.env.OUT || '/tmp/real_q.png';

const JJ = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/jj.json'), 'utf8')).docs;
const doc = JJ.find(d => d.kp === KP && d.vol === VOL);
if (!doc) { console.error('找不到考点', KP, VOL); process.exit(1); }
const q = doc.qs.find(x => x.y === Y && x.no === NO);
if (!q) { console.error('找不到题目', Y, NO, '；该考点有', doc.qs.map(x => x.y + '-' + x.no).join(', ')); process.exit(1); }

/** LaTeX → 能塞进 HTML 的样子。只处理题干里常见的几种，够验证用。 */
function toHtml(s) {
  let t = s;
  // 矩阵先压成一行方括号，视觉上够像真题排版
  t = t.replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (m, body) => '[' + body.replace(/\\\\/g, ';').replace(/&/g, ' ') + ']');
  t = t.replace(/\^\{-1\}/g, '<sup>−1</sup>').replace(/\^\{-2\}/g, '<sup>−2</sup>');
  t = t.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>').replace(/\^(\w)/g, '<sup>$1</sup>');
  t = t.replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>').replace(/_(\w)/g, '<sub>$1</sub>');
  t = t.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
  return t;
}

const VOLNAME = { '1': '一', '2': '二', '3': '三' };
const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#fff}
.page{width:900px;padding:46px 40px;background:#fff;font:26px/1.85 "Songti SC","STSong",serif;color:#111}
sup,sub{font-size:0.68em;line-height:0}
.nm{font-size:18px;color:#888;margin-bottom:10px;font-family:"PingFang SC",sans-serif}
</style></head><body><div class="page">
<div class="nm">${Y} 年 数学${VOLNAME[VOL]} 第 ${NO} 题</div>
<div>${toHtml(q.stem)}</div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 900, height: 300 }, deviceScaleFactor: 2 });
  await page.setContent(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log('已写出', OUT);
  console.log('题目:', Y, '数学' + VOLNAME[VOL], '第' + NO + '题', '·', doc.kp_name);
  console.log('题干:', q.stem);
})();
