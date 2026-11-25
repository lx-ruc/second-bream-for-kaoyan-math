App({
    globalData: {
        appName: '黎曼考研刷题',
        // 自定义导航需要的状态栏高度与胶囊位置
        statusBarHeight: 20,
        navBarHeight: 44,
        // 练习页之间传递的临时数据（避免长数组塞进 URL）
        practicePayload: null,
    },

    onLaunch() {
        this.computeNavMetrics();
        try {
            wx.getStorageSync('riemann_stats_v1');
        } catch (e) {
            // 忽略：存储不可用时页面会走默认值
        }
    },

    /**
     * 计算状态栏高度。用新 API，旧版本回退到 getSystemInfoSync，
     * 都失败时用默认值，保证页面不会因为取不到值而错位。
     */
    computeNavMetrics() {
        let statusBarHeight = 20;
        try {
            if (wx.getWindowInfo) {
                const info = wx.getWindowInfo();
                if (info && info.statusBarHeight) statusBarHeight = info.statusBarHeight;
            } else {
                const info = wx.getSystemInfoSync();
                if (info && info.statusBarHeight) statusBarHeight = info.statusBarHeight;
            }
        } catch (e) {
            statusBarHeight = 20;
        }

        let navBarHeight = 44;
        try {
            const rect = wx.getMenuButtonBoundingClientRect();
            if (rect && rect.height) {
                // 胶囊上下留白对称，据此推算导航栏高度
                navBarHeight = (rect.top - statusBarHeight) * 2 + rect.height;
            }
        } catch (e) {
            navBarHeight = 44;
        }

        this.globalData.statusBarHeight = statusBarHeight;
        this.globalData.navBarHeight = navBarHeight > 0 ? navBarHeight : 44;
    },
});
