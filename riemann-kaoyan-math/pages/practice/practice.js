const store = require('../../utils/store');
const nav = require('../../utils/nav');
const scoreUtil = require('../../utils/score');
const similarity = require('../../utils/similarity');

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const LEVEL_TEXT = ['', '基础', '强化', '冲刺'];

Page({
    data: {
        padTop: 64,
        ready: false,
        errorText: '',
        title: '',
        mode: 'practice',
        total: 0,
        index: 0,
        question: null,
        options: [],
        selected: [],
        submitted: false,
        isCorrect: false,
        showAnalysis: true,
        showCard: false,
        isFav: false,
        isMulti: false,
        isLast: false,
        correctCount: 0,
        wrongCount: 0,
        myAnswerText: '',
        rightAnswerText: '',
        levelText: '',
        cardItems: [],
        // 计分
        sessionScore: 0,
        sessionScoreText: '0',
        curDeltaText: '—',
        curTip: '',
        scoreFlash: false,
        fullScore: 0,
        // 真题相似度
        similarTop: null,
        similarList: [],
        showSimilar: false,
    },

    onLoad() {
        const payload = getApp().globalData.practicePayload;
        // 本次会话内的作答结果 { [id]: { picked: [], correct: bool } }
        this.answers = {};
        this.sessionScore = 0;
        this.setData({
            padTop: nav.getNavMetrics().totalHeight,
            sessionScore: 0,
            sessionScoreText: '0',
        });

        if (!payload || !payload.list || !payload.list.length) {
            this.setData({ ready: true, errorText: '没有可练习的题目，请返回重新选择' });
            return;
        }
        this.questions = payload.list;
        this.setData({
            ready: true,
            title: payload.title || '章节练习',
            total: this.questions.length,
        });
        this.renderQuestion(0);
    },

    onUnload() {
        if (this.popTimer) clearTimeout(this.popTimer);
        getApp().globalData.practicePayload = null;
    },

    /* ---------------- 状态计算 ---------------- */

    /** 某题的最新结果：优先本次会话，其次历史记录 */
    resultOf(item) {
        const done = this.answers[item.id];
        if (done) return done.correct ? 'right' : 'wrong';
        const rec = store.getRecord(item.id);
        if (!rec) return 'none';
        return rec.r ? 'right' : 'wrong';
    },

    /** 重新计算答对/答错数量（答题卡图例与报告共用） */
    refreshCounts() {
        let right = 0;
        let wrong = 0;
        this.questions.forEach((item) => {
            const st = this.resultOf(item);
            if (st === 'right') right += 1;
            else if (st === 'wrong') wrong += 1;
        });
        this.setData({ correctCount: right, wrongCount: wrong });
        return { right: right, wrong: wrong };
    },

    buildCardItems() {
        return this.questions.map((item, i) => ({
            index: i,
            no: i + 1,
            status: this.resultOf(item),
            current: i === this.data.index,
        }));
    },

    buildOptions(item, picked, reveal) {
        const answer = item.answer || [];
        return (item.options || []).map((text, i) => {
            const isAns = answer.indexOf(i) >= 0;
            const isSel = picked.indexOf(i) >= 0;
            let state = '';
            if (reveal) {
                if (isAns) state = 'right';
                else if (isSel) state = 'wrong';
            } else if (isSel) {
                state = 'selected';
            }
            return {
                key: i,
                letter: LETTERS[i] || String(i + 1),
                text: text,
                state: state,
            };
        });
    },

    /* ---------------- 渲染 ---------------- */

    renderQuestion(index) {
        const item = this.questions[index];
        if (!item) {
            this.finish();
            return;
        }

        const isRecite = this.data.mode === 'recite';
        const done = this.answers[item.id];
        const picked = done ? done.picked : [];
        const answer = (item.answer || []).slice().sort((a, b) => a - b);

        this.setData({
            index: index,
            question: item,
            options: this.buildOptions(item, picked, isRecite || !!done),
            selected: picked,
            submitted: isRecite ? false : !!done,
            isCorrect: done ? done.correct : false,
            showAnalysis: true,
            isFav: store.isFavorite(item.id),
            isMulti: item.type === 'multi',
            isLast: index === this.questions.length - 1,
            rightAnswerText: answer.map((i) => LETTERS[i]).join(''),
            myAnswerText: picked.map((i) => LETTERS[i]).join(''),
            levelText: LEVEL_TEXT[item.level] || '强化',
            cardItems: this.buildCardItems(),
            fullScore: scoreUtil.fullScoreOf(item),
            curDeltaText: done ? done.text : '—',
            curTip: done ? done.tip : '',
            showSimilar: false,
        });
        this.loadSimilar(item);
        this.refreshCounts();
    },

    /* ---------------- 交互 ---------------- */

    switchMode(e) {
        const mode = e.currentTarget.dataset.mode;
        if (mode === this.data.mode) return;
        this.setData({ mode: mode }, () => this.renderQuestion(this.data.index));
    },

    tapOption(e) {
        if (this.data.mode === 'recite' || this.data.submitted) return;
        const key = Number(e.currentTarget.dataset.key);
        const question = this.data.question;
        if (!question) return;

        if (question.type === 'multi') {
            const selected = this.data.selected.slice();
            const pos = selected.indexOf(key);
            if (pos >= 0) selected.splice(pos, 1);
            else selected.push(key);
            selected.sort((a, b) => a - b);
            this.setData({
                selected: selected,
                options: this.data.options.map((opt) =>
                    Object.assign({}, opt, {
                        state: selected.indexOf(opt.key) >= 0 ? 'selected' : '',
                    })
                ),
            });
            return;
        }
        this.submit([key]);
    },

    submitManual() {
        if (this.data.submitted) return;
        if (!this.data.selected.length) {
            wx.showToast({ title: '请先选择答案', icon: 'none' });
            return;
        }
        this.submit(this.data.selected);
    },

    submit(selected) {
        const question = this.data.question;
        const answer = (question.answer || []).slice().sort((a, b) => a - b);
        const s = selected.slice().sort((a, b) => a - b);
        const isCorrect = s.length === answer.length && s.every((v, i) => v === answer[i]);

        // 先取历史记录，用于判断这题是不是「纠错」
        const prevRecord = store.getRecord(question.id);
        const scoreResult = scoreUtil.calcAnswerScore(question, isCorrect, prevRecord);

        this.answers[question.id] = {
            picked: s,
            correct: isCorrect,
            delta: scoreResult.delta,
            text: scoreResult.text,
            tip: scoreResult.tip,
        };

        store.markAnswered(question.id, isCorrect);
        store.touchToday();
        store.addScore(scoreResult.delta);
        if (!isCorrect) {
            store.addWrong(question.id, { subject: question.subject, chapter: question.chapter });
        }

        this.sessionScore += scoreResult.delta;

        this.setData({
            submitted: true,
            isCorrect: isCorrect,
            selected: s,
            options: this.buildOptions(question, s, true),
            myAnswerText: s.map((i) => LETTERS[i]).join(''),
            cardItems: this.buildCardItems(),
            sessionScore: this.sessionScore,
            sessionScoreText: this.formatScore(this.sessionScore),
            curDeltaText: scoreResult.text,
            curTip: scoreResult.tip,
        });
        this.refreshCounts();
        this.flashScore();

        wx.vibrateShort({ type: isCorrect ? 'light' : 'medium', fail: () => {} });
    },

    /** 计算当前题与真题库的相似度 */
    loadSimilar(item) {
        try {
            const res = similarity.analyze(item, 3);
            this.setData({
                similarTop: res.top,
                similarList: res.list,
            });
        } catch (e) {
            this.setData({ similarTop: null, similarList: [] });
        }
    },

    toggleSimilar() {
        this.setData({ showSimilar: !this.data.showSimilar });
    },

    /** 分数文本：正数带 +，负数用 − */
    formatScore(value) {
        if (!value) return '0';
        return value > 0 ? '+' + value : '−' + Math.abs(value);
    },

    /** 答完一题让分数原地放大闪一下 */
    flashScore() {
        if (this.popTimer) clearTimeout(this.popTimer);
        this.setData({ scoreFlash: false });
        this.popTimer = setTimeout(() => {
            this.setData({ scoreFlash: true });
            this.popTimer = setTimeout(() => {
                this.setData({ scoreFlash: false });
            }, 620);
        }, 30);
    },

    onUnloadClear() {
        if (this.popTimer) clearTimeout(this.popTimer);
    },

    toggleAnalysis() {
        this.setData({ showAnalysis: !this.data.showAnalysis });
    },

    openCard() {
        this.setData({ showCard: true, cardItems: this.buildCardItems() });
    },

    closeCard() {
        this.setData({ showCard: false });
    },

    jumpTo(e) {
        const index = Number(e.currentTarget.dataset.index);
        this.setData({ showCard: false }, () => this.renderQuestion(index));
    },

    toggleFav() {
        const question = this.data.question;
        if (!question) return;
        const res = store.toggleFavorite(question.id, {
            subject: question.subject,
            chapter: question.chapter,
        });
        if (res.error) {
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
            return;
        }
        this.setData({ isFav: res.data.added });
        wx.showToast({ title: res.data.added ? '已收藏' : '已取消收藏', icon: 'none' });
    },

    next() {
        const nextIndex = this.data.index + 1;
        if (nextIndex >= this.data.total) {
            // 背题模式不产生答题报告，直接退出
            if (this.data.mode === 'recite') {
                wx.showToast({ title: '已看完本章', icon: 'none' });
                setTimeout(() => wx.navigateBack(), 500);
                return;
            }
            this.finish();
            return;
        }
        this.renderQuestion(nextIndex);
    },

    prev() {
        if (this.data.index === 0) return;
        this.renderQuestion(this.data.index - 1);
    },

    back() {
        if (Object.keys(this.answers).length === 0) {
            wx.navigateBack();
            return;
        }
        wx.showModal({
            title: '退出练习',
            content: '已做的题目会计入进度，但不会生成本次练习报告。',
            confirmText: '退出',
            confirmColor: '#d94f4f',
            success: (res) => {
                if (res.confirm) wx.navigateBack();
            },
        });
    },

    finish() {
        const counts = this.refreshCounts();
        // 报告只统计已作答的题，未答的题不计入正确率
        const answered = counts.right + counts.wrong;
        const params = [
            'total=' + answered,
            'answered=' + answered,
            'correct=' + counts.right,
            'wrong=' + counts.wrong,
            'score=' + this.sessionScore,
            'title=' + encodeURIComponent(this.data.title || '练习'),
        ].join('&');
        wx.redirectTo({ url: '/pages/result/result?' + params });
    },

    onShareAppMessage() {
        return {
            title: '黎曼考研刷题 · 每天 10 题，数学稳步提分',
            path: '/pages/index/index',
        };
    },
});
