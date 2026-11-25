const q = require('../../utils/questions');
const store = require('../../utils/store');
const nav = require('../../utils/nav');
const scans = require('../../utils/scans');

const BANK_OPTIONS = [
    { key: 'all', name: '全部题库' },
    { key: 'gaoshu', name: '高等数学' },
    { key: 'xiandai', name: '线性代数' },
    { key: 'gailv', name: '概率统计' },
];

Page({
    data: {
        padTop: 64,
        bankKey: 'all',
        bankName: '全部题库',
        bankTag: '27版',
        toc: [],
        collapsed: {},
        totalAll: 0,
        doneAll: 0,
        rightAll: 0,
        rateAll: 0,
        countdown: { days: 0, year: 2026 },
        todayDone: 0,
        dailyGoal: 20,
        streakDays: 0,
        todayScoreText: '0',
        totalScore: 0,
        wrongCount: 0,
        favCount: 0,
        scanCount: 0,
        todayList: [],
        todayDoneCount: 0,
        ready: false,
        errorText: '',
    },

    onLoad() {
        this.setData({ padTop: nav.getNavMetrics().totalHeight });
        this.setData({ countdown: this.calcCountdown() });
        this.loadToc();
    },

    onShow() {
        if (this.data.ready) this.refreshProgress();
    },

    /** 考研初试按 12 月倒数第二个周六估算，仅作倒计时氛围 */
    calcCountdown() {
        const now = new Date();
        const year = now.getFullYear();
        for (let y = year; y <= year + 1; y += 1) {
            const sat = new Date(y, 11, 31);
            while (sat.getDay() !== 6) {
                sat.setDate(sat.getDate() - 1);
            }
            sat.setDate(sat.getDate() - 7);
            const start = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate());
            if (start.getTime() > now.getTime()) {
                return {
                    days: Math.ceil((start.getTime() - now.getTime()) / 86400000),
                    year: y,
                };
            }
        }
        return { days: 0, year: year };
    },

    loadToc() {
        try {
            const toc = q.getToc(this.data.bankKey);
            if (!toc.length) {
                this.setData({ ready: true, errorText: '题库为空' });
                return;
            }
            this.setData({ toc: toc, ready: true, errorText: '' });
            this.refreshProgress();
        } catch (e) {
            this.setData({ ready: true, errorText: '题库加载失败，请重试' });
        }
    },

    /** 刷新章节进度、正确率与今日数据 */
    refreshProgress() {
        const sum = store.getSummary();
        const records = sum.records;
        const stats = store.getStats();
        const dailyGoal = stats.error ? 20 : stats.data.dailyGoal || 20;
        const streak = stats.error ? 0 : stats.data.streakDays || 0;
        const wrongRes = store.getWrongList();
        const favRes = store.getFavoriteList();
        const scoreSum = store.getScoreSummary();

        const toc = this.data.toc.map((group) => {
            const chapters = group.chapters.map((c) => {
                const list = q.getByChapter(c.key);
                let done = 0;
                let right = 0;
                list.forEach((item) => {
                    const rec = records[item.id];
                    if (rec) {
                        done += 1;
                        if (rec.r) right += 1;
                    }
                });
                return Object.assign({}, c, {
                    done: done,
                    right: right,
                    rate: done ? Math.round((right / done) * 100) : 0,
                    finished: done >= c.total,
                });
            });
            let gDone = 0;
            let gRight = 0;
            let gTotal = 0;
            chapters.forEach((c) => {
                gDone += c.done;
                gRight += c.right;
                gTotal += c.total;
            });
            return Object.assign({}, group, {
                chapters: chapters,
                done: gDone,
                total: gTotal,
                rate: gDone ? Math.round((gRight / gDone) * 100) : 0,
            });
        });

        const totalAll = q.countBank(this.data.bankKey);
        let doneAll = 0;
        let rightAll = 0;
        q.QUESTIONS.forEach((item) => {
            if (this.data.bankKey !== 'all' && item.subject !== this.data.bankKey) return;
            const rec = records[item.id];
            if (rec) {
                doneAll += 1;
                if (rec.r) rightAll += 1;
            }
        });

        this.setData({
            toc: toc,
            totalAll: totalAll,
            doneAll: doneAll,
            rightAll: rightAll,
            rateAll: doneAll ? Math.round((rightAll / doneAll) * 100) : 0,
            todayDone: store.getTodayDone(),
            dailyGoal: dailyGoal,
            streakDays: streak,
            totalScore: scoreSum.total,
            todayScoreText: scoreSum.today > 0 ? '+' + scoreSum.today : (scoreSum.today < 0 ? '−' + Math.abs(scoreSum.today) : '0'),
            wrongCount: wrongRes.error ? 0 : wrongRes.data.length,
            favCount: favRes.error ? 0 : favRes.data.length,
            scanCount: scans.count(),
            todayList: this.buildTodayList(records),
        });
    },

    /** 今日一练：优先未做过的题，凑满 10 道 */
    buildTodayList(records) {
        const bank = this.data.bankKey;
        const inBank = (item) => bank === 'all' || item.subject === bank;
        const fresh = q.QUESTIONS.filter((item) => inBank(item) && !records[item.id]);
        let picked = q.shuffle(fresh).slice(0, 10);
        if (!picked.length) {
            picked = q.shuffle(q.QUESTIONS.filter(inBank)).slice(0, 10);
        }
        return picked.map((item) => q.decorate(item));
    },

    /** 切换题库 */
    switchBank() {
        const names = BANK_OPTIONS.map((b) => b.name);
        wx.showActionSheet({
            itemList: names,
            success: (res) => {
                const opt = BANK_OPTIONS[res.tapIndex];
                if (!opt || opt.key === this.data.bankKey) return;
                this.setData({ bankKey: opt.key, bankName: opt.name }, () => {
                    this.loadToc();
                });
            },
        });
    },

    /** 折叠 / 展开某个部分 */
    toggleGroup(e) {
        const key = e.currentTarget.dataset.key;
        const collapsed = Object.assign({}, this.data.collapsed);
        collapsed[key] = !collapsed[key];
        this.setData({ collapsed: collapsed });
    },

    /** 进入章节练习 */
    openChapter(e) {
        const key = e.currentTarget.dataset.key;
        this.openChapterByKey(key);
    },

    openChapterByKey(key) {
        const list = q.getByChapter(key);
        if (!list.length) {
            wx.showToast({ title: '该章节暂无题目', icon: 'none' });
            return;
        }
        const chapter = q.CHAPTER_MAP[key] || {};
        getApp().globalData.practicePayload = {
            title: chapter.name || '章节练习',
            chapterKey: key,
            subtitle: list.length + ' 题',
            list: list,
            mode: 'chapter',
        };
        wx.navigateTo({ url: '/pages/practice/practice' });
    },

    /** 今日一练 */
    startTodayPractice() {
        const list = this.data.todayList;
        if (!list.length) {
            wx.showToast({ title: '暂无可练题目', icon: 'none' });
            return;
        }
        getApp().globalData.practicePayload = {
            title: '每日一练',
            subtitle: list.length + ' 题 · 坚持第 ' + (this.data.streakDays + 1) + ' 天',
            list: list,
            mode: 'daily',
        };
        wx.navigateTo({ url: '/pages/practice/practice' });
    },

    /** 随机练习 */
    startRandom() {
        const list = q.getRandom(this.data.bankKey === 'all' ? '' : this.data.bankKey, 10);
        if (!list.length) {
            wx.showToast({ title: '题库为空', icon: 'none' });
            return;
        }
        getApp().globalData.practicePayload = {
            title: '随机练习',
            subtitle: '10 题 · 打乱顺序模拟考场',
            list: list,
            mode: 'random',
        };
        wx.navigateTo({ url: '/pages/practice/practice' });
    },

    goWrong() {
        wx.switchTab({ url: '/pages/wrong/wrong' });
    },

    goFavorite() {
        wx.navigateTo({ url: '/pages/favorite/favorite' });
    },

    goScan() {
        wx.navigateTo({ url: '/pages/scan/scan' });
    },

    goProfile() {
        wx.switchTab({ url: '/pages/profile/profile' });
    },

    onPullDownRefresh() {
        this.loadToc();
        wx.stopPullDownRefresh();
    },

    onShareAppMessage() {
        return {
            title: '黎曼考研刷题 · 数学真题免费刷',
            path: '/pages/index/index',
        };
    },
});
