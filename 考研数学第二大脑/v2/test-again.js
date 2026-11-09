/**
 * 只测「第 2 步里展开识别面板」这一条路径。
 * 为什么要单独测：识别完会自动跳到第 2 步，用户在这一步才发现认错了字，
 * 必须能展开 → 改字 → 重新匹配，且改完面板不能自己收起来。
 *
 * 跑法：node test-again.js
 */
const path = require('path');
const PW = '/Users/lixin/.workbuddy/plugins/cache/codebuddy-plugins-official/playwright-cli/0.1.0/node_modules/playwright';
const { chromium } = require(PW);
const CHROME = '/Users/lixin/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = 'file://' + encodeURI(path.resolve(__dirname, 'dist/真题库原型.html'));
const IMG = process.env.TEST_IMG || '/tmp/real_q.png';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  await page.setInputFiles('#in-file', IMG);
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => ({ busy: !!IN.busy, ocr: !!IN.ocr, cands: IN.cands.length }));
    if (st.ocr && !st.busy) break;
  }

  // 1) 第 2 步应存在折叠面板
  const s1 = await page.evaluate(() => {
    const d = document.querySelector('.again');
    return { exists: !!d, open: d ? d.open : null, summary: d ? d.querySelector('summary').textContent.trim() : '' };
  });
  console.log('1) 折叠面板:', JSON.stringify(s1));

  // 2) 展开
  await page.evaluate(() => { document.querySelector('.again').open = true; });
  await page.waitForTimeout(300);
  const s2 = await page.evaluate(() => {
    const d = document.querySelector('.again');
    return {
      open: d.open,
      hasImg: !!d.querySelector('img'),
      imgSrcLen: (d.querySelector('img') || {}).src ? d.querySelector('img').src.length : 0,
      hasTextarea: !!d.querySelector('#in-text'),
      taLen: ((d.querySelector('#in-text') || {}).value || '').length,
      hasHint: !!d.querySelector('#in-hint'),
    };
  });
  console.log('2) 展开后:', JSON.stringify(s2));
  await page.screenshot({ path: '/tmp/again-open.png', fullPage: true });

  // 3) 改文本 → 重新匹配 → 面板应保持展开
  await page.evaluate(() => {
    document.querySelector('#in-text').value = '已知矩阵 A 和 E-A 可逆，其中 E 为单位矩阵。若矩阵 B 满足 [E-(E-A)⁻¹]B=A，则 B-A=____. 求 B-A 的值（改过的文本，用来验证重算）';
  });
  await page.evaluate(() => document.querySelector('#in-go').click());
  await page.waitForTimeout(800);
  const s3 = await page.evaluate(() => {
    const d = document.querySelector('.again');
    return { open: d ? d.open : null, cands: IN.cands.length, orig: IN.orig ? IN.orig.y + '-' + IN.orig.o : null, stemLen: IN.stem.length };
  });
  console.log('3) 改字后重新匹配:', JSON.stringify(s3));

  // 4) 再点一次「重新匹配」验证绑没失效（DOM 重建后最容易断）
  await page.evaluate(() => {
    const ta = document.querySelector('#in-text');
    ta.value = ta.value + ' 再补一句';
    document.querySelector('#in-go').click();
  });
  await page.waitForTimeout(600);
  const s4 = await page.evaluate(() => ({ open: (document.querySelector('.again') || {}).open, stemTail: IN.stem.slice(-8) }));
  console.log('4) 二次改字:', JSON.stringify(s4));

  await page.screenshot({ path: '/tmp/again-after.png', fullPage: true });
  console.log('errors:', errs.length ? errs.slice(0, 5) : '无');
  await browser.close();

  const ok = s1.exists && s2.hasImg && s2.hasTextarea && s3.open === true && s4.open === true && s4.stemTail.indexOf('再补一句') >= 0;
  console.log(ok ? '\n✓ 折叠面板路径通过' : '\n✗ 有问题');
  process.exit(ok ? 0 : 1);
})();
