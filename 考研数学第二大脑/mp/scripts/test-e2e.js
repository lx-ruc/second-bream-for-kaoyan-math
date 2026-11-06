/**
 * 开发者工具端到端测试（需要本机微信开发者工具，不适合 CI）。
 * 跑法：node scripts/test-e2e.js
 *
 * 2026-11-07 实测结论（这台机器 + touristappid + 未登录 IDE）：
 *  - `cli auto` 的 Tool 域部分可用（Tool.getInfo 秒回）；
 *  - **App 域（页面/元素/evaluate）全部无响应**——模拟器运行时桥在未登录
 *    （日志里 errcode 41001 / getNewTicket empty ticket）时不会挂上。
 *    automator.launch 会连上但 currentPage() 永远超时，别再踩。
 *  - 所以本脚本分两段：Tool 域体检（未登录也能跑）+ App 域冒烟（需先扫码登录 IDE）。
 *    未登录时第二段直接 SKIP 并给出操作指引，不算失败。
 *
 * 另一个环境坑：IDE 每次启动弹「更新提示」原生弹窗，会堵死全部自动化指令。
 * 配方：osascript 把 wechatdevtools 设为 frontmost，再用 CGEvent 点击
 * 「稍后再说」两次（第一下只是激活窗口）。click.swift 就是干这个的。
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const automator = require('miniprogram-automator');

// 未登录时 Tool.getInfo 没有 SDKVersion，automator 的版本比较会 undefined.split 炸，跳过无害
require('miniprogram-automator/out/MiniProgram').default.prototype.checkVersion = async function () {};

const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT = path.resolve(__dirname, '..');
const PORT = 9420;

let pass = 0, fail = 0, skip = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, tag) => Promise.race([p, sleep(ms).then(() => { throw new Error(tag + ' 超时'); })]);

/* ---------------- 1. Tool 域（未登录可用） ---------------- */

function rawProbe(method, params) {
  return new Promise((resolve) => {
    let ws;
    try { ws = new WebSocket('ws://127.0.0.1:' + PORT); } catch (e) { return resolve(null); }
    const timer = setTimeout(() => { try { ws.close(); } catch (e) {} resolve(null); }, 6000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params: params || {} }));
    ws.onmessage = (ev) => { clearTimeout(timer); try { ws.close(); } catch (e) {} resolve(JSON.parse(ev.data)); };
    ws.onerror = () => { clearTimeout(timer); resolve(null); };
  });
}

/** 点掉「更新提示」弹窗：窗口中心为基准，按钮在中心下方约 135pt。弹窗不在时点空处，无害。 */
function dismissUpdateDialog() {
  try {
    execFileSync('osascript', ['-e',
      'tell application "System Events" to set frontmost of process "wechatdevtools" to true']);
  } catch (e) { /* 已经是前台也不影响 */ }
  const bin = path.join(__dirname, 'click.bin');
  for (let i = 0; i < 2; i++) {
    try { execFileSync(bin, ['960', '690']); } catch (e) { return; }
  }
}

async function toolDomainCheck() {
  console.log('\n--- 1. Tool 域体检（不需要登录）---');
  // 幂等：已开则秒回。必须先有项目窗口，冷启动时 cli auto 只到项目列表页
  execFileSync(CLI, ['open', '--project', PROJECT], { timeout: 90000 });
  execFileSync(CLI, ['auto', '--project', PROJECT, '--auto-port', String(PORT)], { timeout: 120000 });
  ensureClicker();

  let reply = null;
  for (let i = 0; i < 4 && !(reply && reply.result); i++) {
    await sleep(1500);
    reply = await rawProbe('Tool.getInfo');
    if (reply && reply.result) break;
    dismissUpdateDialog(); // 最常见的堵法就是它
  }
  ok('自动化端口可连且 Tool 域响应', !!(reply && reply.result && reply.result.version),
    reply ? JSON.stringify(reply).slice(0, 120) : '无响应（检查 IDE 是否被弹窗挡住）');
  if (reply && reply.result) console.log('  IDE 版本: ' + reply.result.version);
}

function ensureClicker() {
  const bin = path.join(__dirname, 'click.bin');
  if (fs.existsSync(bin)) return;
  execFileSync('swiftc', ['-O', '-o', bin, path.join(__dirname, 'click.swift')]);
}

/* ---------------- 2. App 域（需要登录） ---------------- */

async function appDomainSmoke() {
  console.log('\n--- 2. App 域冒烟（需要 IDE 扫码登录）---');
  let mini = null;
  for (let i = 0; i < 3 && !mini; i++) {
    try { mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }); }
    catch (e) { await sleep(2000); }
  }
  if (!mini) { skip++; console.log('  - SKIP: 自动化端口不可连（IDE 没开或被弹窗挡住）'); return; }

  // App 域就绪探测：未登录时全部超时
  let ready = true;
  try {
    await withTimeout(mini.currentPage(), 8000, 'currentPage');
  } catch (e) { ready = false; }
  if (!ready) {
    skip++;
    console.log('  - SKIP: App 域无响应（IDE 未登录，日志特征 errcode 41001）。\n' +
      '    补全方法：打开微信开发者工具扫码登录后重跑本脚本，即可执行页面冒烟。');
    await mini.disconnect();
    return;
  }

  const consoleErrors = [];
  mini.on('console', (msg) => {
    if (msg.type === 'error') consoleErrors.push(String(msg.args && msg.args.join ? msg.args.join(' ') : msg.args).slice(0, 200));
  });

  let page = await withTimeout(mini.reLaunch('/pages/intake/intake'), 20000, 'reLaunch');
  await page.waitFor(800);
  let el = await withTimeout(page.$('.h1'), 15000, '查 .h1');
  ok('录题页标题', el && (await el.text()).indexOf('考的是哪一点') >= 0);
  ok('拍照主按钮在', !!(await withTimeout(page.$('.snap'), 15000, '查 .snap')));
  ok('三个图片来源在', (await withTimeout(page.$$('.src'), 15000, '查 .src')).length === 3);

  page = await withTimeout(mini.switchTab('/pages/diagnose/diagnose'), 20000, '切诊断页');
  await page.waitFor(600);
  ok('诊断页空态', !!(await withTimeout(page.$('.empty'), 15000, '查 .empty')));

  page = await withTimeout(mini.switchTab('/pages/map/map'), 20000, '切考点页');
  await page.waitFor(1500);
  ok('考点地图有内容', (await withTimeout(page.$$('.row'), 20000, '查考点行')).length > 10);

  page = await withTimeout(mini.switchTab('/pages/prior/prior'), 20000, '切考频页');
  await page.waitFor(800);
  ok('考频表有内容', (await withTimeout(page.$$('.tr'), 15000, '查考频行')).length > 10);

  ok('console 无 error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  await mini.disconnect();
}

async function main() {
  await toolDomainCheck();
  await appDomainSmoke();
  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败, ' + skip + ' 跳过');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('E2E 挂了:', e && e.message); process.exit(1); });
