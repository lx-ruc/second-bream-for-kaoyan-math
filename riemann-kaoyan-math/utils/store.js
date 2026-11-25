/**
 * 本地数据层：作答记录、错题、收藏、统计
 * 所有方法返回 { data, error }，不会 reject。
 */

const KEYS = {
    records: 'riemann_records_v2',
    wrong: 'riemann_wrong_v1',
    favorite: 'riemann_favorite_v1',
    stats: 'riemann_stats_v1',
};

const OK = (data) => ({ data: data, error: null });
const FAIL = (error) => ({ data: null, error: error });

function read(key, fallback) {
    try {
        const v = wx.getStorageSync(key);
        if (v === '' || v === null || v === undefined) return fallback;
        return v;
    } catch (e) {
        return fallback;
    }
}

function write(key, value) {
    try {
        wx.setStorageSync(key, value);
        return true;
    } catch (e) {
        return false;
    }
}

function pad2(n) {
    return n < 10 ? '0' + n : String(n);
}

function dateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/* ---------------- 每题作答记录 ---------------- */

/** { [questionId]: { r: 1|0, t: 时间戳, n: 作答次数 } } */
function getRecords() {
    const map = read(KEYS.records, {});
    if (!map || typeof map !== 'object' || Array.isArray(map)) return OK({});
    return OK(map);
}

function getRecord(questionId) {
    const res = getRecords();
    if (res.error) return null;
    return res.data[questionId] || null;
}

/** 记录一次作答，返回该题的最新记录。连对 2 次自动移出错题本。 */
function markAnswered(questionId, correct) {
    if (!questionId) return FAIL('INVALID_ID');
    const res = getRecords();
    if (res.error) return FAIL('CLIENT_EXCEPTION');
    const map = res.data;
    const prev = map[questionId] || { n: 0, sr: 0 };
    const streakRight = correct ? (prev.sr || 0) + 1 : 0;
    map[questionId] = {
        r: correct ? 1 : 0,
        t: Date.now(),
        n: (prev.n || 0) + 1,
        sr: streakRight,
    };
    if (!write(KEYS.records, map)) return FAIL('CLIENT_EXCEPTION');

    // 同一道题连续答对 2 次，视为已掌握，从错题本移出
    if (streakRight >= 2) {
        const wrong = read(KEYS.wrong, []);
        if (Array.isArray(wrong) && wrong.some((it) => it.id === questionId)) {
            write(KEYS.wrong, wrong.filter((it) => it.id !== questionId));
        }
    }
    return OK(map[questionId]);
}

/* ---------------- 错题本 ---------------- */

function getWrongList() {
    const list = read(KEYS.wrong, []);
    if (!Array.isArray(list)) return FAIL('CLIENT_EXCEPTION');
    return OK(list);
}

/** 记录一道错题；已存在则累加次数 */
function addWrong(questionId, meta) {
    if (!questionId) return FAIL('INVALID_ID');
    const list = read(KEYS.wrong, []);
    const arr = Array.isArray(list) ? list.slice() : [];
    const idx = arr.findIndex((it) => it.id === questionId);
    const now = Date.now();
    if (idx >= 0) {
        arr[idx] = Object.assign({}, arr[idx], {
            count: (arr[idx].count || 1) + 1,
            lastAt: now,
            chapter: (meta && meta.chapter) || arr[idx].chapter,
            subject: (meta && meta.subject) || arr[idx].subject,
        });
    } else {
        arr.unshift({
            id: questionId,
            subject: (meta && meta.subject) || '',
            chapter: (meta && meta.chapter) || '',
            count: 1,
            createdAt: now,
            lastAt: now,
        });
    }
    if (!write(KEYS.wrong, arr)) return FAIL('CLIENT_EXCEPTION');
    return OK(arr);
}

function removeWrong(questionId) {
    if (!questionId) return FAIL('INVALID_ID');
    const list = read(KEYS.wrong, []);
    const arr = Array.isArray(list) ? list : [];
    const next = arr.filter((it) => it.id !== questionId);
    if (next.length === arr.length) return FAIL('NOT_FOUND_OR_FORBIDDEN');
    if (!write(KEYS.wrong, next)) return FAIL('CLIENT_EXCEPTION');
    return OK(next);
}

function clearWrong() {
    if (!write(KEYS.wrong, [])) return FAIL('CLIENT_EXCEPTION');
    return OK([]);
}

/* ---------------- 收藏 ---------------- */

function getFavoriteList() {
    const list = read(KEYS.favorite, []);
    if (!Array.isArray(list)) return FAIL('CLIENT_EXCEPTION');
    return OK(list);
}

function isFavorite(questionId) {
    const list = read(KEYS.favorite, []);
    const arr = Array.isArray(list) ? list : [];
    return arr.some((it) => it.id === questionId);
}

/** 切换收藏状态，返回最新是否已收藏 */
function toggleFavorite(questionId, meta) {
    if (!questionId) return FAIL('INVALID_ID');
    const list = read(KEYS.favorite, []);
    const arr = Array.isArray(list) ? list.slice() : [];
    const idx = arr.findIndex((it) => it.id === questionId);
    let added = false;
    if (idx >= 0) {
        arr.splice(idx, 1);
    } else {
        arr.unshift({
            id: questionId,
            subject: (meta && meta.subject) || '',
            chapter: (meta && meta.chapter) || '',
            createdAt: Date.now(),
        });
        added = true;
    }
    if (!write(KEYS.favorite, arr)) return FAIL('CLIENT_EXCEPTION');
    return OK({ added: added, list: arr });
}

/* ---------------- 统计 ---------------- */

function todayKey() {
    return dateKey(new Date());
}

