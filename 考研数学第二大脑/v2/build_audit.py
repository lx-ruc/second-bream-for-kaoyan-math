# -*- coding: utf-8 -*-
"""考点树 vs 考研大纲 的核对审计。

回答一个问题：data/kp.json 的考点树，是按考研大纲编的，还是按真题出场归类的？

结论不是靠关键词自动匹配得出的——试过，不可靠：
  「向量运算」会命中「定积分的概念与性质」（因为后者名字里有「性质→运算」的近义）；
  「行列式展开」会命中「幂级数展开式」；
  「矩」会命中「矩阵的运算与变换」（概率里的「矩」被矩阵吞掉）。
所以本脚本分两层：

  第一层（硬事实，可自动判定）：章级对照 + 源索引一致性 + 跨卷结构差异 + 同义重复节点。
      这层不涉及语义判断，结论完全可复现。

  第二层（人工判读，脚本只提供证据）：大纲条目在考点树里有没有独立承载。
      脚本给出「题干命中题数 / 精讲提及篇数」作为证据，是否算缺口由人判。

用法：
    python3 build_audit.py            # 打印报告
    python3 build_audit.py --json     # 输出 data/audit.json
"""
import json, io, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
RAW = os.path.join(HERE, "raw")
QB = os.path.join(HERE, "..", "mp", "packageExam", "data", "qbank.js")


# ---------------------------------------------------------------------------
# 大纲章级基准（部分 → 章）。章名照大纲原文，不做归并。
# 来源：数学一 yz.chsi.com.cn/kyzx/math/201209/20120918/343664987-{2,3,4}.html
#       数学二 chinakaoyan.com/info/article/id/412457.shtml
#       数学三 chinakaoyan.com/info/article/id/412467.shtml
# ---------------------------------------------------------------------------
SYL = {
    "1": {
        "高等数学": ["函数、极限、连续", "一元函数微分学", "一元函数积分学",
                     "向量代数和空间解析几何", "多元函数微分学", "多元函数积分学",
                     "无穷级数", "常微分方程"],
        "线性代数": ["行列式", "矩阵", "向量", "线性方程组",
                     "矩阵的特征值和特征向量", "二次型"],
        "概率论与数理统计": ["随机事件和概率", "随机变量及其分布", "多维随机变量及其分布",
                             "随机变量的数字特征", "大数定律和中心极限定理",
                             "数理统计的基本概念", "参数估计", "假设检验"],
    },
    "2": {
        "高等数学": ["函数、极限、连续", "一元函数微分学", "一元函数积分学",
                     "多元函数微积分学", "常微分方程"],
        "线性代数": ["行列式", "矩阵", "向量", "线性方程组",
                     "矩阵的特征值及特征向量", "二次型"],
    },
    "3": {
        "高等数学": ["函数、极限、连续", "一元函数微分学", "一元函数积分学",
                     "多元函数微积分学", "无穷级数", "常微分方程与差分方程"],
        "线性代数": ["行列式", "矩阵", "向量", "线性方程组",
                     "矩阵的特征值和特征向量", "二次型"],
        "概率论与数理统计": ["随机事件和概率", "随机变量及其分布", "多维随机变量及其分布",
                             "随机变量的数字特征", "大数定律和中心极限定理",
                             "数理统计的基本概念", "参数估计"],
    },
}

# 章名对不上时的人工认定：考点树的章名 → 大纲的章名（多对一）
# 只登记「结构上确实是一章拆/并了」的情形；用字差异交给 norm_chap 自动归一连词。
CHAP_ALIAS = {
    # 考点树把大纲的「参数估计」「假设检验」两章合并成一章
    "参数估计与假设检验": ["参数估计", "假设检验"],
}

VOL_NAME = {"1": "数学一", "2": "数学二", "3": "数学三"}

