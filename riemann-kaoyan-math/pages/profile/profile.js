const q = require('../../utils/questions');
const store = require('../../utils/store');
const nav = require('../../utils/nav');
const scoreUtil = require('../../utils/score');
const scans = require('../../utils/scans');

// 雷达图几何：从正上方开始，顺时针每 60° 一个维度
const START_ANGLE = -90;
const STEP_ANGLE = 60;
const RING_COUNT = 4;

Page({
    data: {
        padTop: 64,
        done: 0,
        right: 0,
        rate: 0,
        total: 0,
        streakDays: 0,
        todayDone: 0,
        dailyGoal: 20,
        wrongCount: 0,
        favCount: 0,
        weekSeries: [],
        goalPercent: 0,
        // 能力图
        radar: [],
        radarLabels: [],
        radarReady: false,
        radarFailed: false,
        radarTip: '',
        strongest: null,
        weakest: null,
        // 得分与段位
        totalScore: 0,
        todayScore: 0,
        todayScoreText: '0',
        rankName: '',
        rankLevel: 1,
        rankProgress: 0,
        rankNext: '',
        rankRemain: 0,
        rankDesc: '',
        scanCount: 0,
    },

    onLoad() {
        this.setData({ padTop: nav.getNavMetrics().totalHeight });
    },

    onShow() {
        this.loadAll();
    },

    onReady() {
        this.initRadar();
    },

    loadAll() {
        const sum = store.getSummary();
        const stats = store.getStats();
        const goal = stats.error ? 20 : stats.data.dailyGoal || 20;
        const wrongRes = store.getWrongList();
        const favRes = store.getFavoriteList();
        const todayDone = store.getTodayDone();
        const radar = q.calcAbility(sum.records);
        const scoreSum = store.getScoreSummary();
        const rank = scoreUtil.rankOf(scoreSum.total);

        // 只在该维度有足够样本时才参与「最稳 / 待补」的评选
        const MIN_SAMPLE = 3;
        const touched = radar.filter((r) => r.done >= MIN_SAMPLE);
        let strongest = null;
        let weakest = null;
        touched.forEach((r) => {
            if (!strongest || r.value > strongest.value) strongest = r;
            if (!weakest || r.value < weakest.value) weakest = r;
        });

        this.setData({
            done: sum.done,
            right: sum.right,
            rate: sum.rate,
            total: q.QUESTIONS.length,
            streakDays: stats.error ? 0 : stats.data.streakDays || 0,
            todayDone: todayDone,
            dailyGoal: goal,
            goalPercent: Math.min(100, Math.round((todayDone / goal) * 100)),
            wrongCount: wrongRes.error ? 0 : wrongRes.data.length,
            favCount: favRes.error ? 0 : favRes.data.length,
            weekSeries: store.getWeekSeries(),
            totalScore: scoreSum.total,
            todayScore: scoreSum.today,
            todayScoreText: scoreSum.today > 0 ? '+' + scoreSum.today : (scoreSum.today < 0 ? '−' + Math.abs(scoreSum.today) : '0'),
            rankName: rank.name,
            rankLevel: rank.level,
            rankProgress: rank.progress,
            rankNext: rank.next,
            rankRemain: rank.remain,
            rankDesc: rank.desc,
            scanCount: scans.count(),
            radar: radar,
            radarLabels: this.buildLabels(radar),
            radarTip: sum.done === 0
                ? '先刷几道题，六个维度会跟着你的对错表现长出来'
                : '按刷题记录实时估算，点右上角「算法」看口径',
            strongest: strongest,
            weakest: touched.length >= 2 && weakest && weakest.key !== strongest.key ? weakest : null,
        }, () => {
            this.drawRadar();
        });
    },

    /** 六个维度标签的定位（百分比，相对画布方框） */
    buildLabels(radar) {
        return radar.map((axis, i) => {
            const rad = ((START_ANGLE + i * STEP_ANGLE) * Math.PI) / 180;
            const x = 50 + Math.cos(rad) * 44;
            const y = 50 + Math.sin(rad) * 44;
            return {
                key: axis.key,
                name: axis.name,
                text: axis.empty ? '—' : String(axis.value),
                style: 'left: ' + x.toFixed(1) + '%; top: ' + y.toFixed(1) + '%;',
            };
        });
    },

    /** 六维能力口径说明 */
    showRadarRules() {
        const lines = q.RADAR_RULES.map((r, i) => (i + 1) + '. ' + r.name + '：' + r.desc);
        wx.showModal({
            title: '能力值怎么算',
            content: lines.join('\n'),
            showCancel: false,
            confirmText: '知道了',
        });
    },

    /** 获取 canvas 节点 */
    initRadar() {
        if (this.radarCtx) {
            this.drawRadar();
            return;
        }
        const query = wx.createSelectorQuery();
        query
            .select('#radar-canvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                const item = res && res[0];
                if (!item || !item.node || !item.width) {
                    this.setData({ radarReady: false, radarFailed: true });
                    return;
                }
                const canvas = item.node;
                const ctx = canvas.getContext('2d');
                let dpr = 2;
                try {
                    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
                    dpr = (info && info.pixelRatio) || 2;
                } catch (e) {
                    dpr = 2;
                }
                canvas.width = item.width * dpr;
                canvas.height = item.height * dpr;
                ctx.scale(dpr, dpr);

                this.radarCanvas = canvas;
                this.radarCtx = ctx;
                this.radarSize = { w: item.width, h: item.height };
                this.setData({ radarReady: true, radarFailed: false });
                this.drawRadar();
            });
    },

    /** 绘制雷达图 */
    drawRadar() {
        const ctx = this.radarCtx;
        const radar = this.data.radar;
        if (!ctx || !radar || !radar.length) return;

        const size = this.radarSize;
        const w = size.w;
        const h = size.h;
        const cx = w / 2;
        const cy = h / 2;
        // 六边形只占画布中间 68%，外圈留给维度标签
        const R = Math.min(w, h) * 0.34;
        const n = radar.length;

        const pointAt = (index, ratio) => {
            const rad = ((START_ANGLE + index * STEP_ANGLE) * Math.PI) / 180;
            return {
                x: cx + Math.cos(rad) * R * ratio,
                y: cy + Math.sin(rad) * R * ratio,
            };
        };

        ctx.clearRect(0, 0, w, h);

        // 网格环
        for (let ring = 1; ring <= RING_COUNT; ring += 1) {
            const ratio = ring / RING_COUNT;
            ctx.beginPath();
            for (let i = 0; i < n; i += 1) {
                const p = pointAt(i, ratio);
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.strokeStyle = ring === RING_COUNT ? '#dbe1ee' : '#edf0f7';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 轴线
        for (let i = 0; i < n; i += 1) {
            const p = pointAt(i, 1);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = '#eef1f7';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 数据多边形
        ctx.beginPath();
        for (let i = 0; i < n; i += 1) {
            const ratio = Math.max(0.02, Math.min(1, radar[i].value / 100));
            const p = pointAt(i, ratio);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(43, 74, 203, 0.16)';
        ctx.fill();
        ctx.strokeStyle = '#2b4acb';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 数据点
        for (let i = 0; i < n; i += 1) {
            const ratio = Math.max(0.02, Math.min(1, radar[i].value / 100));
            const p = pointAt(i, ratio);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#2b4acb';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    },

    handleTap(e) {
        const type = e.currentTarget.dataset.type;
        if (type === 'wrong') {
            wx.switchTab({ url: '/pages/wrong/wrong' });
        } else if (type === 'fav') {
            wx.navigateTo({ url: '/pages/favorite/favorite' });
        } else if (type === 'scan') {
            wx.navigateTo({ url: '/pages/scan/scan' });
        } else if (type === 'goal') {
            this.editGoal();
        } else if (type === 'reset') {
            this.resetRecords();
        } else if (type === 'about') {
            wx.showModal({
                title: '关于黎曼考研刷题',
                content: '考研数学刷题工具，覆盖高等数学、线性代数、概率统计三大科目，共 ' + q.QUESTIONS.length + ' 道题。所有数据保存在本机，不上传服务器。',
                showCancel: false,
                confirmText: '知道了',
            });
        }
    },

    editGoal() {
        const that = this;
        wx.showActionSheet({
            itemList: ['10 题 / 天', '20 题 / 天', '30 题 / 天', '50 题 / 天'],
            success(res) {
                const goal = [10, 20, 30, 50][res.tapIndex];
                const r = store.setDailyGoal(goal);
                if (r.error) {
                    wx.showToast({ title: '设置失败', icon: 'none' });
                    return;
                }
                wx.showToast({ title: '已设为 ' + goal + ' 题', icon: 'none' });
                that.loadAll();
            },
        });
    },

    resetRecords() {
        wx.showModal({
            title: '清空做题记录',
            content: '章节进度、正确率和打卡记录会归零，错题集与收藏保留。',
            confirmText: '清空',
            confirmColor: '#d94f4f',
            success: (res) => {
                if (!res.confirm) return;
                const r = store.clearRecords();
                if (r.error) {
                    wx.showToast({ title: '清空失败', icon: 'none' });
                    return;
                }
                wx.showToast({ title: '已清空', icon: 'none' });
                this.loadAll();
            },
        });
    },

    onShareAppMessage() {
        return {
            title: '黎曼考研刷题 · 数学提分就靠每天这几道题',
            path: '/pages/index/index',
        };
    },
});
