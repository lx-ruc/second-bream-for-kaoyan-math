Page({
    data: {
        title: '开始构建你的小程序',
        subtitle: '原生、轻量、可直接增量开发',
        viewState: 'ready',
        features: [
            { id: 'native', text: '原生微信小程序结构' },
            { id: 'local', text: '全部资源使用稳定本地引用' },
            { id: 'states', text: '内置加载、空态和错误态示例' },
        ],
    },

    switchState(event) {
        const nextState = event.currentTarget.dataset.state;
        this.setData({ viewState: nextState });
    },

    handleRetry() {
        this.setData({ viewState: 'loading' });
        setTimeout(() => {
            this.setData({ viewState: 'ready' });
        }, 500);
    },
});
