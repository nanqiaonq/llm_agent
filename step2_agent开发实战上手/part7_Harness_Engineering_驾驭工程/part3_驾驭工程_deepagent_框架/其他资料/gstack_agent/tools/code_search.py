"""code_search 工具：ripgrep 风格的快速代码检索（fallback 到 grep）。

与 read_file/grep 工具的区别：
- read_file: 单文件全文读取
- grep (内置): 按 backend 走，受 virtual_mode 路径约束
- code_search: 直接物理磁盘 ripgrep，速度更快、跨大型代码库更适合

设计取舍：
- 仅用于 read 场景，不参与写操作
- 不进入 HITL（read 类工具默认放行）
- 工作目录锁到 WORKSPACE_DIR
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Optional

from langchain.tools import tool

from gstack_agent.config import WORKSPACE_DIR


@tool
def code_search(
    pattern: str,
    path: Optional[str] = None,
    file_glob: Optional[str] = None,
    max_results: int = 50,
) -> str:
    """Search code for a regex pattern using ripgrep (or grep fallback).

    Faster than the built-in grep for large codebases. Output includes
    `file:line:content` format. Caps at ``max_results`` matches.

    Args:
        pattern: Regex pattern to search for.
        path: Subdirectory to search under (relative to workspace). Defaults to workspace root.
        file_glob: Optional file glob filter (e.g. ``*.py``).
        max_results: Max matches to return. Default 50.

    Returns:
        Matched lines in `file:line:content` format, or empty result message.
    """
    base = WORKSPACE_DIR
    if path:
        target = (base / path.lstrip("/")).resolve()
        # 路径越狱防护：确保 target 在 WORKSPACE_DIR 内
        if not str(target).startswith(str(base)):
            return f"[code_search] path '{path}' escapes workspace"
        if not target.exists():
            return f"[code_search] path not found: {target}"
    else:
        target = base

    # 优先尝试 ripgrep（速度快），失败回退到 grep -r
    rg_args = ["rg", "--no-heading", "-n", "-C", "0", "-m", str(max_results), pattern, str(target)]
    if file_glob:
        rg_args[2:2] = ["-g", file_glob]

    try:
        result = subprocess.run(rg_args, capture_output=True, text=True, timeout=30)
        if result.returncode in (0, 1):  # 1 = 无匹配也算正常
            out = (result.stdout or "").strip()
            return out if out else f"[code_search] no matches for '{pattern}' in {target}"
    except FileNotFoundError:
        pass  # ripgrep 未安装，下面 fallback 到 grep
    except subprocess.TimeoutExpired:
        return f"[code_search] timeout while searching '{pattern}'"

    # Fallback: grep -rn
    grep_args = ["grep", "-rn", "-m", str(max_results), pattern, str(target)]
    if file_glob:
        grep_args.insert(1, f"--include={file_glob}")
    try:
        result = subprocess.run(grep_args, capture_output=True, text=True, timeout=30)
        out = (result.stdout or "").strip()
        return out if out else f"[code_search] no matches for '{pattern}' in {target}"
    except Exception as e:  # noqa: BLE001
        return f"[code_search] error: {type(e).__name__}: {e}"
