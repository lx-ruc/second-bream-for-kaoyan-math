# -*- coding: utf-8 -*-
"""
skill「考研数学第二大脑 v1.3.1」启发式拆题评分参数 → 小程序数据模块 mp/data/rubric.js。

读 ~/.workbuddy/skills/kaoyan-math-second-brain/references/assessment-rubric.json，
整份原样产出 CommonJS 模块供 mp/utils/engine.js 的 fidelityScore / assessValue
同步 require。dimensions / thresholds / verdict_rule / value_formula /
coverage_formula / veto / disclaimer / default_minutes 等字段一个不改、一个不漏；
subject_ratio / levels / transfer / personal.neutral 也在同一份 JSON 里，一并原样搬运，
评分函数不再自带任何权重常量。

──────────────────────────────────────────────────────────
与事实层的边界（硬约束）
──────────────────────────────────────────────────────────
1. 本表是**启发式判据**，不是官方口径、不是精确概率。disclaimer 原文必须随结果展示。
2. 小程序事实层 practiceValue（真题相似度四带，阈值 0.55/0.34/0.23）另在
   mp/utils/engine.js，与本表并列、不以本表校正；两层冲突以事实层为准。
3. 大纲树（mp/data/syllabus.js）与真题树（mp/data/kp.js）不合并、不互校。
   本脚本只搬运 rubric 的 subject_ratio / coverage_formula，不读大纲与真题数据。

幂等：只由一个输入 JSON 决定输出，覆盖写；连跑两次字节一致。
跑法：cd 考研数学第二大脑/v2 && python3 build_rubric.py
"""
import io, json, os

HOME = os.path.expanduser('~')
SRC = os.path.join(HOME, '.workbuddy', 'skills', 'kaoyan-math-second-brain',
                   'references', 'assessment-rubric.json')
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(BASE, '..', 'mp', 'data', 'rubric.js'))

# 评分函数运行时必读的字段。缺一个就报错，不静默给默认值——默认值是编造的起点。
REQUIRED = [
    'dimensions', 'thresholds', 'verdict_rule', 'value_formula',
    'coverage_formula', 'veto', 'disclaimer', 'default_minutes',
    'subject_ratio', 'levels', 'transfer', 'personal', 'fidelity',
]


def build():
    with io.open(SRC, encoding='utf-8') as f:
        src = json.load(f)

    # ---- 写前自检 ----
    missing = [k for k in REQUIRED if k not in src]
    if missing:
        raise ValueError('assessment-rubric.json 缺字段: ' + ', '.join(missing))

    dims = src['dimensions']
    keys = [d['key'] for d in dims]
    if len(keys) != len(set(keys)):
        raise ValueError('dimensions.key 重复: ' + str(keys))
    wsum = sum(d['weight'] for d in dims)
    if abs(wsum - 1.0) > 1e-9:
        raise ValueError('dimensions 权重之和 != 1: ' + str(wsum))

    th = src['thresholds']
    for k in ['worth_score', 'optional_score', 'hard_fidelity', 'worth_fidelity']:
        if k not in th:
            raise ValueError('thresholds 缺 ' + k)
    if len(src['fidelity']) != 6:
        raise ValueError('fidelity 判据不是六条: ' + str(len(src['fidelity'])))
    if 'neutral' not in src['personal']:
        raise ValueError('personal 缺 neutral')

    # 整份原样输出：不重排、不补字段、不写任何本项目自定义常量
    with io.open(OUT, 'w', encoding='utf-8') as f:
        f.write('module.exports=')
        json.dump(src, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    # ---- 实测输出：全部从输入 JSON 派生，不硬编码比例/权重 ----
    print('生成 rubric → %s（%d 字节）' % (OUT, os.path.getsize(OUT)))
    print('  版本 %s / 更新 %s' % (src.get('version'), src.get('updated')))
    print('  五维权重: ' + ', '.join('%s=%s(%s)' % (d['key'], d['weight'], d.get('origin', '')) for d in dims))
    print('  阈值: ' + ', '.join('%s=%s' % (k, th[k]) for k in ['worth_score', 'optional_score', 'hard_fidelity', 'worth_fidelity']))
    print('  判据: ' + ', '.join(f['code'] for f in src['fidelity']))
    print('  否决: ' + ', '.join(v['code'] for v in src['veto']))
    print('  分值占比: ' + ', '.join('%s %s' % (e, r) for e, r in src['subject_ratio'].items()))
    print('  default_minutes: ' + ', '.join('%s=%s' % (k, v) for k, v in src['default_minutes'].items()))
    print('  personal.neutral=%s；disclaimer %d 字' % (src['personal']['neutral'], len(src['disclaimer'])))


if __name__ == '__main__':
    build()
