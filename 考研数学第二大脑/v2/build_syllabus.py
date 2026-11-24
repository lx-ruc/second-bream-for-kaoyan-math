# -*- coding: utf-8 -*-
"""
skill「考研数学第二大脑 v1.3.0」官方大纲全表 → 小程序数据模块 mp/data/syllabus.js。

读 ~/.workbuddy/skills/kaoyan-math-second-brain/references/outline.json，
产出 CommonJS 模块供 mp/utils/engine.js 的 syllabusChapters / syllabusChapter /
syllabusQuery 同步 require。

──────────────────────────────────────────────────────────
这是第二棵树，不是考点树
──────────────────────────────────────────────────────────
1. 本表是官方大纲「章节—考点」，逐字转录自 outline.json；真题考点树
   （mp/data/kp.js，92 考点按真题出场归类）是另一棵树，两棵并列、不合并、
   不互校。不得用本表校正真题热度，也不得用真题热度校正本表。
2. 章号/章名按各卷官方原文分别保留（titles 是 {卷: 章名} 映射）；数二/数三
   把多元微分与二重积分合为「多元函数微积分学」一章（H5），数一拆 H5+H6。
   卷种边界、独有考点一律来自 outline.json 的 exams / points_by_exam，
   本脚本不写任何「数一独有 XXX」的判断。
3. H/L/P 编码原样保留；code_only（H9/H10/L7，官方不单列成章）单独放 codeOnly，
   不与独立章混排，注记原样搬运。
4. notes 是 skill 内置说明（含要求层级差异 / 考情边界），**不是大纲条文**；
   页面须显式标注。outline.json 的 meta.scope 已声明「了解/理解/掌握层级差异
   写入 notes，不单列」——不存在逐条 level 字段，本脚本不编造。
5. 2027 版对 2026 版考试内容、考试要求零增删（meta.basis / SKILL.md 硬规则），
   不写「2027 新增考点」之类机构解读。

幂等：只由一个输入 JSON 决定输出，覆盖写；连跑两次字节一致。
跑法：cd 考研数学第二大脑/v2 && python3 build_syllabus.py
"""
import io, json, os

HOME = os.path.expanduser('~')
SRC = os.path.join(HOME, '.workbuddy', 'skills', 'kaoyan-math-second-brain',
                   'references', 'outline.json')
BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(BASE, '..', 'mp', 'data', 'syllabus.js'))

# 页面必须显示的来源标注字面量：与派单一致，且能从 outline.json 的 meta.basis
# 与 SKILL.md 硬规则直接核对（2027 相对 2026 零增删）。
SOURCE_NOTE = '依据：skill v1.3.0 outline.json，2027 版对 2026 版零增删'


def build():
    with io.open(SRC, encoding='utf-8') as f:
        src = json.load(f)

    meta = src['meta']
    exams = src['exams']

    # 科目元数据：去掉嵌套 chapters（章节摊平到顶层），其余原样搬运
    subjects = []
    chapters = []
    for sub in src['subjects']:
        subjects.append({
            'key': sub['key'],
            'name': sub['name'],
            'examNames': sub.get('exam_names') or {},
        })
        for ch in sub['chapters']:
            chapters.append({
                'code': ch['code'],
                'subjectKey': sub['key'],
                'subjectName': sub['name'],
                'titles': ch['titles'],
                'exams': ch['exams'],
                'pointsCommon': ch.get('points_common') or [],
                'pointsByExam': ch.get('points_by_exam') or {},
                'notes': ch.get('notes') or '',
            })

    # 官方不单列成章的编码：独立字段，原样搬运（note 属 skill 说明，非条文）
    code_only = []
    for item in (src.get('code_only') or []):
        code_only.append({
            'code': item['code'],
            'name': item['name'],
            'exams': item['exams'],
            'note': item.get('note') or '',
        })

    out = {
        'meta': {
            'version': meta['version'],
            'basis': meta['basis'],
            'verified': meta['verified'],
            'source_note': SOURCE_NOTE,
            'reading': meta.get('reading') or '',
            'scope': meta.get('scope') or '',
            'caveat': meta.get('caveat') or '',
        },
        'exams': exams,
        'subjects': subjects,
        'chapters': chapters,
        'codeOnly': code_only,
    }

    # ---- 写前自检：编码唯一（wx:key 的数据基础），卷种归属必须是已知卷 ----
    known = set(exams)
    all_codes = [c['code'] for c in chapters] + [c['code'] for c in code_only]
    if len(all_codes) != len(set(all_codes)):
        raise ValueError('大纲编码重复: ' + str(sorted(set(
            c for c in all_codes if all_codes.count(c) > 1))))
    for c in chapters + code_only:
        unknown = set(c['exams']) - known
        if unknown:
            raise ValueError('%s 出现未知卷种: %s' % (c['code'], sorted(unknown)))
        if isinstance(c, dict) and 'titles' in c:
            for e in c['exams']:
                if not c['titles'].get(e):
                    raise ValueError('%s 缺 %s 官方章名' % (c['code'], e))

    with io.open(OUT, 'w', encoding='utf-8') as f:
        f.write('module.exports=')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    # ---- 实测输出：每卷「章数 / 编码数（含非独立章编码）」，全部从数据派生 ----
    print('生成 %d 章 + %d 个非独立章编码 → %s' %
          (len(chapters), len(code_only), OUT))
    for exam in exams:
        n_ch = sum(1 for c in chapters if exam in c['exams'])
        n_cd = n_ch + sum(1 for c in code_only if exam in c['exams'])
        print('  %s：%d 章 / %d 编码' % (exam, n_ch, n_cd))
    print('  编码全集 %d 个：%s' % (len(all_codes), ' '.join(all_codes)))


if __name__ == '__main__':
    build()
