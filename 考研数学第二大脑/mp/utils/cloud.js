/**
 * 云服务客户端。唯一初始化点，其它模块共用这一个实例。
 * 只使用 publicConfig 里的公开配置，不放任何密钥。
 */
const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics');

const PUBLIC_CONFIG = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_0O2obdqnkhk3o0ON9v837l_n7TVBndWZ7dYTiswWl6HrZcyvaFdkF31',
};

const cloud = createMiniProgramWorkBuddyCloud({
  endpoint: PUBLIC_CONFIG.endpoint,
  publishableKey: PUBLIC_CONFIG.publishableKey,
  wx: createDiagnosticWx(wx),
});

module.exports = { cloud: cloud, PUBLIC_CONFIG: PUBLIC_CONFIG };
