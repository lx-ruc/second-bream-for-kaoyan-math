const q = require('../../utils/questions');
const store = require('../../utils/store');
const nav = require('../../utils/nav');

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

Page({
    data: {
        padTop: 64,
        viewState: 'loading',
        list: [],
        total: 0,
        expandedId: '',
    },

    onLoad() {
        this.setData({ padTop: nav.getNavMetrics().totalHeight });
    },

    onShow() {
        this.loadList();
    },

    loadList() {
        const res = store.getFavoriteList();
        if (res.error) {
            this.setData({ viewState: 'error' });
            return;
        }
        const items = res.data
            .map((rec) => {
                const item = q.getById(rec.id);
                if (!item) return null;
                const chapter = q.CHAPTER_MAP[item.chapter] || {};
                const subject = q.SUBJECTS.filter((s) => s.key === item.subject)[0] || {};
                return {
                    id: item.id,
                    question: item,
                    chapterName: chapter.name || '',
                    subjectName: subject.short || '',
                    answerLetters: (item.answer || []).map((i) => LETTERS[i]).join(''),
                    optionsView: (item.options || []).map((text, i) => ({
                        letter: LETTERS[i] || String(i + 1),
                        text: text,
                        isAnswer: (item.answer || []).indexOf(i) >= 0,
                    })),
                };
            })
            .filter(Boolean);

        this.setData({
            viewState: items.length ? 'ready' : 'empty',
            list: items,
            total: items.length,
        });
    },

    toggleExpand(e) {
        const id = e.currentTarget.dataset.id;
        this.setData({ expandedId: this.data.expandedId === id ? '' : id });
    },

    removeItem(e) {
        const id = e.currentTarget.dataset.id;
        const r = store.toggleFavorite(id);
        if (r.error) {
            wx.showToast({ title: '操作失败', icon: 'none' });
            return;
        }
        wx.showToast({ title: '已取消收藏', icon: 'none' });
        this.setData({ expandedId: '' });
        this.loadList();
    },

    practiceAll() {
        if (!this.data.list.length) return;
        const list = this.data.list.map((it) => it.question);
        getApp().globalData.practicePayload = {
            title: '收藏夹练习',
            subtitle: list.length + ' 题',
            list: list,
            mode: 'favorite',
        };
        wx.navigateTo({ url: '/pages/practice/practice' });
    },

    goPractice() {
        wx.switchTab({ url: '/pages/index/index' });
    },
});
