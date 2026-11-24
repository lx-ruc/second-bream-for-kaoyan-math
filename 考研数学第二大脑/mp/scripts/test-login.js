/**
 * 登录闭环（Node 内跑真实的 app.js + pages/intake，wx 与云 SDK 全 mock）。
 * 跑法：node scripts/test-login.js
 *
 * 为什么要单独一个：网关 2026-11-24 起强制登录态，识题前必须有会话。
 * 这条链路横跨 app.js 的 onShow 回调、cloud.js 的登录态、intake 页面的失败处理，
 * 任一处写错的表现都是「点了登录没反应」或「登录完还是让登录」，而静态校验查不出来。
 *
 * 覆盖：
 *   未登录识题 → 不发请求、亮登录按钮（不是 toast）
 *   点登录 → 调 SDK 发起授权，带正确的 redirectPath
 *   授权回跳 → app.js onShow 把 options 原样交给 SDK
 *   回到页面 → onShow 等回调、刷新登录态、自动续上识别
 *   用户取消 → 不算错、按钮保留
 *   云初始化失败 → app.js onShow 不抛，页面照常可用
 */
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
};

/* ---------------- 可控的假 SDK ---------------- */
const AUTH = {
  loggedIn: false,          // 当前是否有会话
  callbackResult: { data: null, error: null },  // handleWorkBuddyMiniProgramCallback 的返回
  signInResult: { error: null },
  calls: { callback: [], signIn: [], init: null },
  reset() {
    this.loggedIn = false;
    this.callbackResult = { data: null, error: null };
    this.signInResult = { error: null };
    this.calls = { callback: [], signIn: [], init: null };
  },
};

function installFakeSdk() {
  const spec = '@tencent-ai/workbuddy-cloud-sdk/miniprogram';
  const fake = {
    createMiniProgramWorkBuddyCloud(cfg) {
      AUTH.calls.init = cfg;
      return {
        auth: {
          async getSession() { return { data: AUTH.loggedIn ? { user: { name: 't' } } : null, error: null }; },
          async signInWithWorkBuddyMiniProgram(opts) { AUTH.calls.signIn.push(opts); return AUTH.signInResult; },
          async handleWorkBuddyMiniProgramCallback(opts) { AUTH.calls.callback.push(opts); return AUTH.callbackResult; },
        },
        llm: { models: { list: async () => [{ id: 'fake-vision', name: 'fake', supportsImages: true }] },
               chat: { completions: { create: async () => { throw Object.assign(new Error('x'), { code: 'should_not_call' }); } } } },
      };
    },
  };
  // 拦截 require：页面/工具模块在加载后才 require SDK，所以必须在加载前挂钩子
  const orig = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === spec) return fake;
    return orig.apply(this, arguments);
  };
  return () => { Module._load = orig; };
}

/* ---------------- wx mock ---------------- */
const storage = {};
const toasts = [];
const wx = {
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: (o) => { toasts.push(o.title); },
  previewImage: () => {},
  getFileSystemManager: () => ({
    readdirSync: () => [], unlinkSync: () => {}, accessSync: () => {}, mkdirSync: () => {},
    copyFileSync: () => {}, statSync: () => ({ size: 0 }), readFile: () => {},
  }),
  env: { USER_DATA_PATH: '/tmp' },
};

let appInstance = null;
function freshRequire(rel) {
  const p = path.resolve(__dirname, '..', rel);
  delete require.cache[require.resolve(p)];
  return require(p);
}

function loadApp() {
  global.App = (cfg) => { appInstance = cfg; };
  global.wx = wx;
  freshRequire('app.js');
  appInstance.authReady = null;   // 还没 onShow
  return appInstance;
}

function loadPage() {
  let page = null;
  global.Page = (cfg) => { page = cfg; };
  global.App = (cfg) => cfg;
  global.getApp = () => appInstance;
  global.getCurrentPages = () => [];
  page = null;
  freshRequire('pages/intake/intake.js');
  page.setData = function (patch) { Object.assign(this.data, patch); };
  return page;
}