# 连词归一：大纲对同一章有「和 / 及 / 与」三种写法，比对时视为同一个名字。
# 只归一连词，不归同义词——归同义词就是自动判断语义，前面已证明不可靠。
def norm_chap(s):
    return re.sub(r"[和及与]", "", s or "")


def norm_name(s):
    """考点名归一：只抹掉「和/及/与」与空白，用于抓「差一个连词」的同名节点。"""
    return re.sub(r"[\s和及与]", "", s or "")


def load():
    kp = json.load(io.open(os.path.join(DATA, "kp.json"), encoding="utf-8"))["nodes"]
    kps = {k["id"]: k["name"] for k in kp}
    ex = json.load(io.open(os.path.join(DATA, "exams.json"), encoding="utf-8"))["exams"]
    jj = json.load(io.open(os.path.join(DATA, "jj.json"), encoding="utf-8"))["docs"]
    raw = io.open(QB, encoding="utf-8").read()
    qb = json.loads(raw[raw.index("=") + 1:].rstrip().rstrip(";"))
    return kp, kps, ex, jj, qb


def chap_index(kp):
    """{卷: OrderedDict(章 → [考点名])}，按 order 排序。"""
    out = {}
    for v in ("1", "2", "3"):
        rows = [k for k in kp if v in k["scope"]]
        rows.sort(key=lambda k: k["order"][v])
        d = collections.OrderedDict()
        for k in rows:
            d.setdefault(k["chap"][v], []).append(k["name"])
        out[v] = d
    return out


def raw_index_chaps(v):
    """源索引（用户腾讯文档里的真题索引）的章 → 考点行数。"""
    p = os.path.join(RAW, "idx%s.json" % v)
    txt = json.load(io.open(p, encoding="utf-8"))["content"]
    chaps = collections.OrderedDict()
    for line in txt.split("\n"):
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3 or not re.match(r"^\d+$", cells[0]):
            continue
        cp = cells[1]
        if "/" in cp:
            ch = cp.split("/")[0].strip()
            chaps[ch] = chaps.get(ch, 0) + 1
    return chaps


def match_chap(tree_chap, syl_chaps):
    """考点树的章名 → 大纲章名列表；None 表示大纲里没有。"""
    if tree_chap in syl_chaps:
        return [tree_chap]
    if tree_chap in CHAP_ALIAS:
        return CHAP_ALIAS[tree_chap]
    # 差一个连词（和/及/与）视为同一章
    nt = norm_chap(tree_chap)
    hits = [c for c in syl_chaps if norm_chap(c) == nt]
    return hits or None


def audit_chapter(tree, v):
    syl = SYL[v]
    syl_all = [c for part in syl.values() for c in part]
    tree_chaps = tree[v]

    covered, missing = [], []
    for c in syl_all:
        hit = None
        for tc in tree_chaps:
            m = match_chap(tc, syl_all)
            if m and c in m:
                hit = tc
                break
        (covered if hit else missing).append((c, hit))

    extra = []
    for tc in tree_chaps:
        m = match_chap(tc, syl_all)
        if not m:
            extra.append(tc)

    raw_chaps = raw_index_chaps(v)
    return dict(
        vol=v, n_syl=len(syl_all), n_tree=len(tree_chaps),
        n_raw=len(raw_chaps),
        covered=covered, missing=missing, extra=extra,
        raw_chaps=list(raw_chaps.keys()),
        raw_has_missing=[c for c, _ in missing if c in raw_chaps],
    )


