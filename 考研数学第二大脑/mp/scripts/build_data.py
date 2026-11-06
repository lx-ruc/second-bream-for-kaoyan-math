# -*- coding: utf-8 -*-
"""把 v2 的真实语料压成小程序可直接 require 的数据模块。

输出：
  data/kp.js     考点（含逐卷题量、思路族、精讲链接、真题坐标）
  data/stem.js   475 道题的题干
  data/prior.js  考频统计表 239 行

思路族文本从 raw/jj/*.json 重新抽取（v2/data/jj.json 那份被硬截断过，公式被切坏）。
LaTeX 统一转成可读 Unicode：小程序没有 DOM，跑不了 KaTeX，行内小公式用文本近似。
"""
import json
import os
import re
import glob

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.normpath(os.path.join(HERE, "..", "..", "v2"))
OUT = os.path.normpath(os.path.join(HERE, "..", "data"))

GREEK = {
    "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "epsilon": "ε", "varepsilon": "ε",
    "zeta": "ζ", "eta": "η", "theta": "θ", "vartheta": "ϑ", "iota": "ι", "kappa": "κ",
    "lambda": "λ", "mu": "μ", "nu": "ν", "xi": "ξ", "pi": "π", "rho": "ρ", "sigma": "σ",
    "tau": "τ", "upsilon": "υ", "phi": "φ", "varphi": "φ", "chi": "χ", "psi": "ψ", "omega": "ω",
    "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ", "Xi": "Ξ", "Pi": "Π",
    "Sigma": "Σ", "Phi": "Φ", "Psi": "Ψ", "Omega": "Ω",
}
SYM = {
    "to": "→", "rightarrow": "→", "leftarrow": "←", "Rightarrow": "⇒", "Leftarrow": "⇐",
    "infty": "∞", "cdot": "·", "times": "×", "div": "÷", "pm": "±", "mp": "∓",
    "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥", "neq": "≠", "ne": "≠", "approx": "≈",
    "leqslant": "≤", "geqslant": "≥", "lt": "<", "gt": ">",
    "equiv": "≡", "sim": "∼", "cong": "≅", "propto": "∝", "in": "∈", "notin": "∉",
    "subset": "⊂", "subseteq": "⊆", "supset": "⊃", "cup": "∪", "cap": "∩",
    "emptyset": "∅", "forall": "∀", "exists": "∃", "partial": "∂", "nabla": "∇",
    "int": "∫", "iint": "∬", "iiint": "∭", "oint": "∮", "sum": "∑", "prod": "∏",
    "cdots": "⋯", "ldots": "…", "dots": "…", "circ": "∘", "ast": "∗",
    "prime": "′", "ell": "ℓ", "angle": "∠", "triangle": "△", "perp": "⊥", "parallel": "∥",
    "because": "∵", "therefore": "∴", "degree": "°",
    "lim": "lim", "ln": "ln", "log": "log", "exp": "exp", "sin": "sin", "cos": "cos",
    "tan": "tan", "cot": "cot", "sec": "sec", "csc": "csc", "arcsin": "arcsin",
    "arccos": "arccos", "arctan": "arctan", "max": "max", "min": "min", "sup": "sup",
    "inf": "inf", "det": "det", "rank": "rank", "tr": "tr", "grad": "grad",
}
SUP = dict(zip("0123456789+-=()ni", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ"))
SUP.update(dict(zip("abkmxyzpstuvwcdghjlor",
                    "ᵃᵇᵏᵐˣʸᶻᵖˢᵗᵘᵛʷᶜᵈᵍʰʲˡᵒʳ")))
SUB = dict(zip("0123456789+-=()aeoxhklmnpst", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜ"))
DROP = ["\\limits", "\\displaystyle", "\\quad", "\\qquad", "\\left", "\\right",
        "\\big", "\\Big", "\\bigl", "\\bigr", "\\bigg", "\\Bigg",
        "\\textstyle", "\\mathrm", "\\mathbb", "\\mathbf", "\\mathcal"]
# 这些是「间距」命令：必须换成空格，直接删会把 \varphi\,dr 粘成 \varphidr
SPACE_CMDS = ["\\!", "\\,", "\\;", "\\ ", "\\:", "\\>"]


def take_group(s, i):
    """s[i] 应为 '{'，返回 (内容, 右括号后一位)。"""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
    return s[i + 1:], len(s)


def wrap(x):
    return "(" + x + ")" if len(x) > 3 or re.search(r"[+\-·×/ =]", x) else x


def tex(src, depth=0):
    if depth > 5:
        return src
    s = src
    out = []
    i = 0
    while i < len(s):
        if s[i] == "\\":
            m = re.match(r"\\(dfrac|tfrac|frac|sqrt|text|operatorname|rm|overline|hat|bar|vec)", s[i:])
            if m:
                cmd = m.group(1)
                j = i + len(m.group(0))
                while j < len(s) and s[j] == " ":
                    j += 1
                if cmd in ("dfrac", "tfrac", "frac") and j < len(s) and s[j] == "{":
                    a, j = take_group(s, j)
                    while j < len(s) and s[j] == " ":
                        j += 1
                    if j < len(s) and s[j] == "{":
                        b, j = take_group(s, j)
                        out.append("%s/%s" % (wrap(tex(a, depth + 1)), wrap(tex(b, depth + 1))))
                        i = j
                        continue
                elif cmd == "sqrt" and j < len(s) and s[j] == "{":
                    a, j = take_group(s, j)
                    out.append("√(" + tex(a, depth + 1) + ")")
                    i = j
                    continue
                elif cmd in ("text", "operatorname", "rm") and j < len(s) and s[j] == "{":
                    a, j = take_group(s, j)
                    out.append(a)
                    i = j
                    continue
                elif cmd in ("overline", "hat", "bar", "vec") and j < len(s) and s[j] == "{":
                    a, j = take_group(s, j)
                    out.append(tex(a, depth + 1) + "\u0304" if cmd == "overline" else tex(a, depth + 1))
                    i = j
                    continue
                out.append(m.group(0)[1:])
                i = j
                continue
            m2 = re.match(r"\\([A-Za-z]+)", s[i:])
            if m2:
                name = m2.group(1)
                if name in GREEK:
                    out.append(GREEK[name])
                elif name in SYM:
                    out.append(SYM[name])
                else:
                    out.append(name)
                i += len(m2.group(0))
                continue
            # \{ \} \| \% \$ \& 等单字符
            if i + 1 < len(s):
                out.append(s[i + 1])
                i += 2
                continue
            i += 1
            continue
        if s[i] in "^_":
            kind = s[i]
            j = i + 1
            if j < len(s) and s[j] == "{":
                body, j = take_group(s, j)
                body = tex(body, depth + 1)
            elif j < len(s) and s[j] == "\\":
                m3 = re.match(r"\\[A-Za-z]+", s[j:])
                g = m3.group(0) if m3 else s[j:j + 2]
                body, j = tex(g, depth + 1), j + len(g)
            elif j < len(s):
                body, j = s[j], j + 1
            else:
                body = ""
            table = SUP if kind == "^" else SUB
            if body and all(c in table for c in body):
                out.append("".join(table[c] for c in body))
            else:
                if body.startswith("(") and body.endswith(")"):
                    out.append(("^" if kind == "^" else "_") + body)
                else:
                    out.append(("^" if kind == "^" else "_") + (body if len(body) == 1 else "(" + body + ")"))
            i = j
            continue
        if s[i] == "{":
            body, j = take_group(s, i)
            out.append(tex(body, depth + 1))
            i = j
            continue
        out.append(s[i])
        i += 1
    return "".join(out)


def clean(s):
    for d in SPACE_CMDS:
        s = s.replace(d, " ")
    for d in DROP:
        s = s.replace(d, "")
    s = s.replace("\\\\", " ").replace("&", " ")
    s = re.sub(r"\\begin\{[^}]*\}|\\end\{[^}]*\}", " ", s)
    t = tex(s)
    t = re.sub(r"\s*([=≠≤≥<>→≈])\s*", r" \1 ", t)
    t = re.sub(r"([≤≥≠])\s+(\d)", r"\1\2", t)
    t = re.sub(r"[ \t]{2,}", " ", t).strip()
    t = t.replace("$", "")
    return t


def fams_from_raw(raw_dir):
    """按精讲文档 ID 重新抽取思路族全文（v2/data/jj.json 那份被 [:110] 硬切过）。"""
    out = {}
    for path in sorted(glob.glob(os.path.join(raw_dir, "jj", "*.json"))):
        d = json.load(open(path, encoding="utf-8"))
        meta = d.get("meta") or {}
        c = d.get("content") or ""
        keys = list(re.finditer(r"思路\s*(\d+)\s*[｜|]\s*", c))
        fams = []
        for k, m in enumerate(keys):
            start = m.end()
            end = keys[k + 1].start() if k + 1 < len(keys) else min(len(c), start + 400)
            seg = c[start:end]
            # 到第一个句号；没有句号就取 130 字
            cut = seg.find("。")
            seg = seg[:cut] if cut > 0 else seg[:130]
            seg = seg.split("\n")[0].strip(" ，、；:")
            if seg:
                fams.append({"n": int(m.group(1)), "t": clean(seg)})
        fid = meta.get("fid") or os.path.basename(path).split("_")[1]
        if fams and fid not in out:
            out[fid] = fams
    return out


def main():
    kp = json.load(open(os.path.join(V2, "data", "kp.json"), encoding="utf-8"))["nodes"]
    exams = json.load(open(os.path.join(V2, "data", "exams.json"), encoding="utf-8"))["exams"]
    jj = json.load(open(os.path.join(V2, "data", "jj.json"), encoding="utf-8"))["docs"]
    prior = json.load(open(os.path.join(V2, "data", "kaopin.json"), encoding="utf-8"))["rows"]

    fam_raw = fams_from_raw(os.path.join(V2, "raw"))
    fam_json = {}
    for doc in jj:
        fam_json[doc["fid"]] = doc.get("families") or []

    # 题干：按 考点|卷 索引
    stem = {}
    for doc in jj:
        for q in doc["qs"]:
            key = "%s|%s" % (doc["kp"], doc["vol"])
            stem.setdefault(key, []).append({
                "y": q["y"], "o": q["no"],
                "s": clean(q["stem"] or ""),
                "a": clean(q["ans"] or "")[:110],
            })

    has_stem = set((k.split("|")[0], k.split("|")[1], q["y"], q["o"]) for k, v in stem.items() for q in v)

    nodes = []
    for n in kp:
        qs = []
        for e in exams:
            if e["kp"] != n["id"]:
                continue
            t = {"选择": "选", "填空": "填", "解答": "解"}.get(e["t"], e["t"][:1])
            qs.append([e["vol"], e["y"], e["no"], t, e["sc"],
                       1 if (n["id"], e["vol"], e["y"], e["no"]) in has_stem else 0])
        qs.sort(key=lambda x: (x[0], -x[1], x[2]))

        fam = {}
        jjm = {}
        for rec in (n.get("jj") or []):
            v = rec["vol"]
            fid = rec.get("fid")
            src = fam_raw.get(fid) or fam_json.get(fid) or []
            if src:
                fam[v] = [{"n": f["n"], "t": clean(f.get("t") or f.get("text") or "")} for f in src]
            jjm[v] = {"u": rec.get("url", ""), "n": rec.get("n", 0)}

        nodes.append({
            "id": n["id"],
            "name": n["name"],
            "scope": "".join(n.get("scope") or []),
            "chap": {v: n["chap"].get(v, "") for v in (n.get("scope") or [])},
            "fam": fam,
            "jj": jjm,
            "qs": qs,
        })

    prows = []
    for r in prior:
        prows.append([r["chap"], r["pt"], r["name"], r["fr2"], r["diff"], r["target"]])

    os.makedirs(OUT, exist_ok=True)

    def dump(name, obj):
        p = os.path.join(OUT, name + ".js")
        body = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        open(p, "w", encoding="utf-8").write("module.exports=" + body + ";\n")
        print("%-10s %7.1f KB" % (name + ".js", os.path.getsize(p) / 1024))

    dump("kp", {"nodes": nodes})
    dump("stem", stem)
    dump("prior", prows)

    nfam = sum(len(v) for n in nodes for v in n["fam"].values())
    nq = sum(len(n["qs"]) for n in nodes)
    print("考点 %d | 真题坐标 %d | 题干 %d | 思路族 %d | 考频 %d"
          % (len(nodes), nq, sum(len(v) for v in stem.values()), nfam, len(prows)))


if __name__ == "__main__":
    main()
