/**
 * 云服务客户端。唯一初始化点，其它模块共用这一个实例。
 * 只使用 publicConfig 里的公开配置，不放任何密钥。
 *
 * 为什么改成懒初始化：SDK 在 require 阶段就要摸 wx、校验 endpoint。
 * 一旦它抛错，所有 require 了本文件的页面（记一道题、诊断）会整页加载失败，
 * 用户看到的就是空白页 —— 连拍照按钮都没有。现在把实例化推迟到真正要调模型时，
 * 云服务挂了也只是「识别不可用」，页面照常能用、能手动选考点。
 *
 * 鉴权（2026-11-24）：网关已强制登录态，仅凭 publishableKey 调 LLM 一律 401 login_required。
 * 所以调模型前必须先有会话 —— 登录走 WorkBuddy 官方小程序授权：
 *   发起：cloud.auth.signInWithWorkBuddyMiniProgram({ redirectPath })
 *   回调：app.js onShow → cloud.auth.handleWorkBuddyMiniProgramCallback(options)
 * 两步都由 SDK 完成 state / 换票，应用不碰 code，也不自己拼任何授权地址。
 */
const CONFIG = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_0O2obdqnkhk3o0ON9v837l_n7TVBndWZ7dYTiswWl6HrZcyvaFdkF31',
  // 平台按应用下发的复合 OAuth client_id（{开平 client_id}_{子应用ID}），原样传入，不要自行拼接
  workBuddyOAuthClientId: 'cb_jq6QyEPkOkJXPcpz0JxS_wbapp_0O2obdqnkhk3o0ON9v837l',
};

let _cloud = null;
let _failed = false;
let _reason = '';

function getCloud() {
  if (_cloud) return _cloud;
  if (_failed) {
    const e = new Error('CLOUD_INIT_FAILED');
    e.code = 'cloud_init';
    e.reason = _reason;
    throw e;
  }
  try {
    const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
    const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics');
    _cloud = createMiniProgramWorkBuddyCloud({
      endpoint: CONFIG.endpoint,
      publishableKey: CONFIG.publishableKey,
      workBuddyOAuthClientId: CONFIG.workBuddyOAuthClientId,
      wx: createDiagnosticWx(wx),
    });
    return _cloud;
  } catch (err) {
    _failed = true;
    _reason = (err && err.message) || String(err);
    const e = new Error('CLOUD_INIT_FAILED');
    e.code = 'cloud_init';
    e.reason = _reason;
    throw e;
  }
}

/** 给页面做体检用：不抛错，只报告能不能连 */
function probe() {
  try {
    getCloud();
    return { ok: true, endpoint: CONFIG.endpoint };
  } catch (err) {
    return { ok: false, endpoint: CONFIG.endpoint, reason: err.reason || err.message || '' };
  }
}

/* ---------------- 登录态 ---------------- */

/**
 * 当前是否有会话。不抛错：拿不到（云初始化失败、网络异常）一律按「未登录」处理。
 * 不能用本地缓存布尔值当登录凭据 —— 每次都问 SDK。
 */
async function isLoggedIn() {
  try {
    const { data: session } = await getCloud().auth.getSession();
    return !!session;
  } catch (err) {
    return false;
  }
}

/**
 * 发起 WorkBuddy 登录。只能在用户点按钮时调用（不能在 onShow 里自动拉起）。
 * 成功只表示「已跳转到授权页」，不表示已登录 —— 会话要等 app.js 的回调建立。
 * @returns {Promise<{error: null}|{error: {code: string, message: string}}>}
 */
async function signIn(redirectPath) {
  const { error } = await getCloud().auth.signInWithWorkBuddyMiniProgram({ redirectPath: redirectPath });
  if (error) {
    return { error: { code: error.code || '', message: error.message || String(error) } };
  }
  return { error: null };
}

module.exports = {
  getCloud: getCloud,
  probe: probe,
  isLoggedIn: isLoggedIn,
  signIn: signIn,
  PUBLIC_CONFIG: CONFIG,
};