(async function main() {
  const restore = installFakeSdk();
  // img.js 在模块顶层就碰 wx（测试用不到的清理逻辑），所以 wx 必须先于任何业务模块就位
  global.wx = wx;
  global.getCurrentPages = () => [];
  const OCR = freshRequire('utils/ocr.js');

  console.log('--- 0. cloud.js 初始化参数 ---');
  // 触发一次懒初始化
  await OCR.isLoggedIn();
  const init = AUTH.calls.init;
  ok('传了 endpoint', init && init.endpoint === 'https://mp-api.app.workbuddy.host');
  ok('传了 publishableKey', init && /^wbpk_/.test(init.publishableKey || ''));
  ok('传了 workBuddyOAuthClientId（原生登录缺它必失败）', init && /^cb_.+_wbapp_/.test(init.workBuddyOAuthClientId || ''));
  ok('wx 经 createDiagnosticWx 包装', init && init.wx && typeof init.wx.request === 'function');

  console.log('\n--- 1. 未登录时识题 ---');
  AUTH.reset();
  const app = loadApp();
  const intake = loadPage();
  intake.onLoad();
  ok('authReady 初始未建立', app.authReady === null);
  app.onShow({});                      // 真实冷启动：App.onShow 一定先于页面
  intake.onShow();                     // 页面 onShow 不 await，让它和真实时序一致
  await app.authReady;
  await new Promise((r) => setTimeout(r, 0));   // 让页面 onShow 跑完
  ok('onShow 读到未登录', intake.data.loggedIn === false);
  ok('没图就不弹登录提示（不打扰）', intake.data.needLogin === false);
  ok('app.js 建了 authReady', app.authReady && typeof app.authReady.then === 'function');
  ok('普通启动：onShow 把 options 交给 SDK', AUTH.calls.callback.length === 1);

  let rejected = null;
  try { await OCR.recognize('/tmp/fake.jpg'); } catch (e) { rejected = e; }
  ok('未登录直接拒绝，code=login_required', rejected && rejected.code === 'login_required', rejected && rejected.code);

  // 模拟：拍了图 → 识别失败 → 页面处理
  intake.setData({ imgPath: '/tmp/fake.jpg', busy: 'ocr' });
  intake.onOcrFail(rejected);
  ok('失败后 busy 清掉', intake.data.busy === '');
  ok('needLogin 置位（亮登录按钮）', intake.data.needLogin === true);
  ok('未登录失败不弹 toast（用常驻按钮代替）', toasts.length === 0, toasts.join('|'));

  console.log('\n--- 2. 点「登录后识别」---');
  await intake.onLogin();
  ok('调了 SDK 发起登录', AUTH.calls.signIn.length === 1);
  ok('redirectPath 指回本页', AUTH.calls.signIn[0] && AUTH.calls.signIn[0].redirectPath === 'pages/intake/intake');
  ok('发起成功不弹错', toasts.length === 0, toasts.join('|'));
  ok('发起后不假设已登录', intake.data.loggedIn === false);

  console.log('\n--- 3. 用户在微信弹窗取消 ---');
  AUTH.signInResult = { error: { code: 'cancelled', message: 'cancel' } };
  await intake.onLogin();
  ok('取消不弹错', toasts.length === 0, toasts.join('|'));
  ok('取消后按钮保留', intake.data.needLogin === true);

  console.log('\n--- 4. 授权成功回跳 ---');
  AUTH.signInResult = { error: null };
  // 官方小程序回跳：onShow 带 referrerInfo，SDK 换票成功
  AUTH.loggedIn = true;
  AUTH.callbackResult = { data: { user: { name: 't' } }, error: null };
  const opts = { scene: 1038, referrerInfo: { appId: 'wx-official', extraData: { code: 'c', state: 's' } } };
  app.onShow(opts);
  ok('回跳 options 原样交给 SDK', AUTH.calls.callback[1] === opts);
  const cbRes = await app.authReady;
  ok('authReady 返回会话', cbRes && cbRes.data && cbRes.data.user);

  // 回到页面：onShow 应等回调、刷新登录态、自动续上识别
  let resumed = 0;
  intake.reOcr = function () { resumed++; };   // 识别本身走真实网络，这里只验证「有没有被续上」
  await intake.onShow();
  ok('onShow 后 loggedIn=true', intake.data.loggedIn === true);
  ok('needLogin 收起', intake.data.needLogin === false);
  ok('自动续上识别（不用用户再点）', resumed === 1, resumed);

  console.log('\n--- 5. 回跳带错误（官方小程序里拒绝授权）---');
  AUTH.reset();
  const app2 = loadApp();
  toasts.length = 0;
  AUTH.callbackResult = { data: null, error: { code: 'access_denied', message: '用户取消授权' } };
  app2.onShow({ referrerInfo: { appId: 'wx-official', extraData: { state: 's', error: 'access_denied' } } });
  const r5 = await app2.authReady;
  ok('错误被带回但不抛', r5 && r5.error && r5.error.code === 'access_denied');
  ok('提示了错误原因', toasts.some((t) => t.indexOf('取消授权') >= 0), toasts.join('|'));

  console.log('\n--- 6. 授权回调处理本身抛异常 ---');
  toasts.length = 0;
  AUTH.callbackResult = Promise.reject(new Error('network down'));
  const app3 = loadApp();
  app3.onShow({});
  let r6 = null;
  try { r6 = await app3.authReady; } catch (e) { r6 = 'THREW'; }
  ok('onShow 不被拖垮', r6 && r6 !== 'THREW');

  console.log('\n--- 7. 云初始化失败时 app.js 不崩 ---');
  restore();
  const restore2 = (function () {
    const spec = '@tencent-ai/workbuddy-cloud-sdk/miniprogram';
    const orig = Module._load;
    Module._load = function (request) {
      if (request === spec) return { createMiniProgramWorkBuddyCloud() { throw new Error('no sdk'); } };
      return orig.apply(this, arguments);
    };
    return () => { Module._load = orig; };
  })();
  const app4 = loadApp();
  let threw = false;
  try { app4.onShow({}); } catch (e) { threw = true; }
  ok('onShow 不抛', !threw);
  const r7 = await app4.authReady;
  ok('authReady 仍可 await', r7 && r7.data === null);
  const OCR4 = freshRequire('utils/ocr.js');
  ok('此时 isLoggedIn=false 而不是抛', (await OCR4.isLoggedIn()) === false);
  restore2();

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('挂了:', e.stack); process.exit(1); });
