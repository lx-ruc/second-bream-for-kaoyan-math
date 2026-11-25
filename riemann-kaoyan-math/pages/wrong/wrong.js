const q = require('../../utils/questions');
const store = require('../../utils/store');
const nav = require('../../utils/nav');

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

Page({
    data: {
        padTop: 64,
        viewState: 'loading',
        groups: [],
        total: 0,
        expandedGroup: '',
    },

    onLoad() {
        this.setData({ padTop: nav.getNavMetrics().totalHeight });
    },

    onShow() {
        this.loadGroups();
    },

    loadGroups() {
        this.setData({ viewState: 'loading' });
        const res = store.getWrongList();
        if (res.error) {
            this.setData({ viewState: 'error' });
            return;
        }

        const records = res.data;
        // 按章节分组
        const buckets = {};
        records.forEach((rec) => {
            const item = q.getById(rec.id);
            if (!item) return;
            if (!buckets[item.chapter]) {
                buckets[item.chapter] = [];
            }
            buckets[item.chapter].push({
                id: item.id,
                question: item,
                count: rec.count || 1,
                subjectKey: item.subject,
                answerLetters: (item.answer || []).map((i) => LETTERS[i]).join(''),
                optionsView: (item.options || []).map((text, i) => ({
                    letter: LETTERS[i] || String(i + 1),
                    text: text,
                    isAnswer: (item.answer || []).indexOf(i) >= 0,
                })),
            });
        });

        // 按题库顺序排列章节
        const groups = [];
        q.CHAPTERS.forEach((c) => {
            const list = buckets[c.key];
            if (!list || !list.length) return;
            const subject = q.SUBJECTS.filter((s) => s.key === c.subject)[0] || {};
            groups.push({
                key: c.key,
                name: c.name,
                tag: c.tag,
                subjectName: subject.short || '',
                count: list.length,
                items: list,
            });
        });

        const total = groups.reduce((sum, g) => sum + g.count, 0);
        this.setData({
            viewState: total ? 'ready' : 'empty',
            groups: groups,
            total: total,
        });
    },

    /** 查看错题：展开该章节的题目列表 */
    viewGroup(e) {
        const key = e.currentTarget.dataset.key;
        this.setData({ expandedGroup: this.data.expandedGroup === key ? '' : key });
    },

    /** 重练某一章节错题 */
    redoGroup(e) {
        const key = e.currentTarget.dataset.key;
        const group = this.data.groups.filter((g) => g.key === key)[0];
        if (!group) return;
        this.startPractice(group.items, group.name);
    },

    /** 重练全部错题 */
    redoAll() {
        const all = [];
        this.data.groups.forEach((g) => {
            g.items.forEach((it) => all.push(it));
        });
        this.startPractice(all, '全部错题');
    },

    startPractice(items, title) {
        if (!items || !items.length) {
            wx.showToast({ title: '暂无可练题目', icon: 'none' });
            return;
        }
        const list = items.map((it) => it.question);
        getApp().globalData.practicePayload = {
            title: title + ' · 重练',
            subtitle: list.length + ' 题',
            list: list,
            mode: 'wrong',
        };
        wx.navigateTo({ url: '/pages/practice/practice' });
    },

    removeItem(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '移出错题集',
            content: '移出后该题的错题记录将被清除。',
            confirmText: '移出',
            confirmColor: '#d94f4f',
            success: (res) => {
                if (!res.confirm) return;
                const r = store.removeWrong(id);
                if (r.error) {
                    wx.showToast({ title: '操作失败', icon: 'none' });
                    return;
                }
                this.loadGroups();
                wx.showToast({ title: '已移出', icon: 'none' });
            },
        });
    },

    clearAll() {
        if (!this.data.total) return;
        wx.showModal({
            title: '清空错题集',
            content: '将删除全部 ' + this.data.total + ' 道错题记录，且不可恢复。',
            confirmText: '清空',
            confirmColor: '#d94f4f',
            success: (res) => {
                if (!res.confirm) return;
                store.clearWrong();
                this.setData({ expandedGroup: '' });
                this.loadGroups();
            },
        });
    },

    goPractice() {
        wx.switchTab({ url: '/pages/index/index' });
    },
});