# 跨卷命名差异：同一个概念，不同卷起了不同名字（人工认定，不给机器猜）
NAMING = [
    dict(concept="无穷小量的阶",
         names={"1": "无穷小量的比较", "2": "无穷小量", "3": "无穷小量"}),
    dict(concept="函数的连续性 / 间断点类型",
         names={"1": "函数的连续性", "2": "函数的连续性与间断点的类型",
                "3": "函数的连续性与间断点的类型"}),
    dict(concept="定积分的概念与性质",
         names={"1": "定积分的概念、性质及几何意义", "2": "定积分的概念与性质",
                "3": "定积分的概念与性质"}),
    dict(concept="反常积分",
         names={"1": "反常积分的计算与敛散性", "2": "反常积分的计算与敛散性",
                "3": "反常积分的计算"}),
    dict(concept="不等式",
         names={"1": "不等式的证明", "2": "不等式的证明", "3": "不等式"}),
    dict(concept="线性微分方程解的结构",
         names={"1": "线性微分方程的解的结构", "2": "微分方程的解与线性微分方程的解的结构",
                "3": "线性微分方程的解的结构"}),
    dict(concept="常数项（数项）级数",
         names={"1": "常数项级数敛散性的判定", "3": "数项级数"}),
    dict(concept="幂级数（收敛域 / 和函数展开）",
         names={"1": "求幂级数的收敛半径、收敛区间和收敛域", "3": "幂级数"}),
    dict(concept="一阶线性微分方程",
         names={"1": "一阶非齐次线性微分方程", "2": "一阶线性微分方程",
                "3": "一阶非齐次线性微分方程"}),
    dict(concept="可分离变量的微分方程",
         names={"1": "可分离变量的微分方程与齐次方程", "2": "可分离变量的微分方程"}),
    dict(concept="二阶常系数非齐次线性微分方程",
         names={"1": "常系数非齐次线性微分方程", "2": "二阶常系数非齐次线性微分方程",
                "3": "二阶常系数非齐次线性微分方程"}),
    dict(concept="边缘分布与条件分布",
         names={"1": "边缘分布和条件分布", "3": "边缘分布与条件分布"}),
    dict(concept="二次积分 / 交换积分次序",
         names={"1": "交换积分次序与坐标系之间的转化", "2": "二次积分与变换积分次序",
                "3": "交换积分次序与坐标系之间的转化"}),
    dict(concept="二重积分的应用",
         names={"2": "二重积分的应用", "3": "二重积分的综合与应用"}),
    dict(concept="多元函数的极值",
         names={"1": "多元函数的极值问题", "2": "多元函数的极值问题",
                "3": "多元函数的极值问题"}),
]


def cross_vol_struct(tree):
    """同一章名在不同卷下的考点集合差异。

    差异分两类，混在一起报就等于制造假问题：
      1) 命名差异：同一个概念，不同卷起了不同名字（数二叫「无穷小量」、数一叫「无穷小量的比较」）。
         用 NAMING 人工表认定，不给机器猜。
      2) 真实差异：该卷不考（数三不考傅里叶级数），或粒度不同（数三把数列极限拆成两个）。

    注意方向：`union - s[v]` 是「其它卷有、本卷没有」。
    """
    allch = set()
    for v in tree:
        allch |= set(tree[v].keys())
    out = []
    for ch in sorted(allch):
        per = {v: set(tree[v].get(ch, [])) for v in ("1", "2", "3") if ch in tree[v]}
        if len(per) < 2:
            continue
        union = set().union(*per.values())
        lacks = {v: union - s for v, s in per.items()}
        if not any(lacks.values()):
            continue
        # 本段里能对上 NAMING 的节点算命名差异，对不上的算真实差异
        naming, real = [], []
        for g in NAMING:
            names = {v: n for v, n in g["names"].items() if v in per}
            if len(names) < 2 or len(set(names.values())) < 2:
                continue
            if not any(n in per[v] for v, n in names.items()):
                continue
            naming.append(dict(concept=g["concept"], names=names))
        named = {n for g in naming for n in g["names"].values()}
        for v in per:
            r = [n for n in sorted(lacks[v]) if n not in named]
            if r:
                real.append((v, r))
        out.append(dict(chap=ch, vols=sorted(per.keys()),
                        sizes={v: len(s) for v, s in per.items()},
                        naming=naming, real=real))
    return out


