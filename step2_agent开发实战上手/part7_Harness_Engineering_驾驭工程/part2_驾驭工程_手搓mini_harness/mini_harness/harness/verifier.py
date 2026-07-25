"""
Verification Loop support.

机制：⑥ Verification Loop
救死因：④ tool 错误吞（下游）
官方出处：Effective Harnesses for Long-Running Agents
  "It is unacceptable to remove or edit tests."
  真机验证：Anthropic 用 Puppeteer MCP，本实现用 pytest

两个层次：
1. 引导层（原版）：SYSTEM_PROMPT_WITH_VERIFICATION 让模型自我验证
2. 执行层（新增）：verify_by_pytest() 真跑 pytest 并回传结构化结果
"""

import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


# System prompt with verification guidance
SYSTEM_PROMPT_WITH_VERIFICATION = """
You are a helpful AI assistant with tool-calling capabilities.

When solving tasks:
1. Break down complex problems into steps
2. Use available tools to gather information
3. Verify your work before finalizing
4. If uncertain, use tools to double-check

Verification checklist:
- Have I gathered all necessary information?
- Are my conclusions supported by tool results?
- Should I verify any assumptions with additional tool calls?
- Is my final answer complete and accurate?

Always prioritize accuracy over speed.
"""


def get_verification_prompt() -> str:
    """
    Get system prompt with verification guidance.

    Returns:
        System prompt string
    """
    return SYSTEM_PROMPT_WITH_VERIFICATION


# ====================================================================
# 新增：真执行验证层（verify_by_pytest + verify_python_code）
# ====================================================================


def verify_by_pytest(
    test_path: str,
    cwd: Optional[str] = None,
    timeout: int = 60,
    extra_args: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    真执行 pytest 并返回结构化结果。供 Agent 作为工具调用或课件直接调用。

    Args:
        test_path: pytest 目标（可以是文件或目录）
        cwd: 工作目录，None 表示当前目录
        timeout: 执行超时（秒），默认 60
        extra_args: 追加给 pytest 的参数（如 ["-k", "test_xxx"]）

    Returns:
        {
            "passed": bool,
            "exit_code": int,
            "summary": str (如 "3 passed, 1 failed in 0.02s"),
            "stdout": str (末尾 2000 字符，避免撑爆 LLM context),
            "stderr": str (末尾 500 字符),
            "passed_count": int,
            "failed_count": int,
            "error_count": int,
        }
    """
    # --tb=short 精简回溯，--no-header 去掉 pytest 头部信息减少噪音
    cmd = ["python", "-m", "pytest", test_path, "-v", "--tb=short", "--no-header"]
    if extra_args:
        cmd.extend(extra_args)

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        stdout = proc.stdout or ""
        stderr = proc.stderr or ""
        summary = _extract_pytest_summary(stdout)
        counts = _parse_pytest_counts(summary)

        return {
            "passed": proc.returncode == 0,
            "exit_code": proc.returncode,
            "summary": summary,
            "stdout": stdout[-2000:],  # 截取末尾 2000 字符，防止擐爆 LLM context
            "stderr": stderr[-500:],   # 错误信息只保留末尾
            "passed_count": counts.get("passed", 0),
            "failed_count": counts.get("failed", 0),
            "error_count": counts.get("error", 0),
        }
    except subprocess.TimeoutExpired:
        # 超时不抛异常，返回结构化错误（Agent 可选择重试或中止）
        return {
            "passed": False,
            "exit_code": -1,
            "summary": f"TIMEOUT after {timeout}s",
            "stdout": "",
            "stderr": f"pytest timeout after {timeout}s",
            "passed_count": 0,
            "failed_count": 0,
            "error_count": 1,
        }


def verify_python_code(
    code: str,
    timeout: int = 30,
    cwd: Optional[str] = None,
) -> Dict[str, Any]:
    """
    把一段 Python 代码写到临时文件并执行，返回结构化结果。

    用途：Generator-Evaluator 场景下，Evaluator 想快速跑一下候选代码；
    或 Agent 需要验证一段生成代码是否可执行。

    Args:
        code: 要执行的 Python 代码字符串
        timeout: 执行超时（秒）
        cwd: 工作目录

    Returns:
        {
            "passed": bool,
            "exit_code": int,
            "stdout": str,
            "stderr": str,
        }
    """
    import tempfile

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        f.write(code)
        tmp_path = f.name

    try:
        proc = subprocess.run(
            ["python", tmp_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        return {
            "passed": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": (proc.stdout or "")[-2000:],
            "stderr": (proc.stderr or "")[-500:],
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Python execution timeout after {timeout}s",
        }
    finally:
        Path(tmp_path).unlink(missing_ok=True)  # 出错也确保临时文件被删除


def _extract_pytest_summary(stdout: str) -> str:
    """从 pytest 输出中提取最后一行 summary（如 '3 passed, 1 failed in 0.02s'）。"""
    if not stdout:
        return "no output"
    lines = stdout.strip().splitlines()
    # pytest 的 summary 一般在最后，形如 "=== 3 passed in 0.02s ==="
    for line in reversed(lines):
        line = line.strip()
        if "passed" in line or "failed" in line or "error" in line:
            # 去掉 === 边框
            cleaned = line.strip("= ").strip()
            if cleaned:
                return cleaned
    return lines[-1].strip() if lines else "no summary"


def _parse_pytest_counts(summary: str) -> Dict[str, int]:
    """解析 summary 行中的 passed/failed/error 数量。"""
    counts = {"passed": 0, "failed": 0, "error": 0}
    if not summary:
        return counts
    # 正则匹配："N passed" / "N failed" / "N error"三种格式
    for key in counts:
        m = re.search(rf"(\d+)\s+{key}", summary)
        if m:
            counts[key] = int(m.group(1))
    return counts
