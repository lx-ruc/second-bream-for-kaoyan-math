/**
 * 考频评分排序的冒烟测试：验证评分列、排序、分项是否都真的渲染出来。
 * 跑法：node test-prior.js
 */
const path = require('path');
const PW = '/Users/lixin/.workbuddy/plugins/cache/codebuddy-plugins-official/playwright-cli/0.1.0/node_modules/playwright';
const { chromium } = require(PW);
const CHROME = '/Users/lixin/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const URL = 'file://' + encodeURI(path.resolve(__dirname, 'dist/真题库原型.html'));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 切到考点地图
  await page.click('.tab[data-tab="map"]');
  await page.waitForTimeout(200);

  // 1) 默认排序项是评分
  const sortVal = await page.$eval('#sort', el => el.value);
  console.log('1) 默认排序:', sortVal, sortVal === 'pri' ? 'OK' : 'FAIL');

  // 2) 抓前 8 行的排名与分数
  const top = await page.$$eval('#map-tbl tr.kp', trs => trs.slice(0, 8).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      rk: (tds[0].querySelector('.rk') || {}).textContent || '',
      name: tds[0].textContent.replace(/^\s*\d+\s*/, '').trim(),
      score: (tds[1].querySelector('b') || {}).textContent || '',
      width: (tds[1].querySelector('.sc-bar i') || {}).style?.width || ''
    };
  }));
  console.log('2) 前 8 行:');
  top.forEach(t => console.log(`   #${t.rk.padStart(2)} ${t.name.padEnd(22)} S=${t.score.padStart(5)} 条宽=${t.width}`));

  // 3) 分数必须单调不增
  const scores = await page.$$eval('#map-tbl tr.kp', trs =>
    trs.map(tr => parseFloat(tr.querySelectorAll('td')[1].querySelector('b').textContent)));
  let mono = true;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[i-1] + 1e-9) mono = false;
  console.log('3) 分数单调递减:', mono ? 'OK' : 'FAIL', `(${scores.length} 行, ${scores[0]} → ${scores[scores.length-1]})`);

  // 4) 名次非降即可：同分并列是刻意的（8 组同分不硬拆），
  //    且是「三卷 92 个考点合并名次」，本卷只出现其中一段，所以允许跳号。
  const rks = await page.$$eval('#map-tbl tr.kp', trs =>
    trs.map(tr => parseInt((tr.querySelectorAll('td')[0].querySelector('.rk') || {}).textContent || '0')));
  const okRk = rks.every((v, i) => v > 0 && (i === 0 || v >= rks[i - 1]));
  console.log('4) 名次非降（允许并列与跳号）:', okRk ? 'OK' : 'FAIL',
    `(${rks[0]}…${rks[rks.length-1]}，共 ${rks.length} 个，去重 ${new Set(rks).size} 个名次)`,
    okRk ? '' : `越界点: ${rks.join(',')}`);

  // 5) 切到数学二，评分数值不应变化（评分是三卷统计量）
  const s1 = await page.$$eval('#map-tbl tr.kp', trs => {
    const m = {}; trs.forEach(tr => {
      const td = tr.querySelectorAll('td');
      m[td[0].textContent.replace(/^\s*\d+\s*/, '').trim()] = td[1].textContent.trim();
    });
    return m;
  });
  await page.click('#seg-vol button[data-v="2"]');
  await page.waitForTimeout(200);
  const s2 = await page.$$eval('#map-tbl tr.kp', trs => {
    const m = {}; trs.forEach(tr => {
      const td = tr.querySelectorAll('td');
      m[td[0].textContent.replace(/^\s*\d+\s*/, '').trim()] = td[1].textContent.trim();
    });
    return m;
  });
  const same = Object.keys(s1).filter(k => s2[k] !== undefined).every(k => s1[k] === s2[k]);
  console.log('5) 换卷后评分不变:', same ? 'OK' : 'FAIL',
    `(数学一 ${Object.keys(s1).length} 个, 数学二 ${Object.keys(s2).length} 个)`);

  // 6) 换成「按考纲顺序」后评分列应消失
  await page.selectOption('#sort', 'order');
  await page.waitForTimeout(200);
  const hasScoreCol = await page.$$eval('#map-tbl tr.kp', trs =>
    !!(trs[0].querySelectorAll('td')[1].querySelector('.sc-bar')));
  console.log('6) 考纲顺序下隐藏评分列:', hasScoreCol ? 'FAIL' : 'OK');

  // 7) 点第一个考点，看详情里的评分块
  await page.selectOption('#sort', 'pri');
  await page.waitForTimeout(150);
  await page.click('#map-tbl tr.kp');
  await page.waitForTimeout(200);
  const det = await page.evaluate(() => {
    const b = document.querySelector('#map-detail .pri-box');
    if (!b) return null;
    return {
      total: b.querySelector('.pri-total b').textContent,
      grades: Array.from(b.querySelectorAll('.pri-break div')).map(d => d.textContent.trim()),
      note: (document.querySelector('#map-detail .note') || {}).textContent?.replace(/\s+/g, ' ').trim() || ''
    };
  });
  console.log('7) 详情评分块:', det ? `OK  综合=${det.total}  ${det.grades.join(' | ')}` : 'FAIL 未渲染');
  if (det) console.log('   说明:', det.note.slice(0, 120));

  // 8) 截图
  await page.screenshot({ path: '/tmp/prior-map.png', fullPage: false });
  console.log('8) 截图 → /tmp/prior-map.png');

  console.log('\n控制台错误:', errs.length ? errs.slice(0, 5) : '无');
  await browser.close();
})();