def dup_nodes(kp):
    """同义重复节点。

    自动判定两种客观可判的情形：
      (a) 完全同名、不同 ID；
      (b) 只差一个连词（和/及/与）或空白、不同 ID —— 如「边缘分布与条件分布 / 边缘分布和条件分布」。
    「语义近似但拆成两个」列人工表——机器判不了，硬判就会像关键词匹配一样出错。
    """
    by_name = collections.defaultdict(list)
    by_norm = collections.defaultdict(list)
    for k in kp:
        by_name[k["name"]].append(k)
        by_norm[norm_name(k["name"])].append(k)

    same, near_name = [], []
    for n, ks in by_name.items():
        if len(ks) > 1:
            same.append(dict(name=n, ids=[k["id"] for k in ks],
                             scope=[k["scope"] for k in ks]))
    for nn, ks in by_norm.items():
        names = {k["name"] for k in ks}
        if len(names) < 2:
            continue          # 已由 same 覆盖的同名情形
        near_name.append(dict(
            names=sorted(names),
            ids=[k["id"] for k in ks],
            scope=[k["scope"] for k in ks],
        ))

    # 人工认定表：三卷对同一批大纲条目的切分方式不一致。
    # 三种性质分开列，因为处理方式完全不同：
    #   same-item  同一个大纲条目、两个卷各起一个名字，scope 不相交 → 只影响显示名
    #   coarser    一卷粒度更细、另一卷合成一个节点 → 影响考频排序（细的那个分低了）
    #   NOT-dup    看似重复、实际装的是不同内容 → 绝不能合并
    MANUAL = [
        ("same-item", "函数的连续性", ["1"], "函数的连续性与间断点的类型", ["2", "3"],
         "数一没有独立的「间断点类型」节点"),
        ("same-item", "无穷小量", ["2", "3"], "无穷小量的比较", ["1"],
         "数二「无穷小量」讲的正是比阶，内容重叠"),
        ("same-item", "定积分的概念、性质及几何意义", ["1"], "定积分的概念与性质", ["2", "3"], ""),
        ("same-item", "反常积分的计算", ["3"], "反常积分的计算与敛散性", ["1", "2"], ""),
        ("same-item", "不等式", ["3"], "不等式的证明", ["1", "2"], ""),
        ("same-item", "线性微分方程的解的结构", ["1", "3"],
         "微分方程的解与线性微分方程的解的结构", ["2"],
         "数二把「解的结构」与「一阶方程通解」并进一个节点"),
        ("same-item", "数项级数", ["3"], "常数项级数敛散性的判定", ["1"], ""),
        ("coarser", "参数估计", ["3"], "矩估计和最大似然估计", ["1"], "数一拆成 4 个节点"),
        ("coarser", "参数估计", ["3"], "估计量的无偏性", ["1"], ""),
        ("coarser", "参数估计", ["3"], "区间估计和置信区间", ["1"], ""),
        ("coarser", "参数估计", ["3"], "假设检验", ["1"], ""),
        ("NOT-dup", "导数的应用", ["2"], "函数的单调性、极值与最值", ["1", "2", "3"],
         "数二「导数的应用」17 题全是曲率/切线法线/相关变化率，与单调性极值不是同一批题"),
    ]
    near = [dict(kind=k, a=a, a_scope=sa, b=b, b_scope=sb, note=note)
            for k, a, sa, b, sb, note in MANUAL]
    return same, near_name, near


