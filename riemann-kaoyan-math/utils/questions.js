/**
 * 黎曼考研刷题 - 本地题库
 *
 * 题目结构：
 *   id        唯一标识
 *   subject   科目 key（gaoshu / xiandai / gailv）
 *   chapter   章节 key
 *   type      single(单选) | multi(多选) | judge(判断)
 *   stem      纯文本题干（与 blocks 二选一）
 *   blocks    结构化题干，支持 tx 文本 / fr 分式 / lim 极限 / mx 矩阵
 *   options   选项文本数组
 *   answer    正确选项下标数组
 *   analysis  解析
 *   level     难度 1-3
 */

const SUBJECTS = [
    {
        key: 'gaoshu',
        name: '高等数学',
        short: '高数',
        color: '#2B4ACB',
        desc: '极限 · 微分 · 积分 · 级数',
    },
    {
        key: 'xiandai',
        name: '线性代数',
        short: '线代',
        color: '#7B3FE4',
        desc: '行列式 · 矩阵 · 方程组',
    },
    {
        key: 'gailv',
        name: '概率统计',
        short: '概率',
        color: '#0E9F6E',
        desc: '随机变量 · 分布 · 数字特征',
    },
];

const CHAPTERS = [
    { key: 'gs1', subject: 'gaoshu', name: '函数、极限与连续', tag: '基础' },
    { key: 'gs2', subject: 'gaoshu', name: '一元函数微分学', tag: '核心' },
    { key: 'gs3', subject: 'gaoshu', name: '一元函数积分学', tag: '核心' },
    { key: 'gs4', subject: 'gaoshu', name: '多元函数微积分', tag: '重点' },
    { key: 'gs5', subject: 'gaoshu', name: '无穷级数', tag: '数一/数三' },
    { key: 'gs6', subject: 'gaoshu', name: '常微分方程', tag: '高频' },
    { key: 'xd1', subject: 'xiandai', name: '行列式', tag: '基础' },
    { key: 'xd2', subject: 'xiandai', name: '矩阵', tag: '核心' },
    { key: 'xd3', subject: 'xiandai', name: '向量与线性方程组', tag: '重点' },
    { key: 'xd4', subject: 'xiandai', name: '特征值与二次型', tag: '高频' },
    { key: 'gl1', subject: 'gailv', name: '随机事件与概率', tag: '基础' },
    { key: 'gl2', subject: 'gailv', name: '一维随机变量', tag: '核心' },
    { key: 'gl3', subject: 'gailv', name: '多维随机变量', tag: '重点' },
    { key: 'gl4', subject: 'gailv', name: '数字特征', tag: '高频' },
];