function defaultStats() {
    return {
        streakDays: 0,
        lastDay: '',
        dailyGoal: 20,
        dailyMap: {},
        // 计分：累计总分 + 按天得分
        totalScore: 0,
        scoreMap: {},
    };
}

function getStats() {
    const s = read(KEYS.stats, null);
    if (!s || typeof s !== 'object') return OK(defaultStats());
    const merged = Object.assign(defaultStats(), s);
    if (!merged.dailyMap || typeof merged.dailyMap !== 'object') merged.dailyMap = {};
    if (!merged.scoreMap || typeof merged.scoreMap !== 'object') merged.scoreMap = {};
    if (typeof merged.totalScore !== 'number') merged.totalScore = 0;
    return OK(merged);
}

/**
 * 累加得分。总分最低为 0；当天得分可以为负，用于体现「今天净扣分」。
 * @returns {{ data:{ total:number, today:number, delta:number }, error }}
 */
function addScore(delta) {
    const d = Number(delta) || 0;
    const res = getStats();
    if (res.error) return FAIL('CLIENT_EXCEPTION');
    const stats = res.data;
    const today = todayKey();
    stats.totalScore = Math.max(0, (stats.totalScore || 0) + d);
    stats.scoreMap[today] = (stats.scoreMap[today] || 0) + d;
    if (!write(KEYS.stats, stats)) return FAIL('CLIENT_EXCEPTION');
    return OK({ total: stats.totalScore, today: stats.scoreMap[today], delta: d });
}

function getScoreSummary() {
    const res = getStats();
    if (res.error) return { total: 0, today: 0 };
    const stats = res.data;
    return {
        total: stats.totalScore || 0,
        today: stats.scoreMap[todayKey()] || 0,
    };
}

/** 每日打卡计数（每题只记一次，翻看旧题不重复计） */
function touchToday() {
    const s = read(KEYS.stats, null);
    const stats = Object.assign(defaultStats(), s || {});
    if (!stats.dailyMap || typeof stats.dailyMap !== 'object') stats.dailyMap = {};
    const today = todayKey();
    stats.dailyMap[today] = (stats.dailyMap[today] || 0) + 1;

    if (stats.lastDay !== today) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yesterday = dateKey(y);
        stats.streakDays = stats.lastDay === yesterday ? (stats.streakDays || 0) + 1 : 1;
        stats.lastDay = today;
    }
    write(KEYS.stats, stats);
    return OK(stats);
}

function setDailyGoal(goal) {
    const g = Number(goal);
    if (!g || g <= 0 || g > 500) return FAIL('INVALID_PAYLOAD');
    const s = read(KEYS.stats, null);
    const stats = Object.assign(defaultStats(), s || {});
    stats.dailyGoal = g;
    if (!write(KEYS.stats, stats)) return FAIL('CLIENT_EXCEPTION');
    return OK(stats);
}

function getTodayDone() {
    const res = getStats();
    if (res.error) return 0;
    return res.data.dailyMap[todayKey()] || 0;
}

/** 汇总：总答题数、正确数、正确率（按每题最新结果统计） */
function getSummary() {
    const res = getRecords();
    const map = res.error ? {} : res.data;
    const ids = Object.keys(map);
    let right = 0;
    ids.forEach((id) => {
        if (map[id] && map[id].r) right += 1;
    });
    const done = ids.length;
    return {
        done: done,
        right: right,
        rate: done ? Math.round((right / done) * 100) : 0,
        records: map,
    };
}

/** 最近 7 天数据，供图表使用 */
function getWeekSeries() {
    const res = getStats();
    const map = res.error ? {} : res.data.dailyMap;
    const out = [];
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dateKey(d);
        out.push({ key: key, label: names[d.getDay()], value: map[key] || 0 });
    }
    let max = 1;
    out.forEach((o) => {
        if (o.value > max) max = o.value;
    });
    return out.map((o) => ({
        key: o.key,
        label: o.label,
        value: o.value,
        percent: Math.round((o.value / max) * 100),
    }));
}

function clearAll() {
    try {
        wx.removeStorageSync(KEYS.records);
        wx.removeStorageSync(KEYS.wrong);
        wx.removeStorageSync(KEYS.favorite);
        wx.removeStorageSync(KEYS.stats);
        return OK(true);
    } catch (e) {
        return FAIL('CLIENT_EXCEPTION');
    }
}

/** 清空做题记录（章节进度归零），保留错题本与收藏 */
function clearRecords() {
    if (!write(KEYS.records, {})) return FAIL('CLIENT_EXCEPTION');
    const stats = getStats();
    const keep = stats.error ? defaultStats() : stats.data;
    // 保留每日目标，其余（含得分、打卡）归零，方便二刷
    keep.streakDays = 0;
    keep.lastDay = '';
    keep.dailyMap = {};
    keep.totalScore = 0;
    keep.scoreMap = {};
    if (!write(KEYS.stats, keep)) return FAIL('CLIENT_EXCEPTION');
    return OK(true);
}

module.exports = {
    getRecords: getRecords,
    getRecord: getRecord,
    markAnswered: markAnswered,
    getWrongList: getWrongList,
    addWrong: addWrong,
    removeWrong: removeWrong,
    clearWrong: clearWrong,
    getFavoriteList: getFavoriteList,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    getStats: getStats,
    touchToday: touchToday,
    setDailyGoal: setDailyGoal,
    getTodayDone: getTodayDone,
    getSummary: getSummary,
    addScore: addScore,
    getScoreSummary: getScoreSummary,
    getWeekSeries: getWeekSeries,
    clearAll: clearAll,
    clearRecords: clearRecords,
    todayKey: todayKey,
};