def carry_evidence(kws, kps, ex, jj, qb):
    """大纲条目在考点树里的「承载证据」。

    返回：命中题干题数、题所属考点分布、精讲正文提及篇数。
    注意：检索结果只作证据，不作判定——「全概率」「格林公式」这类词在题干里
    本就不会出现，检出 0 不代表没考过。
    """
    id2name = kps
    idx = {(e["vol"], e["y"], e["no"]): e["kp"] for e in ex}
    n_q, where = 0, collections.Counter()
    for k, v in qb.items():
        s = (v.get("s") or "") + " " + (v.get("sol") or "")
        if not any(w in s for w in kws):
            continue
        vol, y, no = k.split("|")
        n_q += 1
        where[id2name.get(idx.get((vol, int(y), int(no))), "??")] += 1

    def blob(doc):
        t = doc.get("brief") or ""
        for f in doc.get("families") or []:
            t += " " + (f.get("text") or "")
        for q in doc.get("qs") or []:
            t += " " + (q.get("stem") or "") + " " + (q.get("ans") or "") + " " + (q.get("sol") or "")
        return t

    n_jj = sum(1 for d in jj if any(w in blob(d) for w in kws))
    return dict(n_q=n_q, where=dict(where), n_jj=n_jj)


# 大纲条目承载性抽查表（人工选的点，均为「大纲要求明确、但考点树里看不到同名节点」的）
# 关键词取该概念在题目与解析里的**实际用词**——「两类错误」在精讲里写的是「第二类错误」，
# 只填前者会误报成 0 命中。这一步是人工挑词，不能让机器自己扩同义词。
PROBE = [
    ("1", "高数·一元微分", "曲率/曲率圆/曲率半径", ["曲率"]),
    ("1", "高数·多元积分", "散度", ["散度"]),
    ("1", "高数·多元积分", "旋度", ["旋度"]),
    ("1", "线代·矩阵", "分块矩阵", ["分块矩阵"]),
    ("1", "线代·线性方程组", "克拉默法则", ["克拉默"]),
    ("1", "线代·向量", "施密特正交规范化", ["施密特"]),
    ("1", "线代·向量", "向量空间/基/维数/过渡矩阵", ["过渡矩阵", "基变换"]),
    ("1", "线代·线性方程组", "基础解系与解空间", ["基础解系", "解空间"]),
    ("1", "线代·二次型", "惯性定理", ["惯性定理"]),
    ("1", "线代·二次型", "合同变换与合同矩阵", ["合同"]),
    ("1", "概率·假设检验", "显著性检验的两类错误", ["第二类错误", "第一类错误", "两类错误"]),
    ("1", "概率·随机事件", "全概率公式与贝叶斯公式", ["全概率", "贝叶斯"]),
    ("1", "高数·常微分", "欧拉方程", ["欧拉方程"]),
    ("1", "高数·常微分", "全微分方程", ["全微分方程"]),
    ("1", "高数·空间解析几何", "向量运算（数量积/向量积/混合积）", ["混合积"]),
    ("1", "高数·空间解析几何", "平面方程与直线方程", ["平面方程", "直线方程"]),
]