const QUESTIONS = [
    /* ================= 高等数学 · 第1章 极限与连续 ================= */
    {
        id: 'gs1-01',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        blocks: [
            { t: 'tx', v: '求下列极限：' },
            { t: 'lim', sub: 'x→0', v: 'sin 3x / x' },
        ],
        options: ['0', '1', '3', '不存在'],
        answer: [2],
        analysis: 'sin 3x / x = 3 · (sin 3x)/(3x)，而 sin 3x/(3x) → 1，故原式 = 3。',
        level: 1,
    },
    {
        id: 'gs1-02',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        blocks: [
            { t: 'tx', v: '求下列极限：' },
            { t: 'lim', sub: 'x→∞', v: '(1 + 2/x)ˣ' },
        ],
        options: ['e', 'e²', '2e', '+∞'],
        answer: [1],
        analysis: '凑第二重要极限：(1 + 2/x)ˣ = [(1 + 2/x)^(x/2)]² → e²。',
        level: 2,
    },
    {
        id: 'gs1-03',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        stem: '当 x→0 时，下列无穷小中与 x 等价的是：',
        options: ['sin x', '1 − cos x', 'ln(1 + x²)', 'eˣ − 1 − x'],
        answer: [0],
        analysis: 'sin x ~ x；1 − cos x ~ x²/2；ln(1 + x²) ~ x²；eˣ − 1 − x ~ x²/2。只有 sin x 与 x 等价。',
        level: 2,
    },
    {
        id: 'gs1-04',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        blocks: [
            { t: 'tx', v: '设 f(x) = (x² − 1)/(x − 1)，x ≠ 1。若 f 在 x = 1 处连续，则 f(1) =' },
        ],
        options: ['0', '1', '2', '不存在'],
        answer: [2],
        analysis: 'x ≠ 1 时 (x² − 1)/(x − 1) = x + 1，故 lim(x→1) f(x) = 2。令 f(1) = 2 即可连续。',
        level: 1,
    },
    {
        id: 'gs1-05',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        blocks: [{ t: 'tx', v: 'x = 0 是函数 f(x) = sin x / x 的' }],
        options: ['可去间断点', '跳跃间断点', '无穷间断点', '振荡间断点'],
        answer: [0],
        analysis: 'f 在 x = 0 处无定义，但 lim(x→0) sin x / x = 1 存在，补充定义 f(0) = 1 即连续，属可去间断点。',
        level: 2,
    },
    {
        id: 'gs1-06',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        blocks: [{ t: 'lim', sub: 'x→0', v: '(1 − cos x) / x²' }],
        options: ['1/2', '1', '0', '2'],
        answer: [0],
        analysis: '1 − cos x ~ x²/2，故原式 = lim (x²/2)/x² = 1/2。',
        level: 2,
    },
    {
        id: 'gs1-07',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        blocks: [
            { t: 'tx', v: '设 f(x) = x·sin(1/x)（x ≠ 0），f(0) = 0，则 f 在 x = 0 处' },
        ],
        options: ['连续但不可导', '可导且导数为 0', '不连续', '无定义'],
        answer: [0],
        analysis: '|f(x)| ≤ |x| → 0，故 f 在 0 处连续；但差商 f(x)/x = sin(1/x) 当 x→0 时无极限，故不可导。',
        level: 3,
    },
    {
        id: 'gs1-08',
        subject: 'gaoshu',
        chapter: 'gs1',
        type: 'single',
        blocks: [{ t: 'lim', sub: 'x→0⁺', v: 'x · ln x' }],
        options: ['0', '−∞', '1', '不存在'],
        answer: [0],
        analysis: '写成 ln x/(1/x)，用洛必达法则：(1/x)/(−1/x²) = −x → 0。',
        level: 3,
    },

    /* ================= 高等数学 · 第2章 微分学 ================= */
    {
        id: 'gs2-01',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 y = x³eˣ，则 y′ =' }],
        options: ['3x²eˣ', 'x²eˣ(x + 3)', 'x³eˣ', 'eˣ(x³ + 3x² + x)'],
        answer: [1],
        analysis: '乘积法则：y′ = 3x²eˣ + x³eˣ = x²eˣ(3 + x)。',
        level: 1,
    },
    {
        id: 'gs2-02',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [{ t: 'tx', v: '曲线 y = x³ − 3x 的拐点是' }],
        options: ['(0, 0)', '(1, −2)', '(−1, 2)', '该曲线没有拐点'],
        answer: [0],
        analysis: 'y″ = 6x，在 x = 0 两侧变号，y(0) = 0，故拐点为 (0, 0)。注意 (±1, ∓2) 是极值点。',
        level: 2,
    },
    {
        id: 'gs2-03',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [{ t: 'tx', v: '函数 f(x) = |x| 在 x = 0 处' }],
        options: ['连续但不可导', '可导且 f′(0) = 0', '不连续', '可导且 f′(0) = 1'],
        answer: [0],
        analysis: '左导数 = −1，右导数 = 1，不相等，故不可导；但函数本身连续。',
        level: 1,
    },
    {
        id: 'gs2-04',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [{ t: 'tx', v: '函数 y = x − ln(1 + x) 在 (−1, +∞) 内的极小值是' }],
        options: ['0', '1', '−1', '不存在极小值'],
        answer: [0],
        analysis: 'y′ = 1 − 1/(1 + x) = x/(1 + x)。(−1, 0) 内 y′ < 0，(0, +∞) 内 y′ > 0，故 x = 0 取极小值 y = 0。',
        level: 2,
    },
    {
        id: 'gs2-05',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 y = x·arctan x，则 y″(0) =' }],
        options: ['0', '1', '2', '−1'],
        answer: [2],
        analysis: 'y′ = arctan x + x/(1 + x²)；求导得 y″ = 1/(1 + x²) + (1 − x²)/(1 + x²)² = 2/(1 + x²)²，故 y″(0) = 2。',
        level: 3,
    },
    {
        id: 'gs2-06',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [
            { t: 'tx', v: '设 f(x) = x³ + ax² + bx 在 x = 1 处取得极值 −2，则 (a, b) =' },
        ],
        options: ['(0, −3)', '(−3, 0)', '(1, −3)', '(0, 3)'],
        answer: [0],
        analysis: 'f(1) = 1 + a + b = −2，f′(1) = 3 + 2a + b = 0。解得 a = 0，b = −3，此时 f′(x) = 3x² − 3，x = 1 确为极小值点。',
        level: 3,
    },
    {
        id: 'gs2-07',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [
            { t: 'tx', v: '函数 f(x) = x³ 在 [0, 1] 上满足拉格朗日中值定理结论的 ξ =' },
        ],
        options: ['1/3', '√3/3', '1/2', '2/3'],
        answer: [1],
        analysis: 'f′(ξ) = 3ξ² = [f(1) − f(0)]/(1 − 0) = 1，得 ξ = 1/√3 = √3/3 ∈ (0, 1)。',
        level: 2,
    },
    {
        id: 'gs2-08',
        subject: 'gaoshu',
        chapter: 'gs2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 y = ln x，当 x = 2、Δx = 0.1 时，微分 dy =' }],
        options: ['0.05', '0.1', '0.5', '0.025'],
        answer: [0],
        analysis: 'dy = (1/x)dx = 0.1/2 = 0.05（这里 dx = Δx = 0.1）。',
        level: 1,
    },

    /* ================= 高等数学 · 第3章 积分学 ================= */
    {
        id: 'gs3-01',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '计算定积分：' }, { t: 'tx', v: '∫₀¹ x² dx =' }],
        options: ['1/2', '1/3', '1/4', '1'],
        answer: [1],
        analysis: '∫₀¹x²dx = x³/3 |₀¹ = 1/3。',
        level: 1,
    },
    {
        id: 'gs3-02',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '计算不定积分：' }, { t: 'tx', v: '∫ x·eˣ dx =' }],
        options: ['eˣ(x + 1) + C', 'eˣ(x − 1) + C', 'x·eˣ + C', 'eˣ(x − 1)'],
        answer: [1],
        analysis: '分部积分：∫x eˣdx = x eˣ − ∫eˣdx = eˣ(x − 1) + C。不定积分必须带常数 C。',
        level: 2,
    },
    {
        id: 'gs3-03',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '求导：' }, { t: 'tx', v: 'd/dx ∫₀ˣ sin t² dt =' }],
        options: ['sin x²', 'cos x²', '2x·sin x²', 'sin x'],
        answer: [0],
        analysis: '变上限积分求导直接替换上限：d/dx ∫₀ˣ f(t)dt = f(x)，故为 sin x²。',
        level: 2,
    },
    {
        id: 'gs3-04',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '∫ dx / (1 + x²) =' }],
        options: ['arctan x + C', 'ln(1 + x²) + C', 'arcsin x + C', '1/(1 + x²) + C'],
        answer: [0],
        analysis: '基本积分公式：∫dx/(1 + x²) = arctan x + C。',
        level: 1,
    },
    {
        id: 'gs3-05',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '反常积分 ∫₁^∞ dx / xᵖ 收敛的充要条件是' }],
        options: ['p > 0', 'p ≥ 1', 'p > 1', '0 < p < 1'],
        answer: [2],
        analysis: 'p ≠ 1 时原函数为 x^(1−p)/(1−p)，当且仅当 1 − p < 0 即 p > 1 时积分收敛；p = 1 时发散。',
        level: 2,
    },
    {
        id: 'gs3-06',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '∫₋₁¹ (x³ + 2) dx =' }],
        options: ['0', '2', '4', '8'],
        answer: [2],
        analysis: 'x³ 是奇函数，在对称区间积分为 0；∫₋₁¹2dx = 4。故结果为 4。',
        level: 2,
    },
    {
        id: 'gs3-07',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '曲线 y = x² 与直线 y = x 所围图形的面积是' }],
        options: ['1/6', '1/3', '1/2', '1'],
        answer: [0],
        analysis: '交点 x = 0, 1。面积 = ∫₀¹(x − x²)dx = 1/2 − 1/3 = 1/6。',
        level: 2,
    },
    {
        id: 'gs3-08',
        subject: 'gaoshu',
        chapter: 'gs3',
        type: 'single',
        blocks: [{ t: 'tx', v: '若 ∫ f(x)dx = x²eˣ + C，则 f(x) =' }],
        options: ['2x·eˣ', 'x·eˣ(x + 2)', 'x²eˣ', 'eˣ(x² + 2)'],
        answer: [1],
        analysis: '两边求导：f(x) = (x²eˣ)′ = 2xeˣ + x²eˣ = xeˣ(x + 2)。',
        level: 2,
    },

    /* ================= 高等数学 · 第4章 多元微积分 ================= */
    {
        id: 'gs4-01',
        subject: 'gaoshu',
        chapter: 'gs4',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 z = x²y + xy²，则 ∂z/∂x =' }],
        options: ['2xy + y²', 'x² + 2xy', '2x + y²', '2xy'],
        answer: [0],
        analysis: '对 x 求偏导时把 y 视为常数：(x²y)′ = 2xy，(xy²)′ = y²，故为 2xy + y²。',
        level: 1,
    },
    {
        id: 'gs4-02',
        subject: 'gaoshu',
        chapter: 'gs4',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 z = e^(xy)，在点 (1, 0) 处 ∂z/∂y =' }],
        options: ['0', '1', 'e', 'x·e^(xy)'],
        answer: [1],
        analysis: '∂z/∂y = x·e^(xy)，代入 (1, 0) 得 1·e⁰ = 1。',
        level: 2,
    },
    {
        id: 'gs4-03',
        subject: 'gaoshu',
        chapter: 'gs4',
        type: 'single',
        blocks: [
            { t: 'tx', v: '设 D: 0 ≤ x ≤ 1，0 ≤ y ≤ 2，则 ∬_D dxdy =' },
        ],
        options: ['1', '2', '3', '4'],
        answer: [1],
        analysis: '被积函数为 1 时二重积分等于区域面积：1 × 2 = 2。',
        level: 1,
    },
    {
        id: 'gs4-04',
        subject: 'gaoshu',
        chapter: 'gs4',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 z = x² + y²，在点 (1, 1) 处的全微分 dz =' }],
        options: ['2dx + 2dy', 'dx + dy', '2dx', '4'],
        answer: [0],
        analysis: 'dz = 2x dx + 2y dy，代入 (1, 1) 得 dz = 2dx + 2dy。',
        level: 2,
    },
    {
        id: 'gs4-05',
        subject: 'gaoshu',
        chapter: 'gs4',
        type: 'single',
        blocks: [{ t: 'tx', v: '函数 z = x² − y² 的驻点 (0, 0) 是' }],
        options: ['极小值点', '极大值点', '鞍点', '不是驻点'],
        answer: [2],
        analysis: 'z_xx = 2，z_yy = −2，z_xy = 0，AC − B² = −4 < 0，故为鞍点。',
        level: 3,
    },
    {
        id: 'gs4-06',
        subject: 'gaoshu',
        chapter: 'gs4',
        type: 'single',
        blocks: [
            { t: 'tx', v: '交换积分次序：∫₀¹dx ∫₀ˣ f(x, y)dy =' },
        ],
        options: [
            '∫₀¹dy ∫₀ʸ f(x, y)dx',
            '∫₀¹dy ∫_y¹ f(x, y)dx',
            '∫₀¹dy ∫₀¹ f(x, y)dx',
            '∫₀ˣdy ∫₀¹ f(x, y)dx',
        ],
        answer: [1],
        analysis: '积分区域是 0 ≤ y ≤ x ≤ 1 的三角形。先对 x 积分时，y 从 0 到 1，x 从 y 到 1。',
        level: 3,
    },
    {
        id: 'gs4-07',
        subject: 'gaoshu',
        chapter: 'gs4',
        type: 'single',
        blocks: [{ t: 'tx', v: '可微函数 z = f(x, y) 在某点取得极值的必要条件是' }],
        options: ['f_x = f_y = 0', 'f_x > 0', 'f_xy = 0', 'f_x = f_y ≠ 0'],
        answer: [0],
        analysis: '极值点若为内点且偏导存在，则两个一阶偏导都为 0（驻点）。这只是必要条件，还需二阶判别。',
        level: 2,
    },

    /* ================= 高等数学 · 第5章 无穷级数 ================= */
    {
        id: 'gs5-01',
        subject: 'gaoshu',
        chapter: 'gs5',
        type: 'single',
        blocks: [{ t: 'tx', v: '级数 ∑(n=1→∞) 1/2ⁿ 的和为' }],
        options: ['1', '2', '1/2', '发散'],
        answer: [0],
        analysis: '等比级数，首项 1/2，公比 1/2，和 = (1/2)/(1 − 1/2) = 1。',
        level: 1,
    },
    {
        id: 'gs5-02',
        subject: 'gaoshu',
        chapter: 'gs5',
        type: 'single',
        blocks: [{ t: 'tx', v: 'p 级数 ∑1/nᵖ 收敛的充要条件是' }],
        options: ['p > 0', 'p > 1', 'p < 1', 'p ≥ 1'],
        answer: [1],
        analysis: 'p 级数当且仅当 p > 1 时收敛；p = 1 即调和级数发散。',
        level: 1,
    },
    {
        id: 'gs5-03',
        subject: 'gaoshu',
        chapter: 'gs5',
        type: 'single',
        blocks: [{ t: 'tx', v: '级数 ∑(n=1→∞) (−1)ⁿ/n' }],
        options: ['绝对收敛', '条件收敛', '发散', '无法判断'],
        answer: [1],
        analysis: '∑1/n 发散，但交错级数满足莱布尼茨条件（1/n 单调递减趋于 0），故条件收敛。',
        level: 2,
    },
    {
        id: 'gs5-04',
        subject: 'gaoshu',
        chapter: 'gs5',
        type: 'single',
        blocks: [{ t: 'tx', v: '幂级数 ∑ xⁿ/n! 的收敛半径 R =' }],
        options: ['0', '1', 'e', '+∞'],
        answer: [3],
        analysis: '由比值法，aₙ₊₁/aₙ = 1/(n + 1) → 0，故对任意 x 都收敛，R = +∞（其和为 eˣ）。',
        level: 2,
    },
    {
        id: 'gs5-05',
        subject: 'gaoshu',
        chapter: 'gs5',
        type: 'single',
        blocks: [{ t: 'tx', v: '幂级数 ∑(n=0→∞) xⁿ 的收敛域是' }],
        options: ['(−1, 1)', '[−1, 1]', '(−1, 1]', '(−∞, +∞)'],
        answer: [0],
        analysis: 'R = 1；x = 1 与 x = −1 时通项不趋于 0，端点都发散，故收敛域为开区间 (−1, 1)。',
        level: 2,
    },
    {
        id: 'gs5-06',
        subject: 'gaoshu',
        chapter: 'gs5',
        type: 'single',
        blocks: [{ t: 'tx', v: '级数 ∑(n=1→∞) (−1)ⁿ⁻¹ / √n' }],
        options: ['绝对收敛', '条件收敛', '发散', '收敛且和为 0'],
        answer: [1],
        analysis: '∑1/√n 是 p = 1/2 的 p 级数，发散；而 1/√n 单调递减趋于 0，由莱布尼茨定理交错级数收敛，故条件收敛。',
        level: 2,
    },

    /* ================= 高等数学 · 第6章 常微分方程 ================= */
    {
        id: 'gs6-01',
        subject: 'gaoshu',
        chapter: 'gs6',
        type: 'single',
        blocks: [{ t: 'tx', v: '微分方程 y′ = 2x 的通解是' }],
        options: ['y = x² + C', 'y = 2x + C', 'y = x²', 'y = 2x² + C'],
        answer: [0],
        analysis: '直接积分：y = ∫2x dx = x² + C。',
        level: 1,
    },
    {
        id: 'gs6-02',
        subject: 'gaoshu',
        chapter: 'gs6',
        type: 'single',
        blocks: [{ t: 'tx', v: '微分方程 y″ − y = 0 的通解是' }],
        options: [
            'y = C₁eˣ + C₂e⁻ˣ',
            'y = C₁cos x + C₂sin x',
            'y = C₁eˣ + C₂',
            'y = (C₁ + C₂x)eˣ',
        ],
        answer: [0],
        analysis: '特征方程 r² − 1 = 0，r = ±1，故通解 y = C₁eˣ + C₂e⁻ˣ。',
        level: 2,
    },
    {
        id: 'gs6-03',
        subject: 'gaoshu',
        chapter: 'gs6',
        type: 'single',
        blocks: [{ t: 'tx', v: '满足 y′ + y = 0，y(0) = 1 的解是' }],
        options: ['y = e⁻ˣ', 'y = eˣ', 'y = 1 − x', 'y = −eˣ'],
        answer: [0],
        analysis: '通解 y = Ce⁻ˣ，由 y(0) = 1 得 C = 1，故 y = e⁻ˣ。',
        level: 1,
    },
    {
        id: 'gs6-04',
        subject: 'gaoshu',
        chapter: 'gs6',
        type: 'single',
        blocks: [{ t: 'tx', v: '一阶线性方程 y′ − y = x 的通解是' }],
        options: ['y = Ceˣ − x − 1', 'y = Ceˣ + x', 'y = Ce⁻ˣ + x', 'y = Ceˣ − x'],
        answer: [0],
        analysis: '由 y = eˣ(C + ∫x·e⁻ˣdx)，而 ∫x e⁻ˣdx = −(x + 1)e⁻ˣ，得 y = Ceˣ − x − 1。',
        level: 3,
    },
    {
        id: 'gs6-05',
        subject: 'gaoshu',
        chapter: 'gs6',
        type: 'single',
        blocks: [{ t: 'tx', v: '方程 y′ = y² 满足 y(0) = 1 的特解是' }],
        options: ['y = 1/(1 − x)', 'y = 1/(1 + x)', 'y = eˣ', 'y = x + 1'],
        answer: [0],
        analysis: '分离变量 dy/y² = dx，得 −1/y = x + C；由 y(0) = 1 得 C = −1，故 y = 1/(1 − x)。',
        level: 3,
    },
    {
        id: 'gs6-06',
        subject: 'gaoshu',
        chapter: 'gs6',
        type: 'single',
        blocks: [{ t: 'tx', v: '方程 y″ − 3y′ + 2y = 0 的特征根是' }],
        options: ['1 和 2', '−1 和 −2', '3 和 2', '1 和 −2'],
        answer: [0],
        analysis: '特征方程 r² − 3r + 2 = 0，即 (r − 1)(r − 2) = 0，故 r₁ = 1，r₂ = 2。',
        level: 1,
    },

    /* ================= 线性代数 · 第1章 行列式 ================= */
    {
        id: 'xd1-01',
        subject: 'xiandai',
        chapter: 'xd1',
        type: 'single',
        blocks: [
            { t: 'tx', v: '计算二阶行列式：' },
            { t: 'mx', bar: '|', rows: [['2', '1'], ['1', '3']] },
        ],
        options: ['5', '7', '6', '1'],
        answer: [0],
        analysis: '2 × 3 − 1 × 1 = 6 − 1 = 5。',
        level: 1,
    },
    {
        id: 'xd1-02',
        subject: 'xiandai',
        chapter: 'xd1',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 A 是 3 阶方阵且 |A| = 2，则 |2A| =' }],
        options: ['4', '8', '16', '2'],
        answer: [2],
        analysis: 'k 乘 n 阶方阵时每个元素都乘 k，故 |kA| = kⁿ|A| = 2³ × 2 = 16。',
        level: 2,
    },
    {
        id: 'xd1-03',
        subject: 'xiandai',
        chapter: 'xd1',
        type: 'single',
        blocks: [{ t: 'tx', v: '|Aᵀ| 与 |A| 的关系是' }],
        options: ['相等', '互为倒数', '互为相反数', '没有确定关系'],
        answer: [0],
        analysis: '行列式转置不变：|Aᵀ| = |A|。',
        level: 1,
    },
    {
        id: 'xd1-04',
        subject: 'xiandai',
        chapter: 'xd1',
        type: 'single',
        blocks: [{ t: 'tx', v: '上（下）三角行列式的值等于' }],
        options: ['主对角线元素之积', '0', '1', '副对角线元素之积'],
        answer: [0],
        analysis: '三角行列式等于主对角线上各元素之积，这是计算行列式最常用的化简目标。',
        level: 1,
    },
    {
        id: 'xd1-05',
        subject: 'xiandai',
        chapter: 'xd1',
        type: 'single',
        blocks: [{ t: 'tx', v: '行列式某一行乘以 k 后，行列式的值' }],
        options: ['变为原来的 k 倍', '不变', '变为原来的 k² 倍', '变为原来的 kⁿ 倍'],
        answer: [0],
        analysis: '行列式对每一行都是线性的，单独一行乘 k 则整体乘 k（与 |kA| = kⁿ|A| 不同）。',
        level: 2,
    },
    {
        id: 'xd1-06',
        subject: 'xiandai',
        chapter: 'xd1',
        type: 'single',
        blocks: [
            { t: 'tx', v: '计算三阶行列式：' },
            { t: 'mx', bar: '|', rows: [['1', '0', '0'], ['0', '2', '0'], ['0', '0', '3']] },
        ],
        options: ['0', '6', '1', '3'],
        answer: [1],
        analysis: '这是对角行列式，值等于主对角线之积 1 × 2 × 3 = 6。',
        level: 1,
    },

    /* ================= 线性代数 · 第2章 矩阵 ================= */
    {
        id: 'xd2-01',
        subject: 'xiandai',
        chapter: 'xd2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 A 可逆，则 (Aᵀ)⁻¹ =' }],
        options: ['A⁻¹', '(A⁻¹)ᵀ', 'Aᵀ', '|A|·A⁻¹'],
        answer: [1],
        analysis: '由 (Aᵀ)(A⁻¹)ᵀ = (A⁻¹A)ᵀ = E，故 (Aᵀ)⁻¹ = (A⁻¹)ᵀ。',
        level: 2,
    },
    {
        id: 'xd2-02',
        subject: 'xiandai',
        chapter: 'xd2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 A 为 n 阶可逆矩阵，则 |A⁻¹| =' }],
        options: ['|A|', '1/|A|', '−|A|', '|A|ⁿ⁻¹'],
        answer: [1],
        analysis: '由 AA⁻¹ = E 取行列式：|A||A⁻¹| = 1，故 |A⁻¹| = 1/|A|。',
        level: 2,
    },
    {
        id: 'xd2-03',
        subject: 'xiandai',
        chapter: 'xd2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 A 为 3 阶矩阵且 r(A) = 2，则 |A| =' }],
        options: ['0', '2', '1', '不能确定'],
        answer: [0],
        analysis: 'n 阶矩阵满秩（r = n）才可逆、行列式非零；r(A) = 2 < 3，故 |A| = 0。',
        level: 2,
    },
    {
        id: 'xd2-04',
        subject: 'xiandai',
        chapter: 'xd2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 A² = A，则 A 的特征值只能是' }],
        options: ['0 或 1', '1 或 −1', '只能是 0', '只能是 1'],
        answer: [0],
        analysis: '由 A² = A 得 λ² = λ，即 λ(λ − 1) = 0，故 λ = 0 或 1。',
        level: 2,
    },
    {
        id: 'xd2-05',
        subject: 'xiandai',
        chapter: 'xd2',
        type: 'multi',
        blocks: [{ t: 'tx', v: 'n 阶方阵 A 可逆的充要条件有（多选）' }],
        options: ['|A| ≠ 0', 'r(A) = n', 'A 的列向量组线性无关', 'A 的特征值全为 0'],
        answer: [0, 1, 2],
        analysis: 'A 可逆 ⟺ 满秩 ⟺ 行列式非零 ⟺ 列（行）向量组线性无关 ⟺ 特征值全不为 0。全为 0 恰好是可逆的反面。',
        level: 2,
    },
    {
        id: 'xd2-06',
        subject: 'xiandai',
        chapter: 'xd2',
        type: 'single',
        blocks: [{ t: 'tx', v: '(AB)ᵀ =' }],
        options: ['AᵀBᵀ', 'BᵀAᵀ', 'AB', 'BA'],
        answer: [1],
        analysis: '转置反序：(AB)ᵀ = BᵀAᵀ，这是矩阵运算中最容易写错的一条。',
        level: 1,
    },

    /* ================= 线性代数 · 第3章 向量与方程组 ================= */
    {
        id: 'xd3-01',
        subject: 'xiandai',
        chapter: 'xd3',
        type: 'single',
        blocks: [{ t: 'tx', v: 'n 元齐次线性方程组 Ax = 0 有非零解的充要条件是' }],
        options: ['r(A) < n', 'r(A) = n', 'r(A) > n', 'r(A) = 0'],
        answer: [0],
        analysis: '齐次方程组总有零解，有非零解当且仅当未知量个数大于秩，即 r(A) < n。',
        level: 2,
    },
    {
        id: 'xd3-02',
        subject: 'xiandai',
        chapter: 'xd3',
        type: 'single',
        blocks: [{ t: 'tx', v: 'n 元非齐次方程组 Ax = b 有唯一解的条件是' }],
        options: ['r(A) = r(A|b) = n', 'r(A) = r(A|b) < n', 'r(A) < r(A|b)', 'r(A) = n − 1'],
        answer: [0],
        analysis: '有解要求 r(A) = r(A|b)；唯一解再要求秩等于未知量个数 n。若秩小于 n 则有无穷多解。',
        level: 2,
    },
    {
        id: 'xd3-03',
        subject: 'xiandai',
        chapter: 'xd3',
        type: 'single',
        blocks: [{ t: 'tx', v: '3 个 3 维向量 α₁, α₂, α₃ 线性相关的充要条件是' }],
        options: ['秩小于 3', '秩等于 3', '行列式不为 0', '两两成比例'],
        answer: [0],
        analysis: '3 个 3 维向量线性相关 ⟺ 构成的方阵奇异 ⟺ 行列式为 0 ⟺ 秩 < 3。「两两成比例」只是相关的充分条件之一。',
        level: 2,
    },
    {
        id: 'xd3-04',
        subject: 'xiandai',
        chapter: 'xd3',
        type: 'single',
        blocks: [{ t: 'tx', v: 'n 元齐次方程组 Ax = 0 的解空间维数是' }],
        options: ['n − r(A)', 'r(A)', 'm − r(A)', 'm'],
        answer: [0],
        analysis: '基础解系含 n − r(A) 个解向量，即解空间维数为 n − r(A)。',
        level: 2,
    },
    {
        id: 'xd3-05',
        subject: 'xiandai',
        chapter: 'xd3',
        type: 'single',
        blocks: [
            { t: 'tx', v: '若向量组 (I) 可由向量组 (II) 线性表示，则' },
        ],
        options: ['r(I) ≤ r(II)', 'r(I) ≥ r(II)', 'r(I) = r(II)', '两者秩无关'],
        answer: [0],
        analysis: '能被表示说明 (I) 的极大无关组可由 (II) 表示，故 r(I) ≤ r(II)。',
        level: 3,
    },
    {
        id: 'xd3-06',
        subject: 'xiandai',
        chapter: 'xd3',
        type: 'single',
        blocks: [{ t: 'tx', v: '任意 4 个 3 维向量必定' }],
        options: ['线性相关', '线性无关', '秩为 4', '无法判断'],
        answer: [0],
        analysis: '向量组的秩不超过维数 3，而向量个数 4 > 3，故必线性相关。',
        level: 2,
    },

    /* ================= 线性代数 · 第4章 特征值与二次型 ================= */
    {
        id: 'xd4-01',
        subject: 'xiandai',
        chapter: 'xd4',
        type: 'single',
        blocks: [
            { t: 'tx', v: '矩阵 A 的特征值是' },
            { t: 'mx', bar: '[', rows: [['2', '1'], ['0', '3']] },
        ],
        options: ['2 和 3', '2 和 0', '3 和 1', '1 和 6'],
        answer: [0],
        analysis: '上三角矩阵的特征值就是主对角线元素，即 2 和 3。',
        level: 1,
    },
    {
        id: 'xd4-02',
        subject: 'xiandai',
        chapter: 'xd4',
        type: 'single',
        blocks: [{ t: 'tx', v: 'n 阶矩阵全部特征值之和等于' }],
        options: ['矩阵的迹', '矩阵的行列式', '矩阵的秩', '0'],
        answer: [0],
        analysis: 'Σλᵢ = tr(A)，∏λᵢ = |A|。这两个恒等式是解参数题的关键。',
        level: 2,
    },
    {
        id: 'xd4-03',
        subject: 'xiandai',
        chapter: 'xd4',
        type: 'single',
        blocks: [{ t: 'tx', v: '关于实对称矩阵，下列说法正确的是' }],
        options: [
            '特征值都是实数，不同特征值对应的特征向量相互正交',
            '一定可逆',
            '特征值全部为正',
            '一定是单位矩阵',
        ],
        answer: [0],
        analysis: '实对称矩阵必可正交对角化：特征值为实数，属于不同特征值的特征向量正交。但它可能有零特征值（不可逆），也可能有负特征值。',
        level: 3,
    },
    {
        id: 'xd4-04',
        subject: 'xiandai',
        chapter: 'xd4',
        type: 'single',
        blocks: [{ t: 'tx', v: '若 λ 是 A 的特征值，则 λ² 是下列哪个矩阵的特征值？' }],
        options: ['2A', 'A²', 'A⁻¹', 'Aᵀ'],
        answer: [1],
        analysis: '由 Ax = λx 得 A²x = λ²x，故 λ² 是 A² 的特征值。',
        level: 2,
    },
    {
        id: 'xd4-05',
        subject: 'xiandai',
        chapter: 'xd4',
        type: 'single',
        blocks: [{ t: 'tx', v: '二次型 f = x₁² + 2x₂² + 3x₃² 是' }],
        options: ['正定', '半正定', '不定', '负定'],
        answer: [0],
        analysis: '矩阵 diag(1, 2, 3) 的各阶顺序主子式 1, 2, 6 全为正，故正定。',
        level: 1,
    },
    {
        id: 'xd4-06',
        subject: 'xiandai',
        chapter: 'xd4',
        type: 'single',
        blocks: [{ t: 'tx', v: '若 A 与 B 相似，则二者必定有' }],
        options: ['相同的特征多项式', '相同的特征向量', '完全相同的元素', '相同的转置矩阵'],
        answer: [0],
        analysis: '相似矩阵有相同的特征多项式，从而特征值、迹、行列式、秩都相同，但特征向量一般不同。',
        level: 2,
    },
    {
        id: 'xd4-07',
        subject: 'xiandai',
        chapter: 'xd4',
        type: 'single',
        blocks: [{ t: 'tx', v: '3 阶矩阵 A 的特征值为 1, 2, 3，则 |A| =' }],
        options: ['6', '5', '0', '3'],
        answer: [0],
        analysis: '行列式等于特征值之积：1 × 2 × 3 = 6。',
        level: 1,
    },

    /* ================= 概率统计 · 第1章 随机事件与概率 ================= */
    {
        id: 'gl1-01',
        subject: 'gailv',
        chapter: 'gl1',
        type: 'single',
        blocks: [{ t: 'tx', v: '加法公式 P(A ∪ B) =' }],
        options: [
            'P(A) + P(B) − P(AB)',
            'P(A) + P(B)',
            'P(A)P(B)',
            'P(A) + P(B) + P(AB)',
        ],
        answer: [0],
        analysis: '容斥原理：并集概率等于各自概率之和减去交集概率，避免把 AB 算两次。',
        level: 1,
    },
    {
        id: 'gl1-02',
        subject: 'gailv',
        chapter: 'gl1',
        type: 'single',
        blocks: [{ t: 'tx', v: '事件 A 与 B 相互独立的充要条件是' }],
        options: [
            'P(AB) = P(A)P(B)',
            'P(A|B) = P(B)',
            'P(A ∪ B) = P(A) + P(B)',
            'A 与 B 互不相容',
        ],
        answer: [0],
        analysis: '独立性定义为 P(AB) = P(A)P(B)。注意独立与互斥不是一回事，除非有一个为零概率事件。',
        level: 1,
    },
    {
        id: 'gl1-03',
        subject: 'gailv',
        chapter: 'gl1',
        type: 'single',
        blocks: [{ t: 'tx', v: '同时掷两枚均匀骰子，点数之和为 7 的概率是' }],
        options: ['1/6', '1/9', '1/12', '5/36'],
        answer: [0],
        analysis: '样本点共 36 个，和为 7 的有 (1,6)(2,5)(3,4)(4,3)(5,2)(6,1) 共 6 个，故概率 6/36 = 1/6。',
        level: 2,
    },
    {
        id: 'gl1-04',
        subject: 'gailv',
        chapter: 'gl1',
        type: 'single',
        blocks: [
            { t: 'tx', v: '已知 P(A) = 0.5，P(B) = 0.4，P(A ∪ B) = 0.7，则 P(A|B) =' },
        ],
        options: ['0.2', '0.4', '0.5', '0.8'],
        answer: [2],
        analysis: '由加法公式 P(AB) = 0.5 + 0.4 − 0.7 = 0.2；再 P(A|B) = P(AB)/P(B) = 0.2/0.4 = 0.5。',
        level: 3,
    },
    {
        id: 'gl1-05',
        subject: 'gailv',
        chapter: 'gl1',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 A₁, A₂, …, Aₙ 为完备事件组，则全概率公式为 P(B) =' }],
        options: [
            '∑ P(Aᵢ)P(B|Aᵢ)',
            'P(A)P(B)',
            '∑ P(Aᵢ)',
            'P(B|A)P(A)',
        ],
        answer: [0],
        analysis: '全概率公式按原因分解：P(B) = Σ P(Aᵢ)P(B|Aᵢ)。它是贝叶斯公式的分母。',
        level: 2,
    },
    {
        id: 'gl1-06',
        subject: 'gailv',
        chapter: 'gl1',
        type: 'judge',
        blocks: [{ t: 'tx', v: '判断：若 A ⊂ B，则 P(A) ≤ P(B)。' }],
        options: ['正确', '错误'],
        answer: [0],
        analysis: '概率具有单调性：子事件概率不超过包含它的母事件。因为 P(B) = P(A) + P(B − A)。',
        level: 1,
    },

    /* ================= 概率统计 · 第2章 一维随机变量 ================= */
    {
        id: 'gl2-01',
        subject: 'gailv',
        chapter: 'gl2',
        type: 'single',
        blocks: [{ t: 'tx', v: 'X ~ U(0, 1) 的概率密度为' }],
        options: ['f(x) = 1（0 < x < 1），其余为 0', 'f(x) = x', 'f(x) = 1/2', 'f(x) = e⁻ˣ'],
        answer: [0],
        analysis: '区间 (0,1) 上均匀分布的密度为常数 1/(1 − 0) = 1，区间外为 0。',
        level: 1,
    },
    {
        id: 'gl2-02',
        subject: 'gailv',
        chapter: 'gl2',
        type: 'single',
        blocks: [{ t: 'tx', v: 'X 服从参数为 λ 的指数分布，则 E(X) =' }],
        options: ['1/λ', 'λ', '1/λ²', 'λ²'],
        answer: [0],
        analysis: '指数分布 E(X) = 1/λ，D(X) = 1/λ²。',
        level: 1,
    },
    {
        id: 'gl2-03',
        subject: 'gailv',
        chapter: 'gl2',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 X ~ N(μ, σ²)，则 (X − μ)/σ 服从' }],
        options: ['N(0, 1)', 'N(μ, σ²)', 'U(0, 1)', 'E(1)'],
        answer: [0],
        analysis: '标准化：减去期望再除以标准差，得到标准正态分布 N(0, 1)。',
        level: 1,
    },
    {
        id: 'gl2-04',
        subject: 'gailv',
        chapter: 'gl2',
        type: 'single',
        blocks: [{ t: 'tx', v: '分布函数 F(x) 一定满足' }],
        options: [
            'F(−∞) = 0，F(+∞) = 1',
            'F(x) 单调递减',
            'F(x) 处处连续',
            'F(0) = 0',
        ],
        answer: [0],
        analysis: '分布函数单调不减、右连续，且两端极限为 0 和 1。离散型分布函数有跳跃点，不一定连续。',
        level: 2,
    },
    {
        id: 'gl2-05',
        subject: 'gailv',
        chapter: 'gl2',
        type: 'single',
        blocks: [{ t: 'tx', v: 'X ~ B(n, p)，则 D(X) =' }],
        options: ['np', 'np(1 − p)', 'np²', 'p(1 − p)'],
        answer: [1],
        analysis: '二项分布 E(X) = np，D(X) = np(1 − p)。',
        level: 1,
    },
    {
        id: 'gl2-06',
        subject: 'gailv',
        chapter: 'gl2',
        type: 'single',
        blocks: [{ t: 'tx', v: 'X ~ P(λ)（泊松分布），则 E(X) + D(X) =' }],
        options: ['λ', '2λ', 'λ²', 'λ + λ²'],
        answer: [1],
        analysis: '泊松分布的期望与方差都等于 λ，故和为 2λ。',
        level: 2,
    },

    /* ================= 概率统计 · 第3章 多维随机变量 ================= */
    {
        id: 'gl3-01',
        subject: 'gailv',
        chapter: 'gl3',
        type: 'single',
        blocks: [{ t: 'tx', v: '连续型 (X, Y) 相互独立的充要条件是' }],
        options: [
            'f(x, y) = f_X(x)·f_Y(y)',
            'Cov(X, Y) = 0',
            'X 与 Y 不相关',
            'E(XY) = E(X)E(Y)',
        ],
        answer: [0],
        analysis: '独立要求联合密度等于边缘密度之积。后三项只等价于不相关，弱于独立。',
        level: 2,
    },
    {
        id: 'gl3-02',
        subject: 'gailv',
        chapter: 'gl3',
        type: 'single',
        blocks: [{ t: 'tx', v: '对任意随机变量 X, Y，必有 E(X + Y) =' }],
        options: ['E(X) + E(Y)', 'E(X)·E(Y)', 'E(X) + E(Y) + Cov(X, Y)', 'E(XY)'],
        answer: [0],
        analysis: '期望的线性性无条件成立，不需要独立性。方差才需要独立（或不相关）才有 D(X + Y) = D(X) + D(Y)。',
        level: 1,
    },
    {
        id: 'gl3-03',
        subject: 'gailv',
        chapter: 'gl3',
        type: 'single',
        blocks: [{ t: 'tx', v: '相关系数 ρ_XY 的取值范围是' }],
        options: ['[−1, 1]', '[0, 1]', '全体实数', '(−1, 1)'],
        answer: [0],
        analysis: '由柯西—施瓦茨不等式，|ρ_XY| ≤ 1；取到 ±1 当且仅当 X 与 Y 以概率 1 线性相关。',
        level: 2,
    },
    {
        id: 'gl3-04',
        subject: 'gailv',
        chapter: 'gl3',
        type: 'single',
        blocks: [
            { t: 'tx', v: '设 (X, Y) 服从二维正态分布，则 X 与 Y 独立的充要条件是' },
        ],
        options: ['ρ = 0', 'E(X) = E(Y)', 'D(X) = D(Y)', 'X 与 Y 同分布'],
        answer: [0],
        analysis: '二维正态分布有特殊性：不相关即独立，故 ρ = 0 就是独立的充要条件。',
        level: 3,
    },
    {
        id: 'gl3-05',
        subject: 'gailv',
        chapter: 'gl3',
        type: 'single',
        blocks: [{ t: 'tx', v: 'Cov(X, Y) =' }],
        options: [
            'E(XY) − E(X)E(Y)',
            'E(XY)',
            'D(X)·D(Y)',
            'E(X + Y)',
        ],
        answer: [0],
        analysis: '协方差的计算式：Cov(X, Y) = E(XY) − E(X)E(Y)。',
        level: 1,
    },
    {
        id: 'gl3-06',
        subject: 'gailv',
        chapter: 'gl3',
        type: 'single',
        blocks: [
            { t: 'tx', v: '(X, Y) 在平面区域 D 上服从均匀分布，G ⊂ D，则 P((X, Y) ∈ G) =' },
        ],
        options: [
            'G 的面积 / D 的面积',
            'G 的面积',
            'D 的面积',
            '1 / D 的面积',
        ],
        answer: [0],
        analysis: '二维均匀分布下，概率等于面积比，这是几何概型在二维的推广。',
        level: 2,
    },

    /* ================= 概率统计 · 第4章 数字特征 ================= */
    {
        id: 'gl4-01',
        subject: 'gailv',
        chapter: 'gl4',
        type: 'single',
        blocks: [{ t: 'tx', v: 'D(aX + b) =' }],
        options: ['a²D(X)', 'aD(X) + b', 'a²D(X) + b', 'D(X)'],
        answer: [0],
        analysis: '方差对平移不变（常数 b 不影响波动），系数提出时要平方，故 D(aX + b) = a²D(X)。',
        level: 1,
    },
    {
        id: 'gl4-02',
        subject: 'gailv',
        chapter: 'gl4',
        type: 'single',
        blocks: [{ t: 'tx', v: '方差的计算公式 D(X) =' }],
        options: [
            'E(X²) − [E(X)]²',
            'E(X²)',
            '[E(X)]²',
            'E(X²) + [E(X)]²',
        ],
        answer: [0],
        analysis: '常用结论：方差 = 平方的期望 − 期望的平方。',
        level: 1,
    },
    {
        id: 'gl4-03',
        subject: 'gailv',
        chapter: 'gl4',
        type: 'single',
        blocks: [{ t: 'tx', v: '若 X 与 Y 相互独立，则 D(X + Y) =' }],
        options: [
            'D(X) + D(Y)',
            'D(X) + D(Y) + 2Cov(X, Y)',
            'D(X)·D(Y)',
            'D(X) − D(Y)',
        ],
        answer: [0],
        analysis: '独立则协方差为 0，故 D(X + Y) = D(X) + D(Y)。更一般的公式是加上 2Cov(X, Y)。',
        level: 1,
    },
    {
        id: 'gl4-04',
        subject: 'gailv',
        chapter: 'gl4',
        type: 'single',
        blocks: [{ t: 'tx', v: 'E(aX + b) =' }],
        options: ['aE(X) + b', 'aE(X)', 'E(X) + b', 'a²E(X) + b'],
        answer: [0],
        analysis: '期望的线性性：E(aX + b) = aE(X) + b，不需要独立性。',
        level: 1,
    },
    {
        id: 'gl4-05',
        subject: 'gailv',
        chapter: 'gl4',
        type: 'single',
        blocks: [{ t: 'tx', v: '设 E(X) = 1，D(X) = 2，则 E(X²) =' }],
        options: ['3', '2', '1', '0'],
        answer: [0],
        analysis: '由 D(X) = E(X²) − [E(X)]² 得 E(X²) = 2 + 1² = 3。',
        level: 2,
    },
    {
        id: 'gl4-06',
        subject: 'gailv',
        chapter: 'gl4',
        type: 'single',
        blocks: [{ t: 'tx', v: 'X ~ B(10, 0.5)，则 E(X) =' }],
        options: ['5', '2.5', '10', '0.5'],
        answer: [0],
        analysis: 'E(X) = np = 10 × 0.5 = 5（方差为 np(1 − p) = 2.5）。',
        level: 1,
    },
];

