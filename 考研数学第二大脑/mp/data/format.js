/**
 * 试卷结构双口径（改革前 / 改革后）。
 *
 * 来源（实测转录，非推测）：
 *   python3 ~/.workbuddy/skills/kaoyan-math-second-brain/scripts/brain.py format --era both
 *   实测时间 2026-11-24，逐项照抄输出；并与 skill 的
 *   references/syllabus-history.md「二、两套完整口径对照」、
 *   references/syllabus-2027.md「试卷结构」交叉核对一致。
 *
 * 口径底线（skill 硬规则）：
 *   - 两套口径都正确，按题源年代选用；不把旧口径称为错误数据。
 *   - 2020 及以前（旧结构）套卷不能用于全真模拟计分，其分数不与现行模考比较。
 *   - 改革后口径用于 2027 备考规划、限时全真模考与倒打卡安排。
 *
 * 注：ratio 用小数存储（0.56 = 56%）；改革前为精确值，改革后为带「约」的指导性比例。
 *     H=高等数学/微积分  L=线性代数  P=概率论与数理统计；数二 P=0 表示不考概率。
 */
module.exports = {
  source: 'brain.py format --era both 实测输出（2026-11-24）；交叉核对 references/syllabus-history.md 与 syllabus-2027.md',
  pre2021: {
    label: '改革前（2020 及以前）',
    total_score: 150,
    minutes: 180,
    qcount: 23,
    objective: 56,
    objectivePct: 37,
    subjective: 94,
    choices: { count: 8, each: 4, total: 32 },
    fills: { count: 6, each: 4, total: 24 },
    solutions: { count: 9, total: 94, note: '含证明' },
    ratio: {
      数一: { H: 0.56, L: 0.22, P: 0.22 },
      数二: { H: 0.78, L: 0.22, P: 0.0 },
      数三: { H: 0.56, L: 0.22, P: 0.22 },
    },
    ratioApprox: false,
    usage: '用于读 2020 及以前真题、旧讲义、老版题库；按官方修订说明，旧结构套卷不能用于全真模拟计分。',
  },
  post2021: {
    label: '改革后（2021 年起，沿用至 2027）',
    total_score: 150,
    minutes: 180,
    qcount: 22,
    objective: 80,
    objectivePct: 53,
    subjective: 70,
    choices: { count: 10, each: 5, total: 50 },
    fills: { count: 6, each: 5, total: 30 },
    solutions: { count: 6, total: 70, note: '按难度与工作量分配，不再固定平均' },
    ratio: {
      数一: { H: 0.6, L: 0.2, P: 0.2 },
      数二: { H: 0.8, L: 0.2, P: 0.0 },
      数三: { H: 0.6, L: 0.2, P: 0.2 },
    },
    ratioApprox: true,
    usage: '用于 2027 备考规划、限时全真模考与倒打卡安排。',
  },
  diff: '客观题 +24 分、主观题 −24 分，解答题 −3 道，总题量 23 → 22；高数权重上升，线代与概率权重下降；2021 年另有约 36 处考试要求调整（多为「了解→理解/掌握」升格）。',
  disclaimer: '两套口径都正确，按题源年代选用；旧结构套卷不能计入全真模考成绩，分数不与现行模考比较。',
};
