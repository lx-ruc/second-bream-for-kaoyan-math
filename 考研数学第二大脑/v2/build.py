#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 data/*.json 打包成单文件原型（内联 KaTeX，离线可用）"""
import base64
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
SRC = os.path.join(HERE, "src")
DIST = os.path.join(HERE, "dist")
KATEX = "/tmp/katex/dist"


def jload(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


nodes = jload("kp.json")["nodes"]
exams = jload("exams.json")["exams"]
docs = jload("jj.json")["docs"]
kaopin = jload("kaopin.json")["rows"]

# ---- 索引 ----
by_kp_vol = {}
for e in exams:
    by_kp_vol.setdefault((e["kp"], e["vol"]), []).append(e)

doc_by_kp_vol = {}
for d in docs:
    doc_by_kp_vol.setdefault((d["kp"], d["vol"]), d)

# ---- 精简载荷 ----
KP = []
for n in nodes:
    KP.append(dict(
        id=n["id"], name=n["name"], scope=n["scope"], chap=n["chap"],
        n=n.get("n", {}),
    ))

EX = [dict(k=e["kp"], v=e["vol"], y=e["y"], o=e["no"], t=e["t"], s=e["sc"], j=e["jj"]) for e in exams]


def cut(s, n):
    s = (s or "").strip()
    return s if len(s) <= n else s[:n] + "…"


JJ = []
for d in docs:
    JJ.append(dict(
        k=d["kp"], v=d["vol"], jj=d["jj"], url=d["url"], fid=d["fid"],
        brief=cut(d["brief"], 220),
        fam=[f["text"] for f in d["families"]],
        qs=[dict(y=q["y"], o=q["no"], st=cut(q["stem"], 520),
                 ans=cut(q["ans"], 120), sol=cut((q["sol"] or "").lstrip("：: ·、，"), 900),
                 m=q["methods"][:3]) for q in d["qs"]],
    ))

# ---- KaTeX 内联 ----
css = open(os.path.join(KATEX, "katex.min.css"), encoding="utf-8").read()
fontdir = os.path.join(KATEX, "fonts")
for fn in os.listdir(fontdir):
    if not fn.endswith(".woff2"):
        continue
    b64 = base64.b64encode(open(os.path.join(fontdir, fn), "rb").read()).decode()
    css = css.replace("fonts/%s" % fn, "data:font/woff2;base64,%s" % b64)
css = re.sub(r"src:url\(fonts/[^)]+\.woff\)[^;]*;", "", css)
kjs = open(os.path.join(KATEX, "katex.min.js"), encoding="utf-8").read()

payload = dict(KP=KP, EX=EX, JJ=JJ, KK=kaopin)
pjson = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

tpl = open(os.path.join(SRC, "template.html"), encoding="utf-8").read()
html = (tpl.replace("/*__KATEX_CSS__*/", css)
           .replace("/*__KATEX_JS__*/", kjs)
           .replace("/*__DATA__*/", pjson))

os.makedirs(DIST, exist_ok=True)
out = os.path.join(DIST, "真题库原型.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

print("写出 %s  %.2f MB" % (out, len(html.encode()) / 1048576))
print("考点 %d / 真题 %d / 精讲 %d / 题干 %d" % (
    len(KP), len(EX), len(JJ), sum(len(d["qs"]) for d in JJ)))
