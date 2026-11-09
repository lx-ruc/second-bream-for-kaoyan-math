# -*- coding: utf-8 -*-
"""
考点级「考频 × 难度」综合评分，生成 data/prior.json。

依赖 data/kpmap.json（人工映射表），所以必须先跑 build_kpmap.py。

──────────────────────────────────────────────────────────
一、为什么不能直接把考频行加总
──────────────────────────────────────────────────────────
考频表 239 行里有 61 行映射到多个考点（如「一阶微分方程符合四种常见形式」→ 7 个
考点）。整行分值如果全算给每个考点，三卷合计会从 450 分/年 虚增到 520 分/年，
凭空多出 35% 的分。所以一对多时按 1/n 等额分摊——不偏袒任何一个考点，
是这个行名的语义本身跨越了考点边界，我们没有依据判断它更偏谁。

试过用真题库出场数做分摊权重（ρ 能从 0.699 升到 0.770），但已否决：
那等于用 A 语料去校正 B 语料，而项目硬约束是「重要性只能由真题统计得出」，
两套语料不能互相校准。等额分摊是中性假设，不确定性留在明面上。

──────────────────────────────────────────────────────────
二、考频分 F：年均分值，线性归一到 0~100
──────────────────────────────────────────────────────────
用 sc1（87–20 共 34 年累计总分）/ 34 = 年均分值，有物理意义（分/年）。

不用「复现率」：复现率在考点级会饱和。一个考点映射 9 行时，
「每年至少出现一行」的概率接近 1，多个考点并列 1.000 就分不出高下了。

不用对数压缩：试过 log1p，排序结果与线性 Spearman ρ=0.967 几乎一致，
但线性能直接读成「年均考多少分」，更好解释。F 就是 py / max(py) × 100。

──────────────────────────────────────────────────────────
三、难度分 D：分值加权难占比 + 贝叶斯平滑
──────────────────────────────────────────────────────────
考频表的 diff 只有「易/难」两档。考点级的难占比不能直接算，因为 92 个考点里
25 个只映射到 1 行，难占比只能取 0 或 1——92 个考点有 59 个落在端点上，
直接把 0/1 拿去加权，等于让「映射了几行」变成难度信号。

用平滑：hard = (难行分值 + m·p_global) / (总分值 + m)
  p_global = 全表难行分值占比 = 0.142，作为先验
  m = 1 × 考点平均累计分值（实测 142 分），即「给每个考点先垫一份平均体量的样本」

m 的选取有实测依据：m=0 时端点残留 56 个；m=0.5 倍时降到 0，但范围被压得
太窄（0.023~0.669）；m=1 倍时端点 0 个、范围 0.040~0.561，既能区分又不失真；
m 继续加大会把差异抹平（5 倍时只剩 0.093~0.348）。取 1 倍。

注意 diff 与 target 高度重合（易↔100/120、难↔135/135+，交叉表 239 行只有 2 行
不符），两者是同一份信息的两种说法，所以 D 分同时代表「属于 135 分段的比重」。

──────────────────────────────────────────────────────────
四、合成 S = 0.7·F + 0.3·D
──────────────────────────────────────────────────────────
用户定的配比：考频为主。两种分量都归一到 0~100 再加权，
避免量纲差异（分值 vs 概率）让某一项吃掉全部权重。
"""
import json, io, os, collections

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')

W_FREQ, W_DIFF = 0.7, 0.3      # 考频为主（7:3）
SMOOTH_MULT = 1.0              # 平滑强度 = SMOOTH_MULT × 考点平均累计分值
YEARS = 34.0                   # 87–20 共 34 年


def I(x):
    return int(x or 0)


