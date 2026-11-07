#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
腾讯文档知识库空间 → 本地快照(raw/)

数据源:知识库空间 DUk9tZHJGbHNpVFF2(2027 考研数学冲刺,数学一/二/三全考点精讲)。
鉴权:MCP 端点 https://docs.qq.com/openapi/mcp,Authorization 头直接传 token,
     token 从环境变量 TENCENT_DOCS_TOKEN 读(勿硬编码入库)。

输出(raw/,沿用既有 {meta,content} 快照格式,可直接被 ingest.py 消费):
  idx{1,2,3}.json   数学一/二/三 全考点真题索引(2009-2026)
  jj/*.json         每考点精讲一篇:{meta:{jj,name,vol,kp,n,fid,space},content:全文}
  zt_word.json      根级「必刷真题 30 天刷题计划」word 文档(备查,暂不解析)

用法:
  export TENCENT_DOCS_TOKEN=...
  python3 fetch_space.py            # 全量抓取(先清空旧 jj/)
  python3 fetch_space.py --dry-run  # 只枚举节点树,不拉正文
"""
import json
import os
import re
import subprocess
import sys
import time

SPACE_ID = "DUk9tZHJGbHNpVFF2"
MCP_URL = "https://docs.qq.com/openapi/mcp"
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")

# 卷文件夹 node_id(2026-11 探针确认)
FOLDERS = {"1": "RwSDeAUUnUgL", "2": "RuEURmDHCHcZ", "3": "RqTKxWCEXwVB"}
# 根级 word 真题集(备查)
WORD_DOC = "REofGZwgpvqK"

TOKEN = os.environ.get("TENCENT_DOCS_TOKEN", "")
_req_id = 0


def mcp(tool, args, retries=3):
    """调一次 MCP tool,返回内层 JSON(腾讯侧把业务结果再包了一层 text)。"""
    global _req_id
    _req_id += 1
    payload = json.dumps({"jsonrpc": "2.0", "id": _req_id, "method": "tools/call",
                          "params": {"name": tool, "arguments": args}})
    for attempt in range(retries):
        try:
            out = subprocess.run(
                ["curl", "-s", "--max-time", "60", "-X", "POST", MCP_URL,
                 "-H", "Authorization: %s" % TOKEN,
                 "-H", "Content-Type: application/json",
                 "-H", "Accept: application/json, text/event-stream",
                 "-d", payload],
                capture_output=True, text=True, check=True).stdout
            outer = json.loads(out)
            if "error" in outer:
                raise RuntimeError("MCP error: %s" % outer["error"])
            return json.loads(outer["result"]["content"][0]["text"])
        except (subprocess.CalledProcessError, json.JSONDecodeError,
                KeyError, IndexError, RuntimeError) as e:
            if attempt == retries - 1:
                raise
            print("  retry %d (%s: %s)" % (attempt + 1, tool, e), flush=True)
            time.sleep(2 * (attempt + 1))


def list_children(parent_id=None, expect=None):
    """枚举一层节点,翻页取全。返回 children 列表。"""
    children, page = [], 0
    while True:
        args = {"space_id": SPACE_ID, "num": page}
        if parent_id:
            args["parent_id"] = parent_id
        r = mcp("query_space_node", args)
        got = r.get("children", [])
        children.extend(got)
        if expect and len(children) > expect:
            print("  ! %s 子节点 %d 超预期 %d" % (parent_id, len(children), expect))
        if not r.get("has_next"):
            return children
        page += 1


def kp_no(title):
    """标题里的考点编号,如「数学一·考点03 数列…」→ 3;索引文档返回 0。"""
    m = re.search(r"考点\s*(\d+)", title)
    return int(m.group(1)) if m else 0


def fetch_content(fid):
    r = mcp("get_content", {"file_id": fid})
    return r.get("content", "")


def save(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def main():
    if not TOKEN:
        sys.exit("缺 TENCENT_DOCS_TOKEN 环境变量")
    dry = "--dry-run" in sys.argv
    jj_dir = os.path.join(RAW, "jj")
    os.makedirs(jj_dir, exist_ok=True)

    total = 0
    for vol, fid in FOLDERS.items():
        kids = list_children(fid)
        n_kp = sum(1 for c in kids if kp_no(c["title"]))
        print("数学%s: %d 个节点(%d 考点 + %d 索引/其他)" % (
            vol, len(kids), n_kp, len(kids) - n_kp), flush=True)
        if dry:
            continue
        for c in kids:
            title = c["title"].replace("\x0b", " ")  # 标题里偶有垂直制表符
            meta = {"fid": c["node_id"], "space": SPACE_ID,
                    "title": title, "url": c.get("url", "")}
            content = fetch_content(c["node_id"])
            if "全考点真题索引" in title:
                save(os.path.join(RAW, "idx%s.json" % vol),
                     {"meta": meta, "content": content})
                print("  idx%s ← %s (%d 字)" % (vol, title, len(content)), flush=True)
                continue
            no = kp_no(title)
            if not no:
                print("  ? 跳过非考点文档: %s" % title, flush=True)
                continue
            save(os.path.join(jj_dir, "%s_%s_%d.json" % (vol, c["node_id"], no)),
                 {"meta": dict(meta, jj=no, vol=vol), "content": content})
            total += 1
            time.sleep(0.5)
            if total % 20 == 0:
                print("  ... 已抓 %d 篇" % total, flush=True)

    if dry:
        return
    # 根级 word 真题集备查
    r = mcp("get_content", {"file_id": WORD_DOC})
    save(os.path.join(RAW, "zt_word.json"),
         {"meta": {"fid": WORD_DOC, "space": SPACE_ID, "title": "27考研数学一|冲刺提分必刷真题"},
          "content": r.get("content", "")})
    print("完成:考点 %d 篇 + 索引 3 篇 + word 1 篇" % total, flush=True)


if __name__ == "__main__":
    main()
