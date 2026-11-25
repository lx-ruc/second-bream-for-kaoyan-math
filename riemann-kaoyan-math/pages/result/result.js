const store = require('../../utils/store');
const nav = require('../../utils/nav');
const scoreUtil = require('../../utils/score');

Page({
    data: {
        padTop: 64,
        total: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
        title: '章节练习',
        level: '',
        comment: '',
        todayDone: 0,
        dailyGoal: 20,
        goalPercent: 0,
        remain: 0,
        wrongCount: 0,
        // 计分
        sessionScore: 0,
        sessionScoreText: '0',
        avgScore: 0,
        totalScore: 0,
        rankName: '',
        rankProgress: 0,
        rankNext: '',
        rankRemain: 0,
    },

    onLoad(options) {
        const total = Number(options.total) || 0;
        const correct = Number(options.correct) || 0;
        const wrong = Number(options.wrong) || Math.max(0, total - correct);
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const title = options.title ? decodeURIComponent(options.title) : '章节练习';
        const sessionScore = Number(options.score) || 0;

        let level = '待加强';
        let comment = '这些题对应的考点值得再回看一遍解析。';
        if (accuracy >= 90) {
            level = '非常稳';
            comment = '这个正确率放到考场上很稳，保持手感就行。';
        } else if (accuracy >= 75) {
            level = '较扎实';
            comment = '基础没问题，把错题吃透再冲一波。';
        } else if (accuracy >= 60) {
            level = '刚及格';
            comment = '错题对应的知识点要逐个补，别急着开新章节。';
        }

        const todayDone = store.getTodayDone();
        const stats = store.getStats();
        const goal = stats.error ? 20 : stats.data.dailyGoal || 20;
        const wrongRes = store.getWrongList();
        const scoreSum = store.getScoreSummary();
        const rank = scoreUtil.rankOf(scoreSum.total);

        this.setData({
            padTop: nav.getNavMetrics().totalHeight,
            total: total,
            correct: correct,
            wrong: wrong,
            accuracy: accuracy,
            title: title,
            level: level,
            comment: comment,
            todayDone: todayDone,
            dailyGoal: goal,
            goalPercent: Math.min(100, Math.round((todayDone / goal) * 100)),
            remain: todayDone >= goal ? 0 : goal - todayDone,
            wrongCount: wrongRes.error ? 0 : wrongRes.data.length,
            sessionScore: sessionScore,
            sessionScoreText: sessionScore > 0
                ? '+' + sessionScore
                : (sessionScore < 0 ? '−' + Math.abs(sessionScore) : '0'),
            avgScore: total ? Math.round((sessionScore / total) * 10) / 10 : 0,
            totalScore: scoreSum.total,
            rankName: rank.name,
            rankProgress: rank.progress,
            rankNext: rank.next,
            rankRemain: rank.remain,
        });
    },

    backHome() {
        wx.switchTab({ url: '/pages/index/index' });
    },

    goWrong() {
        wx.switchTab({ url: '/pages/wrong/wrong' });
    },

    again() {
        wx.switchTab({ url: '/pages/index/index' });
    },

    onShareAppMessage() {
        return {
            title: '我刚在黎曼考研刷题拿了 ' + this.data.sessionScore + ' 分，正确率 ' + this.data.accuracy + '%',
            path: '/pages/index/index',
        };
    },
});
