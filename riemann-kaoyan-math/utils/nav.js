/**
 * 自定义导航栏尺寸。
 * 页面用 navigationStyle: custom 时，需要自己给顶部让出状态栏的高度。
 */

function getNavMetrics() {
    const app = getApp();
    const g = (app && app.globalData) || {};
    const statusBarHeight = g.statusBarHeight || 20;
    const navBarHeight = g.navBarHeight || 44;
    return {
        statusBarHeight: statusBarHeight,
        navBarHeight: navBarHeight,
        // 顶部安全区总高度
        totalHeight: statusBarHeight + navBarHeight,
    };
}

module.exports = {
    getNavMetrics: getNavMetrics,
};