/* ---------- 索引与查询 ---------- */

const QUESTION_MAP = {};
QUESTIONS.forEach((q) => {
    QUESTION_MAP[q.id] = q;
});

const CHAPTER_MAP = {};
CHAPTERS.forEach((c) => {
    CHAPTER_MAP[c.key] = c;
});

function blockToPlain(b) {
    if (b.t === 'tx') return b.v;
    if (b.t === 'fr') return '(' + b.n + ')/(' + b.d + ')';
    if (b.t === 'lim') return 'lim(' + b.sub + ') ' + b.v;
    if (b.t === 'mx') return '矩阵 ' + b.rows.map((r) => r.join(' ')).join(' ; ');
    return '';
}

/** 把题目规范化为页面可直接渲染的结构 */
function decorate(q) {
    if (!q) return null;
    const blocks = q.blocks && q.blocks.length
        ? q.blocks
        : [{ t: 'tx', v: q.stem || '' }];
    const plain = blocks.map(blockToPlain).join(' ');
    return {
        id: q.id,
        subject: q.subject,
        chapter: q.chapter,
        type: q.type,
        typeText: q.type === 'multi' ? '多选题' : q.type === 'judge' ? '判断题' : '单选题',
        blocks: blocks,
        plain: plain,
        options: q.options || [],
        answer: q.answer || [],
        analysis: q.analysis || '',
        level: q.level || 2,
    };
}

