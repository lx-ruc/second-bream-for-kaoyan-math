/**
 * 题目与真题的相似度分析
 *
 * 思路（全部可解释，不依赖任何模型服务）：
 *  1. 文本覆盖度：把题干拆成「中文二元组 + 英文/数字词」，用 IDF 加权，
 *     计算真题摘要里的信息有多少比例被这道题覆盖。
 *  2. 考点重合度：真题标注的考点关键词有多少出现在题干与选项里。
 *  3. 章节归属：同章节满分，同科目但不同章节给部分分。
 *
 * 总分 = 100 × (0.55 × 章节归属 + 0.30 × 考点重合 + 0.15 × 文本覆盖)
 *
 * 权重这样分配的原因：题库里有大量「纯公式题干」（例如只写 lim sin3x/x），
 * 没有任何中文词，文本比对天然吃亏；真正决定像不像真题的是它考的是不是同一个章节、
 * 同一批考点。所以章节与考点占主导，文本覆盖只作为加分项。
 */

const bank = require('./exam-bank');

/* ---------------- 分词 ---------------- */

const SEP = /[\s，。、；：？！“”‘’（）()《》【】,.;:?!"'\-—…·]/;

function tokenize(text) {
    const src = String(text || '').toLowerCase();
    const tokens = [];

    // 英文与数字
    const words = src.match(/[a-z0-9]+/g) || [];
    for (let i = 0; i < words.length; i += 1) tokens.push(words[i]);

    // 中文按二元组切分
    const segs = src.split(SEP);
    for (let s = 0; s < segs.length; s += 1) {
        const seg = segs[s].replace(/[^\u4e00-\u9fa5]/g, '');
        for (let i = 0; i + 1 < seg.length; i += 1) {
            tokens.push(seg.substr(i, 2));
        }
        if (seg.length === 1) tokens.push(seg);
    }
    return tokens;
}

function countMap(tokens) {
    const map = {};
    for (let i = 0; i < tokens.length; i += 1) {
        const t = tokens[i];
        map[t] = (map[t] || 0) + 1;
    }
    return map;
}

/* ---------------- 索引 ---------------- */

let INDEX = null;

function buildIndex() {
    const docs = bank.EXAM_ITEMS.map((item) => {
        const text = item.stem + ' ' + (item.topics || []).join(' ');
        const tokens = tokenize(text);
        return {
            item: item,
            tokens: tokens,
            tf: countMap(tokens),
        };
    });

    // 文档频率
    const df = {};
    docs.forEach((doc) => {
        const seen = {};
        doc.tokens.forEach((t) => {
            if (seen[t]) return;
            seen[t] = 1;
            df[t] = (df[t] || 0) + 1;
        });
    });

    const total = docs.length;
    const idf = {};
    Object.keys(df).forEach((t) => {
        idf[t] = Math.log((total + 1) / (df[t] + 1)) + 1;
    });

    // 每条真题的加权词表（去重后取权重）
    docs.forEach((doc) => {
        const weights = {};
        Object.keys(doc.tf).forEach((t) => {
            weights[t] = (idf[t] || 1) * (1 + Math.log(doc.tf[t]));
        });
        doc.weights = weights;
        let sum = 0;
        Object.keys(weights).forEach((t) => {
            sum += weights[t];
        });
        doc.sumWeight = sum || 1;
    });

    INDEX = { docs: docs, idf: idf };
    return INDEX;
}

function getIndex() {
    return INDEX || buildIndex();
}

/* ---------------- 打分 ---------------- */

function chapterScore(question, item) {
    if (question.chapter === item.chapter) return 1;
    if (question.chapter && item.chapter) {
        const prefix = question.chapter.slice(0, 2);
        if (item.chapter.slice(0, 2) === prefix) return 0.55;
    }
    return 0.12;
}

/**
 * 考点命中：按命中比例给分，并做轻微上浮，避免「只命中 1 个」被压得过低。
 * 命中 1/3 → 0.55，2/3 → 0.81，3/3 → 1
 */
function topicScore(questionText, item) {
    const topics = item.topics || [];
    if (!topics.length) return 0;
    let hit = 0;
    topics.forEach((t) => {
        if (questionText.indexOf(t) >= 0) hit += 1;
    });
    if (!hit) return 0;
    const ratio = hit / topics.length;
    return Math.min(1, Math.pow(ratio, 0.55));
}

function textCoverage(qWeights, qSet, doc) {
    let covered = 0;
    Object.keys(doc.weights).forEach((t) => {
        if (qSet[t]) covered += doc.weights[t];
    });
    return Math.min(1, covered / doc.sumWeight);
}

function levelOf(score) {
    if (score >= 82) return { key: 'high', text: '高度相似' };
    if (score >= 70) return { key: 'mid', text: '较相似' };
    if (score >= 56) return { key: 'low', text: '部分相关' };
    return { key: 'weak', text: '关联较弱' };
}

/**
 * 计算某道题与真题库的相似度
 * @param {object} question 题目（需要 plain/options/subject/chapter）
 * @param {number} limit 返回前 N 条
 */
function analyze(question, limit) {
    if (!question) return { list: [], top: null };
    const index = getIndex();

    const questionText = [question.plain || '']
        .concat(question.options || [])
        .concat(question.analysis || '')
        .join(' ');
    const qTokens = tokenize(questionText);
    const qSet = {};
    qTokens.forEach((t) => {
        qSet[t] = 1;
    });
    const qTf = countMap(qTokens);

    const scored = index.docs.map((doc) => {
        const text = textCoverage(qTf, qSet, doc);
        const chap = chapterScore(question, doc.item);
        const topic = topicScore(questionText, doc.item);

        const raw = 0.55 * chap + 0.3 * topic + 0.15 * text;
        const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

        return {
            id: doc.item.id,
            year: doc.item.year,
            paper: doc.item.paper,
            paperName: bank.paperName(doc.item.paper),
            no: doc.item.no,
            scoreWeight: doc.item.score,
            chapter: doc.item.chapter,
            topics: doc.item.topics || [],
            stem: doc.item.stem,
            score: score,
            level: levelOf(score).key,
            levelText: levelOf(score).text,
            detail: {
                text: Math.round(text * 100),
                topic: Math.round(topic * 100),
                chapter: Math.round(chap * 100),
            },
        };
    });

    scored.sort((a, b) => b.score - a.score);
    const list = scored.slice(0, limit || 3);
    return { list: list, top: list[0] || null };
}

module.exports = {
    tokenize: tokenize,
    analyze: analyze,
    levelOf: levelOf,
};