def main():
    kp, kps, ex, jj, qb = load()
    tree = chap_index(kp)

    chaps = [audit_chapter(tree, v) for v in ("1", "2", "3")]
    xvol = cross_vol_struct(tree)
    same, near_name, near = dup_nodes(kp)

    probes = []
    for v, part, label, kws in PROBE:
        ev = carry_evidence(kws, kps, ex, jj, qb)
        probes.append(dict(vol=v, part=part, item=label, kw=kws, **ev))

    result = dict(
        meta=dict(n_kp=len(kp), n_vol_chap={v: len(tree[v]) for v in tree},
                  n_vol_kp={v: sum(len(x) for x in tree[v].values()) for v in tree}),
        chapters=chaps, cross_vol=xvol,
        dup_same_name=same, dup_near_name=near_name, dup_near=near, probes=probes,
    )

    if "--json" in sys.argv:
        p = os.path.join(DATA, "audit.json")
        io.open(p, "w", encoding="utf-8").write(
            json.dumps(result, ensure_ascii=False, indent=1))
        print("written", p)
        return

    W = 78
    print("=" * W)
    print("考点树 × 考研大纲  核对报告")
    print("=" * W)
    print("考点树：%d 个考点，三卷章数 %s，三卷考点数 %s" % (
        len(kp), result["meta"]["n_vol_chap"], result["meta"]["n_vol_kp"]))
    print("来源：data/kp.json ← raw/idx{1,2,3}.json（作者自己的「全考点真题索引」）")
    print()

    for c in chaps:
        v = c["vol"]
        flag = "OK" if not c["missing"] else "缺 %d 章" % len(c["missing"])
        print("-" * W)
        print("%s：大纲 %d 章 / 考点树 %d 章 / 源索引 %d 章   [%s]" % (
            VOL_NAME[v], c["n_syl"], c["n_tree"], c["n_raw"], flag))
        print("-" * W)
        for name, hit in c["covered"]:
            mark = name if hit == name else "%s  ←  树里叫「%s」" % (name, hit)
            print("  ✓ %s" % mark)
        for name, _ in c["missing"]:
            lost = name in c["raw_has_missing"]
            inraw = "← 源索引里有，是转换时丢的" if lost else "← 源索引里也没有，缺口在源语料"
            print("  ✗ %s %s" % (name, inraw))
        for e in c["extra"]:
            print("  ? %s  ←  大纲里无此章" % e)
        print()

    print("=" * W)
    print("同一章名在不同卷下的考点集合差异（%d 章有差异）" % len(xvol))
    print("=" * W)
    print("「缺」= 同章其它卷有、本卷没有的考点。已把「同一概念换个名」剥离，只留真实差异。")
    for x in xvol:
        print("\n【%s】 各卷考点数 %s" % (x["chap"], x["sizes"]))
        if x["naming"]:
            print("   ── 命名差异（同一概念，不同卷不同叫法，不是缺口）")
            for g in x["naming"]:
                print("      %-22s %s" % (
                    g["concept"],
                    " | ".join("数%s「%s」" % (v, n) for v, n in g["names"].items())))
        if x["real"]:
            print("   ── 真实差异")
            for v, items in x["real"]:
                print("      数%s 缺：%s" % (v, " / ".join(items)))

    print()
    print("=" * W)
    print("同义 / 重复节点")
    print("=" * W)
    print("\n[完全同名、不同 ID] %d 组" % len(same))
    for s in same:
        print("   %s  scope=%s" % (s["name"], s["scope"]))
    print("\n[仅差一个连词、不同 ID] %d 组" % len(near_name))
    for s in near_name:
        print("   %s  scope=%s" % ("  ⟷  ".join(s["names"]), s["scope"]))
    print("\n[三卷切分粒度不一致] %d 组（人工认定，机器判不了）" % len(near))
    KIND = {"same-item": "同一大纲条目、两个卷各起名",
            "coarser": "一卷细、一卷合（影响考频排序）",
            "NOT-dup": "看似重复、实则不同内容，不可合并"}
    for s in near:
        print("   [%s] %-28s %-11s ⟷ %-30s %s" % (
            KIND[s["kind"]], s["a"], s["a_scope"], s["b"], s["b_scope"]))
        if s["note"]:
            print("        %s" % s["note"])

    print()
    print("=" * W)
    print("大纲条目承载性抽查（证据，非判定）")
    print("=" * W)
    print("题干命中 = 题干或解析里出现该词的题数；精讲提及 = 精讲正文出现该词的篇数。")
    print("检出 0 不等于没考过——「全概率」「格林公式」这类词题干里本就不会出现。")
    print()
    for p in probes:
        where = ", ".join("%s×%d" % (k, v) for k, v in
                          sorted(p["where"].items(), key=lambda x: -x[1])[:3])
        print("  数%s %-16s %-28s 题干 %2d 题 | 精讲 %2d 篇 | %s" % (
            p["vol"], p["part"], p["item"], p["n_q"], p["n_jj"], where or "无命中"))


if __name__ == "__main__":
    main()