function getByChapter(chapterKey) {
    return QUESTIONS.filter((q) => q.chapter === chapterKey).map(decorate);
}

function getById(id) {
    return decorate(QUESTION_MAP[id]);
}

function getByIds(ids) {
    return ids.map((id) => decorate(QUESTION_MAP[id])).filter(Boolean);
}

function getChapters(subjectKey) {
    const list = subjectKey
        ? CHAPTERS.filter((c) => c.subject === subjectKey)
        : CHAPTERS.slice();
    return list.map((c) => ({
        key: c.key,
        name: c.name,
        tag: c.tag,
        subject: c.subject,
        total: QUESTIONS.filter((q) => q.chapter === c.key).length,
    }));
}

function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
    }
    return arr;
}

/** 随机抽题，可按科目或全局 */
function getRandom(subjectKey, count) {
    let pool = QUESTIONS;
    if (subjectKey) pool = pool.filter((q) => q.subject === subjectKey);
    return shuffle(pool).slice(0, count || 10).map(decorate);
}

function getWrongPool() {
    return QUESTIONS.map(decorate);
}

const CN_NUM = ['一', '二', '三', '四', '五', '六'];

/**
 * 题库目录：按科目分组，返回「第 X 部分 · 科目」+ 章节。
 * bank 为 'all' 时展示全部科目，否则只展示该科目。
 */
