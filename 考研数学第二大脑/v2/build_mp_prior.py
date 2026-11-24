# -*- coding: utf-8 -*-
"""
Web 评分数据 → 小程序数据模块 mp/data/kpPrior.js。

读 v2/data/prior.json（build_prior.py 产出的 92 考点评分）与
v2/data/kp.json（考点树：scope 卷别、chap 章名），按 id 关联后
输出 CommonJS 模块，供小程序 engine.priorKpRows 直接 require。

──────────────────────────────────────────────────────────
为什么要单独做这一步
──────────────────────────────────────────────────────────
prior.json 是 Web 端用的字典结构（kp 以 id 为键），且**没有** scope/chap——
评分只管排序，卷别归属要回考点树查。小程序是同步 require，不适合运行时
再跨两张表 join，所以在构建期摊平成数组（按 rank 升序，同分按 name 稳定排序，
与 build_prior.py 的 (-S, name) 排序完全一致）。

──────────────────────────────────────────────────────────
硬约束（别改）
──────────────────────────────────────────────────────────
1. 评分只用于排序，不是学习建议——不输出任何「该学/不该学」字段。
2. 同分并列由 prior.json 的 rank 决定（competition ranking），本脚本
   只搬运、不重排、不硬拆名次。
3. 一对多 1/n 等额分摊发生在 build_prior.py，这里不重新计算。

幂等：可重复运行，输出只由两个输入 JSON 决定，覆盖写。
跑法：cd 考研数学第二大脑/v2 && python3 build_mp_prior.py
"""
import json, io, os, collections

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
MP_DATA = os.path.normpath(os.path.join(BASE, '..', 'mp', 'data'))
OUT = os.path.join(MP_DATA, 'kpPrior.js')


def build():
    prior = json.load(io.open(os.path.join(DATA, 'prior.json'), encoding='utf-8'))
    nodes = json.load(io.open(os.path.join(DATA, 'kp.json'), encoding='utf-8'))['nodes']

    # 只按 id 关联考点树补 scope / chap；评分字段一律原样搬运
    tree = dict((n['id'], n) for n in nodes)
    rows = []
    for cid, r in prior['kp'].items():
        n = tree.get(cid)
        if not n:
            raise ValueError('prior 里的考点 id 在 kp.json 找不到: ' + cid)
        rows.append(dict(
            id=cid, name=r['name'],
            scope=n['scope'], chap=n['chap'],
            F=r['F'], D=r['D'], S=r['S'], rank=r['rank'],
            py=r['py'], pn=r['pn'], hard=r['hard'], nrow=r['nrow'],
        ))

    # rank 由 (-S, name) 派生，这里按 (rank, name) 排 → 与 Web 后端顺序一致。
    # 同分同 rank，排在前面的仍是 name 升序，不会把并列拆成连续名次。
    rows.sort(key=lambda x: (x['rank'], x['name']))

    # meta 原样带过去（含 w_freq/w_diff/years/n_scored/n_kp）
    out = dict(meta=prior['meta'], kp=rows)
    with io.open(OUT, 'w', encoding='utf-8') as f:
        f.write('module.exports=')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    # ---- 自检（并列组数从数据派生，不硬编码）----
    by_s = collections.defaultdict(list)
    for r in rows:
        by_s[r['S']].append(r)
    ties = dict((s, g) for s, g in by_s.items() if len(g) > 1)

    # 并列组必须同 rank；不同分必须不同 rank（competition ranking 的充要条件）
    bad_tie = [s for s, g in ties.items() if len(set(x['rank'] for x in g)) != 1]
    ranks = [r['rank'] for r in rows]
    if bad_tie:
        raise ValueError('同分未并列: ' + str(sorted(bad_tie)))
    if len(set(ranks)) != len(set(r['S'] for r in rows)):
        raise ValueError('不同分出现了相同 rank，名次被拆/被并了')

    scope_cnt = collections.Counter()
    for r in rows:
        for v in r['scope']:
            scope_cnt[v] += 1

    print('生成 %d 条考点 → %s' % (len(rows), OUT))
    print('并列组 %d 组（涉及 %d 个考点，从 S 动态派生）' %
          (len(ties), sum(len(g) for g in ties.values())))
    print('名次范围 %d..%d，%d 个不同名次' %
          (min(ranks), max(ranks), len(set(ranks))))
    print('scope 覆盖: ' + ', '.join('数学%s %d 条' % (v, scope_cnt[v])
                                    for v in sorted(scope_cnt)))


if __name__ == '__main__':
    build()
