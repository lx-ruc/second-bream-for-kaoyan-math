/**
 * 云服务客户端。唯一初始化点，其它模块共用这一个实例。
 * 只使用 publicConfig 里的公开配置，不放任何密钥。
 *
 * 为什么改成懒初始化：SDK 在 require 阶段就要摸 wx、校验 endpoint。
 * 一旦它抛错，所有 require 了本文件的页面（记一道题、诊断）会整页加载失败，
 * 用户看到的就是空白页 —— 连拍照按钮都没有。现在把实例化推迟到真正要调模型时，
 * 云服务挂了也只是「识别不可用」，页面照常能用、能手动选考点。
 */
const CONFIG = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_0O2obdqnkhk3o0ON9v837l_n7TVBndWZ7dYTiswWl6HrZcyvaFdkF31',
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

module.exports = { getCloud: getCloud, probe: probe, PUBLIC_CONFIG: CONFIG };