function getToc(bank) {
    const subs = !bank || bank === 'all'
        ? SUBJECTS
        : SUBJECTS.filter((s) => s.key === bank);
    return subs.map((s, i) => ({
        key: s.key,
        title: '第' + CN_NUM[i] + '部分 ' + s.name,
        short: s.short,
        chapters: CHAPTERS.filter((c) => c.subject === s.key).map((c) => ({
            key: c.key,
            name: c.name,
            tag: c.tag,
            subject: c.subject,
            total: QUESTIONS.filter((q) => q.chapter === c.key).length,
        })),
    }));
}

/** 某题库范围内的题目总数 */
function countBank(bank) {
    if (!bank || bank === 'all') return QUESTIONS.length;
    return QUESTIONS.filter((q) => q.subject === bank).length;
}

/**
 * 六维能力图
 * 每个维度都必须能从「作答记录」里算出真实数值，口径如下：
 *
 *  计算能力  计算密集型章节（积分、多元、微分方程、行列式、矩阵）的已答正确率
 *  解题能力  全部已答题的综合正确率
 *  知识储备  考点覆盖率 = 已答去重题数 ÷ 题库总题数
 *  应变能力  最近 7 天作答的题目正确率，反映临场状态
 *  选填能力  基础与中档题（难度 1–2）的正确率
 *  大题能力  综合难题（难度 3）的正确率
 *
 * 顺序即雷达图顺时针顺序，从正上方开始。
 */
