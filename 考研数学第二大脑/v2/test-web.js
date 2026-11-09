/**
 * 网页端冒烟测试：验证上传图片 → 识别 → 匹配 → 存记录 全链路。
 * 跑法：node test-web.js
 * 需要本机已有 playwright（插件自带，用绝对路径 require）。
 */
const path = require('path');
const PW = '/Users/lixin/.workbuddy/plugins/cache/codebuddy-plugins-official/playwright-cli/0.1.0/node_modules/playwright';
const { chromium } = require(PW);
// 本机 playwright 自带的浏览器版本号和缓存里的对不上，直接指定已存在的可执行文件
const CHROME = '/Users/lixin/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

// 默认用 file:// 打开：这才是用户实际用法（双击 HTML），且网关对 Origin: null 放行
const URL = process.env.TEST_URL ||
  'file://' + encodeURI(path.resolve(__dirname, 'dist/真题库原型.html'));
const IMG = process.env.TEST_IMG || '/tmp/test_problem.png';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const step1 = await page.evaluate(() => ({
    mode: window.IN && IN.mode,
    hasDrop: !!document.getElementById('in-drop'),
    modes: Array.from(document.querySelectorAll('.modes button')).map(b => b.textContent.trim()),
  }));
  console.log('1) 首屏:', JSON.stringify(step1));

  // 上传图片：file input 是隐藏的，setInputFiles 可以直接打
  await page.setInputFiles('#in-file', IMG);
  console.log('2) 已投递图片，等待识别…');

  // 等识别完成（ocr 有值）最多 90s
  let ok = false;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({
      busy: IN.busy, hasOcr: !!IN.ocr, stem: (IN.stem || '').slice(0, 60),
      err: IN.err, cands: IN.cands.length, orig: IN.orig ? IN.orig.s : 0,
    }));
    if (i % 5 === 0) console.log('   …', JSON.stringify(st));
    if (st.hasOcr) { ok = true; break; }
    if (st.err) { console.log('   识别失败:', st.err); break; }
  }

  if (!ok) {
    console.log('✗ 识别没完成');
    await page.screenshot({ path: '/tmp/web-fail.png', fullPage: true });
    console.log('errors:', errs.slice(0, 5));
    await browser.close();
    process.exit(1);
  }

  const after = await page.evaluate(() => ({
    stem: IN.stem,
    conf: IN.ocr.confidence,
    model: IN.ocr.model,
    cands: IN.cands.map(c => ({ kp: c.k, sim: Math.round(c.s * 100) })),
    orig: IN.orig ? { sim: Math.round(IN.orig.s * 100), y: IN.orig.y, o: IN.orig.o, k: IN.orig.k } : null,
  }));
  console.log('3) 识别结果:', JSON.stringify(after, null, 1));

  // 截图第 1 步（识别后）
  await page.screenshot({ path: '/tmp/web-step1.png', fullPage: true });

  // 点第一个候选考点 → 进第 3 步
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('.cand label');
    if (!el) return false;
    el.click();
    return true;
  });
  await page.waitForTimeout(400);
  console.log('4) 点候选考点:', clicked);

  const step3 = await page.evaluate(() => ({
    kp: IN.kp, kpName: IN.kp && kpMap[IN.kp] && kpMap[IN.kp].name,
    done4: document.querySelectorAll('.done4 button').length,
    fams: document.querySelectorAll('#in-fam label').length,
  }));
  console.log('5) 第 3 步:', JSON.stringify(step3));

  // 选掌握度 + 思路族
  await page.evaluate(() => {
    const d = document.querySelector('.done4 button');
    if (d) d.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const f = document.querySelector('#in-fam label');
    if (f) f.click();
  });
  await page.waitForTimeout(300);

  const verdict = await page.evaluate(() => {
    const v = document.querySelector('.verdict');
    if (!v) return null;
    return { cls: v.className, title: v.querySelector('h3') && v.querySelector('h3').textContent };
  });
  console.log('6) 判定:', JSON.stringify(verdict));

  // 保存
  await page.evaluate(() => document.getElementById('in-save').click());
  await page.waitForTimeout(600);

  const saved = await page.evaluate(() => ({
    n: RECS.length,
    first: RECS[0] ? { kp: RECS[0].kp, src: RECS[0].src, srcRef: RECS[0].srcRef, stem: (RECS[0].stem || '').slice(0, 50), ocrSim: RECS[0].ocrSim } : null,
    ls: !!localStorage.getItem('ekb.records.v1'),
  }));
  console.log('7) 已保存:', JSON.stringify(saved, null, 1));

  await page.screenshot({ path: '/tmp/web-mine.png', fullPage: true });
  console.log('errors:', errs.length ? errs.slice(0, 5) : '无');
  await browser.close();
  console.log(saved.n > 0 ? '\n✓ 全链路通过' : '\n✗ 没存进去');
})();
