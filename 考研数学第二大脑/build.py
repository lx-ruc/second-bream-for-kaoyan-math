#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建脚本 v0.1
1. 校验考点树与真题/题库的引用完整性
2. 从考点树 scope 展开三卷 syllabus 覆盖矩阵
3. 按「考点 × 画像池」聚合命题画像（时间衰减加权）
4. 把数据内联进单文件 HTML，产出 dist/第二大脑-纠偏原型.html
"""
import json, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, "data")

def load(name):
    with open(os.path.join(D, name), encoding="utf-8") as f:
        return json.load(f)

def weight(year):
    if year >= 2021: return 1.5
    if year >= 2016: return 1.0
    return 0.7

def pool_of(block, subject):
    if block == "XD": return "XD_ALL"
    if block == "GL": return "GL_13"
    return "GS_%d" % subject

def main():
    kp = load("kp.json")
    exams = load("exams.json")
    questions = load("questions.json")

    nodes = kp["nodes"]
    by_id = {n["id"]: n for n in nodes}

    # --- 校验 ---
    errors = []
    for n in nodes:
        if n["parent"] and n["parent"] not in by_id:
            errors.append("kp %s 的 parent %s 不存在" % (n["id"], n["parent"]))
        if not set(n["scope"]) <= {"1", "2", "3"}:
            errors.append("kp %s scope 非法: %s" % (n["id"], n["scope"]))
    for e in exams["exams"]:
        if e["kp"] not in by_id:
            errors.append("exam %s 引用未知考点 %s" % (e["id"], e["kp"]))
        if e["s"] not in (1, 2, 3):
            errors.append("exam %s 卷种非法" % e["id"])
        if by_id.get(e["kp"]) and str(e["s"]) not in by_id[e["kp"]]["scope"]:
            errors.append("exam %s（%d 卷）落在超纲考点 %s 上，请检查标注" % (e["id"], e["s"], e["kp"]))
    for q in questions["questions"]:
        if q["kp"] not in by_id:
            errors.append("question %s 引用未知考点 %s" % (q["id"], q["kp"]))
    if errors:
        print("校验失败：")
        for x in errors: print("  -", x)
        sys.exit(1)

    # --- syllabus 覆盖矩阵 ---
    syllabus = {}
    has_child = {n["parent"] for n in nodes if n["parent"]}
    leaves = [n for n in nodes if n["id"] not in has_child and n["level"] > 0]
    for n in leaves:
        syllabus[n["id"]] = {s: (str(s) in n["scope"]) for s in (1, 2, 3)}
    # 章节层取子节点并集，便于按章统计
    for n in nodes:
        if n["level"] < 2:
            kids = [c for c in nodes if c["parent"] == n["id"]]
            if kids:
                syllabus[n["id"]] = {s: any(syllabus.setdefault(k["id"], {}).get(s, False) for k in kids) for s in (1, 2, 3)}

    # --- 命题画像 ---
    prof = defaultdict(lambda: {"n": 0, "wc": 0.0, "method_w": defaultdict(float),
                                "family_w": defaultdict(float), "dmin": 9, "dmax": 0,
                                "last": 0, "years": []})
    for e in exams["exams"]:
        block = e["kp"][:2]
        pools = [pool_of(block, e["s"])]
        if block == "GS":
            pools.append("GS_ALL")  # 冷考点跨卷借考法分布的兜底池
        w = weight(e["y"])
        for pool in pools:
            k = "%s|%s" % (e["kp"], pool)
            p = prof[k]
            p["n"] += 1
            p["wc"] += w
            p["method_w"][e["m"]] += w
            p["family_w"][e["f"]] += w
            p["dmin"] = min(p["dmin"], e["d"])
            p["dmax"] = max(p["dmax"], e["d"])
            p["last"] = max(p["last"], e["y"])
            p["years"].append(e["y"])

    profile = {}
    for k, p in prof.items():
        if p["dmin"] > p["dmax"]:
            p["dmin"], p["dmax"] = 0, 0
        profile[k] = {
            "n": p["n"],
            "wc": round(p["wc"], 2),
            "method": {m: round(v / p["wc"], 4) for m, v in p["method_w"].items()},
            "family": {f: round(v / p["wc"], 4) for f, v in p["family_w"].items()},
            "dmin": p["dmin"], "dmax": p["dmax"], "last": p["last"],
        }

    # --- 画像覆盖率自检 ---
    covered = len({k.split("|")[0] for k in profile})
    leaf_ids = {n["id"] for n in leaves}
    print("考点树：%d 节点 / %d 叶子" % (len(nodes), len(leaf_ids)))
    print("真题语料：%d 条，覆盖 %d 个考点（%.0f%%）" % (len(exams["exams"]), covered, 100.0 * covered / max(1, len(leaf_ids))))
    print("画像组合：%d 个（考点 × 池）" % len(profile))

    with open(os.path.join(D, "syllabus.json"), "w", encoding="utf-8") as f:
        json.dump({"version": kp["version"], "matrix": syllabus}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(D, "profile.json"), "w", encoding="utf-8") as f:
        json.dump({"version": kp["version"], "profile": profile}, f, ensure_ascii=False, indent=1)

    payload = {
        "kp": nodes,
        "syllabus": syllabus,
        "exams": exams["exams"],
        "profile": profile,
        "questions": questions["questions"],
        "meta": {"version": "0.1", "built": "2026-11-06", "seed": True},
    }

    tpl_path = os.path.join(ROOT, "src", "template.html")
    with open(tpl_path, encoding="utf-8") as f:
        html = f.read()
    if "__DATA__" not in html:
        print("模板缺少 __DATA__ 占位符")
        sys.exit(1)
    html = html.replace("__DATA__", json.dumps(payload, ensure_ascii=False, separators=(",", ":")))

    out = os.path.join(ROOT, "dist", "第二大脑-纠偏原型.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("已产出：%s（%.1f KB）" % (out, os.path.getsize(out) / 1024))

if __name__ == "__main__":
    main()