const CALC_CHAPTERS = ['gs3', 'gs4', 'gs6', 'xd1', 'xd2'];
const RECENT_DAYS = 7;

const RADAR_AXES = [
    { key: 'calc', name: '计算能力' },
    { key: 'solve', name: '解题能力' },
    { key: 'knowledge', name: '知识储备' },
    { key: 'adapt', name: '应变能力' },
    { key: 'objective', name: '选填能力' },
    { key: 'subjective', name: '大题能力' },
];

/** 每个维度的口径说明，页面「算法」弹窗直接用这段 */
const RADAR_RULES = [
    { name: '计算能力', desc: '积分、多元、微分方程、行列式、矩阵这些计算密集章节的已答题正确率' },
    { name: '解题能力', desc: '全部已答题的综合正确率，最直接的对错表现' },
    { name: '知识储备', desc: '已答过的题目数 ÷ 题库总题数，反映复习覆盖面' },
    { name: '应变能力', desc: '最近 7 天作答的题目正确率，反映近期临场状态' },
    { name: '选填能力', desc: '基础与中档题（难度 1–2）的正确率' },
    { name: '大题能力', desc: '综合难题（难度 3）的正确率' },
];

function rateOf(done, right) {
    return done ? Math.round((right / done) * 100) : 0;
}

