#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
腾讯文档语料 → 结构化数据

输入（raw/，均来自腾讯文档原文快照，fetch_space.py 可重新抓取）：
  idx1/2/3.json   数学一/二/三 全考点真题索引（2009-2026）
  jj/*.json       170 个考点逐题精讲页（题干 + 答案 + 解析 + 思路族），
                  meta 含 fid/vol/jj/标题，考点名从标题解析（不再用 jj_registry.json）
  zt_word.json    根级「必刷真题」word 文档（备查，暂不解析）
  kaopin.csv      “为你代研”87-26 真题考频统计表

输出（data/）：
  kp.json         考点树：一考点一 ID，三卷用 scope 标记覆盖
  exams.json      真题坐标：卷 / 年 / 题号 / 题型 / 分值 / 考点
  jj.json         方法库：每考点的思路族 + 逐题题干与解析
  kaopin.json     考频先验：40 年复现率 / 难易 / 目标分数段（独立口径）
  coverage.json   覆盖率体检
"""
import csv
import json
import os
import re
import hashlib

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def load(name):
    with open(os.path.join(RAW, name), encoding="utf-8") as f:
        return json.load(f)["content"] if name.endswith(".json") and "/" not in name else json.load(f)


def norm(s):
    """考点名归一：去空白、编号、标点，用于跨卷合并同一考点"""
    s = re.sub(r"\(.*?\)|（.*?）", "", s)
    s = re.sub(r"^\s*\d+\s*[、.．]\s*", "", s)
    return re.sub(r"[\s\d、.．，,：:·\-—–_]", "", s)


def kp_id(name):
    return "K" + hashlib.sha1(norm(name).encode()).hexdigest()[:8]


# ---------- 1. 真题索引 ----------
TYPES = ("选择", "填空", "解答")


def parse_index(fn, vol):
    c = load(fn)
    out = []
    for line in c.split("\n"):
        if not line.startswith("|"):
            continue
        cells = [x.strip() for x in line.strip().strip("|").split("|")]
        if len(cells) < 5 or not re.fullmatch(r"\d+", cells[0]):
            continue
        chap, kp = [x.strip() for x in cells[1].split("/", 1)]
        recs = re.findall(r"(\d{4})\s*第(\d+)题（(选择|填空|解答)\s*(\d+)分）", cells[3])
        out.append(dict(vol=vol, order=int(cells[0]), chap=chap, kp=kp,
                        declared=int(cells[2]) if cells[2].isdigit() else len(recs),
                        jj_label=cells[4], recs=recs))
    return out


VOLS = {"1": "idx1.json", "2": "idx2.json", "3": "idx3.json"}

kp_nodes = {}      # id -> node
exams = []
chap_of = {}       # (vol, kp_id) -> chap
for vol, fn in VOLS.items():
    rows = parse_index(fn, vol)
    for r in rows:
        kid = kp_id(r["kp"])
        n = kp_nodes.setdefault(kid, dict(id=kid, name=r["kp"], scope=[], chap={},
                                          order={}, declared={}))
        if vol not in n["scope"]:
            n["scope"].append(vol)
        n["chap"][vol] = r["chap"]
        n["order"][vol] = r["order"]
        n["declared"][vol] = r["declared"]
        for (y, no, t, sc) in r["recs"]:
            exams.append(dict(id="E%04d" % (len(exams) + 1), vol=vol, y=int(y),
                              no=int(no), t=t, sc=int(sc), kp=kid))

for n in kp_nodes.values():
    n["scope"].sort()
    n["n"] = {}
    for e in exams:
        if e["kp"] == n["id"]:
            n["n"][e["vol"]] = n["n"].get(e["vol"], 0) + 1

# ---------- 2. 精讲页：思路族 + 逐题题干/答案/解析 ----------
def parse_jj(c):
    """返回 (一句话, 思路族, 题列表)"""
    brief = ""
    m = re.search(r"一句话[：:]\s*(.+?)(?=\n|一、)", c)
    if m:
        brief = m.group(1).strip()
    fams = []
    for m in re.finditer(r"思路\s*(\d+)\s*[｜|]\s*", c):
        tail = c[m.end():m.end() + 160].strip()
        cut = tail.find("。")
        seg = tail[:cut] if cut > 0 else tail[:56]
        if cut <= 0:  # 没截到句号，清理截断残缺的 LaTeX 命令
            seg = re.sub(r"\\[a-zA-Z]{0,8}$", "", seg)
            seg = seg.rstrip("\\|([{ ")
        seg = seg.strip("，、 ")
        fams.append(dict(n=int(m.group(1)), text=seg[:110]))
    fams.sort(key=lambda x: x["n"])

    # 真题精练段
    start = c.find("真题精练")
    body = c[start:] if start >= 0 else ""
    end = re.search(r"[四五]、", body[10:])
    if end:
        body = body[:10 + end.start()]
    marks = list(re.finditer(r"(\d{4})\s*·\s*第\s*(\d+)\s*题", body))
    qs = []
    for i, mk in enumerate(marks):
        seg = body[mk.end():marks[i + 1].start() if i + 1 < len(marks) else len(body)]
        seg = re.sub(r"^题目（[^）]*）", "", seg)
        ans = meth = ""
        stem = seg
        SOL = re.compile(r"解析\s*(?:[：:·]|[IⅠⅡ一二三](?=\s*[：:]))?")
        if "答案：" in seg:
            stem, rest = seg.split("答案：", 1)
            m2 = SOL.search(rest)
            if m2:
                ans, meth = rest[:m2.start()], rest[m2.end():]
            else:
                ans = rest
        else:
            m2 = SOL.search(seg)
            if m2:
                stem, meth = seg[:m2.start()], seg[m2.end():]
        stem = re.sub(r"^（[^）]*分）", "", stem).strip()
        labels = re.findall(r"法[一二三四五六]\s*（([^）]{2,20})）", meth or "")
        qs.append(dict(y=int(mk.group(1)), no=int(mk.group(2)),
                       stem=re.sub(r"\s+", " ", stem).strip()[:600],
                       ans=re.sub(r"\s+", " ", ans).strip()[:200],
                       # SOL 的「解析 I(?=：)」是前瞻不消费冒号，切完常在开头留一个「：」
                       sol=re.sub(r"\s+", " ", meth).strip().lstrip("：:· ").strip(),
                       methods=labels))
    return brief, fams, qs


# 精讲登记表改为直接从快照 meta 生成（fetch_space.py 抓取时写入），
# 不再依赖手工维护的 jj_registry.json；抓取清单变化后无需同步登记。
VMAP = {"一": "1", "二": "2", "三": "3"}

# 文档标题与索引表考点名有少量措辞差异，精确 kp_id 对不上时用这个别名兜底
# （key=标题名 → value=索引表名；只列宽松匹配也救不回来的）
KP_ALIAS = {
    "幂级数的收敛半径与收敛域": "求幂级数的收敛半径、收敛区间和收敛域",
}


def loose(a, b):
    """去掉「的/求/之间」等虚字后，判断两个考点名是否同义（相等或互相包含）。"""
    ka = re.sub(r"[的求]", "", norm(a).replace("之间", ""))
    kb = re.sub(r"[的求]", "", norm(b).replace("之间", ""))
    return ka == kb or (len(ka) >= 6 and ka in kb) or (len(kb) >= 6 and kb in ka)


def resolve_kid(name, vol):
    """标题名 → 索引表考点 ID。精确优先，同卷范围内宽松匹配兜底。"""
    kid = kp_id(name)
    if kid in kp_nodes:
        return kid
    if name in KP_ALIAS:
        kid = kp_id(KP_ALIAS[name])
        if kid in kp_nodes:
            return kid
    cand = [nid for nid, n in kp_nodes.items()
            if vol in n["scope"] and loose(name, n["name"])]
    return cand[0] if len(cand) == 1 else kid


reg = []
for fn in sorted(os.listdir(os.path.join(RAW, "jj"))):
    if not fn.endswith(".json"):
        continue
    meta = json.load(open(os.path.join(RAW, "jj", fn), encoding="utf-8"))["meta"]
    title = meta.get("title", "")
    m = re.match(r"^数学[一二三]·考点\d+\s*(.+?)[（(]", title)
    kp_name = m.group(1).strip() if m else title
    reg.append(dict(vol=VMAP.get(meta.get("vol"), meta.get("vol")), jj=meta["jj"],
                    kp=kp_name, fid=meta["fid"], src=fn))
jjdocs = []
jj_index = {}   # (vol, y, no) -> 精讲定位
for r in reg:
    d = json.load(open(os.path.join(RAW, "jj", r["src"]), encoding="utf-8"))
    brief, fams, qs = parse_jj(d["content"])
    kid = resolve_kid(r["kp"], r["vol"])
    declared = kp_nodes.get(kid, {}).get("declared", {}).get(r["vol"], len(qs))
    doc = dict(kp=kid, kp_name=r["kp"], vol=r["vol"], jj=r["jj"], fid=r["fid"],
               url="https://docs.qq.com/aio/D%s" % r["fid"], declared=declared,
               brief=brief, families=fams, n=len(qs), qs=qs)
    jjdocs.append(doc)
    for q in qs:
        jj_index[(r["vol"], q["y"], q["no"])] = kid

# 把精讲挂到真题坐标上
for e in exams:
    e["jj"] = 1 if (e["vol"], e["y"], e["no"]) in jj_index else 0

# 考点 → 精讲文档
by_kp = {}
for d in jjdocs:
    by_kp.setdefault(d["kp"], []).append(dict(vol=d["vol"], jj=d["jj"], fid=d["fid"],
                                              url=d["url"], n=d["n"],
                                              fams=len(d["families"])))

# ---------- 3. 考频先验（独立口径，不做考点级强接） ----------
kp_rows = []
rows = list(csv.reader(open(os.path.join(RAW, "kaopin.csv"), encoding="utf-8")))
chap = pt = None
for r in rows[3:]:
    r = (r + [""] * 14)[:14]
    if r[0].strip():
        chap = re.sub(r"\s+", "", r[0])
    if r[1].strip():
        pt = re.sub(r"\s+", "", r[1])
    name = r[2].strip()
    if not name:
        continue
    kp_rows.append(dict(chap=chap, pt=pt, name=name,
                        sm1=r[3], bg1=r[4], fr1=r[5], sc1=r[6],
                        sm2=r[7], bg2=r[8], fr2=r[9], sc2=r[10].strip(),
                        diff=r[11].strip(), target=r[12].strip()))

# ---------- 4. 汇总 ----------
nodes = []
for n in kp_nodes.values():
    nodes.append(dict(id=n["id"], name=n["name"], scope=n["scope"], chap=n["chap"],
                      order=n["order"], declared=n["declared"], n=n.get("n", {}),
                      jj=by_kp.get(n["id"], [])))
nodes.sort(key=lambda x: (x["chap"].get("1", "zz"), x["order"].get("1", 99)))

covered = [n for n in nodes if n["jj"]]
q_total = sum(d["n"] for d in jjdocs)
qs_total = sum(d["declared"] for d in jjdocs)

os.makedirs(OUT, exist_ok=True)
def dump(name, obj):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

dump("kp.json", dict(nodes=nodes))
dump("exams.json", dict(exams=exams))
dump("jj.json", dict(docs=jjdocs))
dump("kaopin.json", dict(rows=kp_rows))

cov = dict(
    volumes=len(VOLS),
    exams=len(exams),
    kp_total=len(nodes),
    kp_with_jj=len(covered),
    kp_by_vol={v: sum(1 for n in nodes if v in n["scope"]) for v in VOLS},
    jj_docs=len(jjdocs),
    jj_questions=q_total,
    jj_declared=qs_total,
    exam_with_jj=sum(e["jj"] for e in exams),
    kaopin=kp_rows,
    kaopin_n=len(kp_rows),
    years=sorted({e["y"] for e in exams}),
)
dump("coverage.json", cov)

print("考点 %d（有精讲 %d）" % (len(nodes), len(covered)))
print("真题 %d 条，其中挂上精讲 %d 条" % (len(exams), cov["exam_with_jj"]))
print("精讲 %d 篇，解析出 %d 题（登记 %d 题）" % (len(jjdocs), q_total, qs_total))
print("考频表 %d 考点；章节 %d" % (len(kp_rows), len({r['chap'] for r in kp_rows})))
bad = [(d["vol"], d["jj"], d["kp_name"], d["n"], d["declared"]) for d in jjdocs if d["n"] != d["declared"]]
print("题数不一致 %d 篇：%s" % (len(bad), bad[:6]))
