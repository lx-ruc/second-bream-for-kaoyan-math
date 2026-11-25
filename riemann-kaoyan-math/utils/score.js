/**
 * 答题计分规则
 *
 * 每题按难度给满分：基础 10 分、强化 15 分、冲刺 20 分。
 *   答对  得该题满分；若这题之前做错过，再额外 +5「纠错奖励」
 *   答错  扣 5 分（累计总分最低为 0，不会变成负数）
 *
 * 累计总分决定段位，段位只和总分有关，和做题数量无关。
 */

const LEVEL_SCORE = { 1: 10, 2: 15, 3: 20 };
const WRONG_PENALTY = 5;
const FIX_BONUS = 5;

const RANKS = [
    { key: 'start', name: '起步', min: 0, desc: '刚开始，先把第一章刷完' },
    { key: 'base', name: '筑基', min: 80, desc: '手感在建立，继续保持' },
    { key: 'advance', name: '进阶', min: 200, desc: '基础扎实，可以攻重点章节' },
    { key: 'master', name: '精通', min: 400, desc: '大部分考点已拿下' },
    { key: 'sprint', name: '冲刺', min: 700, desc: '状态很好，主攻错题和难题' },
    { key: 'ashore', name: '上岸', min: 1000, desc: '这个水平放考场上很稳' },
];

/** 某题的满分 */
function fullScoreOf(question) {
    const lv = (question && question.level) || 2;
    return LEVEL_SCORE[lv] || 15;
}

/**
 * 计算一次作答的得分
 * @param {object} question 题目（需要 level）
 * @param {boolean} isCorrect 本次是否答对
 * @param {object} prevRecord 该题的历史记录 { r, n }，用于判断是否为纠错
 * @returns {{ delta:number, base:number, bonus:number, penalty:number, text:string, type:string }}
 */
function calcAnswerScore(question, isCorrect, prevRecord) {
    const base = fullScoreOf(question);
    if (isCorrect) {
        const isFix = !!(prevRecord && prevRecord.r === 0);
        const bonus = isFix ? FIX_BONUS : 0;
        const delta = base + bonus;
        return {
            delta: delta,
            base: base,
            bonus: bonus,
            penalty: 0,
            text: '+' + delta,
            type: isFix ? 'fix' : 'right',
            tip: isFix ? '纠错成功，额外 +' + FIX_BONUS : '基础分 +' + base,
        };
    }
    return {
        delta: -WRONG_PENALTY,
        base: base,
        bonus: 0,
        penalty: WRONG_PENALTY,
        text: '−' + WRONG_PENALTY,
        type: 'wrong',
        tip: '答错扣 ' + WRONG_PENALTY + ' 分，正确答案见解析',
    };
}

/** 由累计总分推段位与进度 */
function rankOf(totalScore) {
    const total = Math.max(0, Number(totalScore) || 0);
    let index = 0;
    for (let i = 0; i < RANKS.length; i += 1) {
        if (total >= RANKS[i].min) index = i;
    }
    const current = RANKS[index];
    const next = RANKS[index + 1] || null;
    const span = next ? next.min - current.min : 0;
    const progress = next
        ? Math.min(100, Math.round(((total - current.min) / span) * 100))
        : 100;
    return {
        key: current.key,
        name: current.name,
        desc: current.desc,
        min: current.min,
        next: next ? next.name : '',
        nextMin: next ? next.min : 0,
        remain: next ? Math.max(0, next.min - total) : 0,
        progress: progress,
        level: index + 1,
        maxLevel: RANKS.length,
    };
}

module.exports = {
    LEVEL_SCORE,
    WRONG_PENALTY,
    FIX_BONUS,
    RANKS,
    fullScoreOf,
    calcAnswerScore,
    rankOf,
};