def build():
    rows = json.load(io.open(os.path.join(DATA, 'kpmap.json'), encoding='utf-8'))['rows']
    kps = json.load(io.open(os.path.join(DATA, 'kp.json'), encoding='utf-8'))['nodes']

    # ---- 考点级聚合（一对多按 1/n 分摊）----
    agg = collections.defaultdict(lambda: dict(sc=0.0, sc_hard=0.0, cnt=0.0, nrow=0))
    for r in rows:
        if not r['kp']:
            continue
        w = 1.0 / len(r['kp'])
        sc = I(r['sc1'])
        for name in r['kp']:
            a = agg[name]
            a['sc'] += sc * w
            if r['diff'] == '难':
                a['sc_hard'] += sc * w
            a['cnt'] += (I(r['sm1']) + I(r['bg1'])) * w
            a['nrow'] += 1

    # ---- 全局先验 ----
    all_sc = sum(a['sc'] for a in agg.values())
    all_hard = sum(a['sc_hard'] for a in agg.values())
    p_global = all_hard / all_sc if all_sc else 0.0
    mean_sc = all_sc / len(agg) if agg else 0.0
    m = SMOOTH_MULT * mean_sc

    # ---- 逐考点算 F / D ----
    recs = []
    for k in kps:
        a = agg.get(k['name'])
        if not a:
            continue
        sc = a['sc']
        hard = (a['sc_hard'] + m * p_global) / (sc + m) if (sc + m) else p_global
        recs.append(dict(
            id=k['id'], name=k['name'],
            py=sc / YEARS,                 # 年均分值（分/年，三卷合计）
            pn=a['cnt'] / YEARS,           # 年均出现次数
            hard=hard,                     # 平滑后的难占比
            nrow=a['nrow'],                # 映射了几行考频
        ))

    py_max = max(r['py'] for r in recs)
    h_min = min(r['hard'] for r in recs)
    h_max = max(r['hard'] for r in recs)

    for r in recs:
        r['F'] = round(100.0 * r['py'] / py_max, 1) if py_max else 0.0
        r['D'] = round(100.0 * (r['hard'] - h_min) / (h_max - h_min), 1) if h_max > h_min else 0.0
        r['S'] = round(W_FREQ * r['F'] + W_DIFF * r['D'], 1)
        r['py'] = round(r['py'], 2)
        r['pn'] = round(r['pn'], 2)
        r['hard'] = round(r['hard'], 4)

    recs.sort(key=lambda x: (-x['S'], x['name']))
    # 同分必须并列（competition ranking：1,2,2,4…）。
    # 92 个考点里有 8 组完全同分——大部分是同一行考频按 1/n 分摊后的必然结果
    # （比如「一阶微分方程符合四种常见形式」拆给 7 个考点，每个都一样），
    # 少数是考点库本身有重复节点。数据层面分不出高下，就不该在名次上假装分得出：
    # 项目的硬约束是「模型不判断重不重要」，强行按名字排序拆开名次正是这类越界。
    prev_S, prev_rank = None, 0
    for i, r in enumerate(recs, 1):
        if prev_S is not None and abs(r['S'] - prev_S) < 1e-9:
            r['rank'] = prev_rank
        else:
            r['rank'] = i
            prev_rank = i
        prev_S = r['S']

    out = dict(
        meta=dict(
            w_freq=W_FREQ, w_diff=W_DIFF, years=YEARS,
            p_global=round(p_global, 4), smooth_m=round(m, 1),
            py_max=round(py_max, 2), hard_min=round(h_min, 4), hard_max=round(h_max, 4),
            n_scored=len(recs), n_kp=len(kps),
        ),
        kp={r['id']: r for r in recs},
    )
    with io.open(os.path.join(DATA, 'prior.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    # ---- 自检 ----
    print('评分 %d / %d 个考点' % (len(recs), len(kps)))
    print('全局难占比 p_global=%.4f  平滑 m=%.1f 分  年均分上限=%.2f' %
          (p_global, m, py_max))
    print('F∈[0,%.1f]  D∈[0,%.1f]  S∈[%.1f,%.1f]  中位 %.1f' %
          (max(r['F'] for r in recs), max(r['D'] for r in recs),
           min(r['S'] for r in recs), max(r['S'] for r in recs),
           sorted(r['S'] for r in recs)[len(recs) // 2]))

    # 端点残留检查：平滑后不应再有 0/1 的难度
    edge = [r['name'] for r in recs if r['hard'] < 0.02 or r['hard'] > 0.98]
    print('难度端点残留（应接近 0）：%d 个' % len(edge))
    if edge:
        for n in edge[:5]:
            print('   ', n)

    # 守恒检查：分摊后年均分值总量不应超过三卷实际卷面分值
    total_py = sum(r['py'] for r in recs)
    print('年均分值合计 %.1f 分/年（三卷卷面 450 分/年，缺口来自未映射的空间解析几何等）' % total_py)

    print('\n前 10：')
    for r in recs[:10]:
        print('  %2d %-28s S=%5.1f  F=%5.1f D=%5.1f  年均%.2f分' %
              (r['rank'], r['name'], r['S'], r['F'], r['D'], r['py']))


if __name__ == '__main__':
    build()
