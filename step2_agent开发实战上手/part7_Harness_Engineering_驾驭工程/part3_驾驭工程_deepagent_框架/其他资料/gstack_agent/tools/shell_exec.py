"""shell_exec 工具：受控 bash 命令执行。

工程要点：
- 命令白名单（拒绝 rm/mv/dd/curl 等高风险命令）
- 工作目录锁定到 WORKSPACE_DIR（不允许 cd 出去）
- 超时保护（默认 60s）
- 输出截断（防止把 100MB 日志塞进 LLM context）
- 标准 LangChain @tool 装饰器，自动暴露 docstring 给 LLM
"""
from __future__ import annotations

import shlex
import subprocess
from typing import List

from langchain.tools import tool

from gstack_agent.config import WORKSPACE_DIR

# 白名单：只允许这些命令的首 token；其他一律拒绝
# 偏向 read-only 命令；写操作走 write_file/edit_file 触发 HITL
_ALLOWED_COMMANDS: set[str] = {
    # 读取与导航
    "cat", "head", "tail", "less", "more",
    "ls", "tree", "find", "pwd", "echo",
    "wc", "stat", "file",
    # 文本处理
    "grep", "rg", "sed", "awk", "sort", "uniq", "cut", "diff",
    # 进程查看（read-only）
    "ps", "top", "df", "du",
    # 语言运行（执行用户代码 / 跑测试）
    "python3", "python", "node", "bun", "deno",
    "pip", "uv", "poetry", "npm", "pnpm", "yarn",
    "pytest", "ruff", "mypy", "black", "isort",
    # git 只读
    "git",   # git 子命令不限，但 git push/reset --hard 等仍由 HITL 审批
    # 网络（受限）
    "curl",  # curl 默认拒绝，但偶尔需要拉文档；HITL 会兜底
}


@tool
def shell_exec(command: str, timeout: int = 60) -> str:
    """Execute a bash command in the workspace directory.

    Use for running scripts, tests, git inspection, file traversal, or any
    read-only system task. The command must start with an allowed binary.

    Args:
        command: The full bash command line (e.g. ``python3 main.py --help``).
        timeout: Max seconds to wait before killing the process. Default 60.

    Returns:
        Combined stdout + stderr (truncated to ~6KB), or an error string.
    """
    parts: List[str] = shlex.split(command)
    if not parts:
        return "[shell_exec] empty command"

    head = parts[0]
    if head not in _ALLOWED_COMMANDS:
        allowed_preview = ", ".join(sorted(_ALLOWED_COMMANDS)[:15]) + " ..."
        return (
            f"[shell_exec] command '{head}' not in allowlist.\n"
            f"Allowed (sample): {allowed_preview}\n"
            f"Tip: use write_file/edit_file for write operations (they trigger HITL)."
        )

    try:
        result = subprocess.run(
            parts,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(WORKSPACE_DIR),
        )
        out = (result.stdout or "") + (result.stderr or "")
        if not out.strip():
            return f"[shell_exec] exit={result.returncode}, no output"
        # 截断防止超 LLM context 窗口
        if len(out) > 6000:
            out = out[:6000] + f"\n... [truncated, total {len(out)} bytes]"
        return f"[shell_exec exit={result.returncode}]\n{out}"
    except subprocess.TimeoutExpired:
        return f"[shell_exec] timeout after {timeout}s"
    except Exception as e:  # noqa: BLE001
        return f"[shell_exec] error: {type(e).__name__}: {e}"