/** 按作答记录计算六维能力值，返回 6 项 { key, name, value, done, total, empty } */
function calcAbility(records) {
    const map = records || {};
    const now = Date.now();
    const cutoff = now - RECENT_DAYS * 86400000;

    const acc = {
        calc: { done: 0, right: 0 },
        solve: { done: 0, right: 0 },
        knowledge: { done: 0 },
        adapt: { done: 0, right: 0 },
        objective: { done: 0, right: 0 },
        subjective: { done: 0, right: 0 },
    };
    const bankSize = QUESTIONS.length;
    const pool = { calc: 0, objective: 0, subjective: 0 };
    let covered = 0;

    QUESTIONS.forEach((item) => {
        const rec = map[item.id];
        const isCalc = CALC_CHAPTERS.indexOf(item.chapter) >= 0;
        const isHard = (item.level || 2) >= 3;

        // 各维度的题目总量（与是否作答无关）
        if (isCalc) pool.calc += 1;
        if (isHard) pool.subjective += 1;
        else pool.objective += 1;

        if (!rec) return;
        covered += 1;

        const right = !!rec.r;
        acc.solve.done += 1;
        if (right) acc.solve.right += 1;

        if (isCalc) {
            acc.calc.done += 1;
            if (right) acc.calc.right += 1;
        }

        if (isHard) {
            acc.subjective.done += 1;
            if (right) acc.subjective.right += 1;
        } else {
            acc.objective.done += 1;
            if (right) acc.objective.right += 1;
        }

        if ((rec.t || 0) >= cutoff) {
            acc.adapt.done += 1;
            if (right) acc.adapt.right += 1;
        }
    });

    acc.knowledge.done = covered;

    return RADAR_AXES.map((axis) => {
        if (axis.key === 'knowledge') {
            return {
                key: axis.key,
                name: axis.name,
                value: bankSize ? Math.round((covered / bankSize) * 100) : 0,
                done: covered,
                total: bankSize,
                empty: covered === 0,
            };
        }
        if (axis.key === 'adapt') {
            // 应变能力按最近 7 天的作答量做样本说明
            return {
                key: axis.key,
                name: axis.name,
                value: rateOf(acc.adapt.done, acc.adapt.right),
                done: acc.adapt.done,
                total: covered,
                empty: acc.adapt.done === 0,
            };
        }
        const a = acc[axis.key];
        return {
            key: axis.key,
            name: axis.name,
            value: rateOf(a.done, a.right),
            done: a.done,
            total: axis.key === 'solve' ? bankSize : pool[axis.key],
            empty: a.done === 0,
        };
    });
}

module.exports = {
    SUBJECTS,
    CHAPTERS,
    QUESTIONS,
    QUESTION_MAP,
    CHAPTER_MAP,
    RADAR_AXES,
    RADAR_RULES,
    CALC_CHAPTERS,
    decorate,
    getByChapter,
    getById,
    getByIds,
    getChapters,
    getRandom,
    getWrongPool,
    getToc,
    countBank,
    calcAbility,
    shuffle,
};
