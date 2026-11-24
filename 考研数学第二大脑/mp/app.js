/**
 * 应用入口。
 *
 * 这里唯一的职责是接住 WorkBuddy 登录授权的回跳：
 * 用户在官方小程序里授权后，微信会把结果带回本小程序的 onShow，
 * SDK 从 options.referrerInfo 里读 code/state 去换会话。
 *
 * 两条纪律：
 * 1. 把 onShow 的 options **原样**交给 SDK，不做任何解析。
 * 2. 普通启动、手动返回、重复回调时 SDK 返回 { data: null, error: null }，
 *    这既不是成功也不是失败 —— 不要据此清会话，也不要自动再拉起授权。
 */
const CLOUD = require('./utils/cloud.js');

App({
    globalData: {
        appName: '黎曼刷题辅助',
    },

    onShow(options) {
        // 页面在 onShow 里 await getApp().authReady，避免换票还没完成就去读会话。
        // 云客户端初始化失败时不能让 onShow 抛错 —— App 层异常会让整个小程序起不来。
        // 这时给一个已完成的 Promise：页面照常可用，识题会在用到时给出「识别服务没连上」。
        let ready;
        try {
            ready = CLOUD.getCloud().auth.handleWorkBuddyMiniProgramCallback(options);
        } catch (err) {
            ready = Promise.resolve({ data: null, error: null });
        }
        this.authReady = ready.then(function (res) {
            // 授权失败（用户在官方小程序里拒绝、state 过期）只提示，不抛错；
            // 登录按钮保留，用户可以再点一次重新发起
            if (res && res.error) {
                wx.showToast({ title: res.error.message || '登录未完成', icon: 'none' });
            }
            return res;
        }).catch(function () {
            // 回调处理异常不拖垮启动：会话拿不到，需要登录的功能会自己提示
            return { data: null, error: null };
        });
    },
});
