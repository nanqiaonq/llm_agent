"""gstack-agent CLI 入口：终端交互式对话（rich + readline）。

体验目标（类 Claude Code）：
- 启动横幅展示 agent 配置（模型 / skills / 工具 / HITL）
- Enter 直接提交单行；行尾 \\ 续行；triple-double-quote 切多行模式
- 工具调用实时着色打印（VisualizerMiddleware 已挂）
- HITL 审批：捕获 __interrupt__ → rich Prompt → resume
- 退出/重置命令：/exit /quit /clear /reset /help
- Ctrl+C 取消当前输入（不退出），Ctrl+D 才退出

使用：
    python -m gstack_agent             # 启动
    python -m gstack_agent --no-hitl   # 关闭审批，全部自动通过（仅 demo）
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import warnings
from typing import Any, Optional


# ============================================================
# Quiet mode：在 import deepagents/langchain 之前先把 noisy logger 静默
# 这些库的内部 INFO/WARNING（如 SkillsMiddleware 的 "Ignoring non-string
# 'allowed-tools'") 在每次 invoke 时都会重复刷屏，对教学体验不友好。
# 仅保留 ERROR 级别（真正的错误仍会显示）。
# ============================================================
def _silence_noisy_loggers() -> None:
    for name in (
        "deepagents",
        "deepagents.middleware",
        "deepagents.middleware.skills",
        "langchain",
        "langchain_core",
        "langchain_deepseek",
        "langgraph",
        "langgraph_runtime_inmem",
        "httpx",
        "openai",
        "urllib3",
    ):
        logging.getLogger(name).setLevel(logging.ERROR)
    # warnings.warn 也压制（pydantic/pkg_resources 等的 DeprecationWarning）
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    warnings.filterwarnings("ignore", category=UserWarning)


_silence_noisy_loggers()

# readline 是 Python stdlib（macOS/Linux），import 后 input() 自动获得：
# - 上下箭头浏览历史
# - 左右箭头光标移动 / 行内编辑
# - Ctrl+A/E/K/U/W 等 emacs 风格快捷键
# 无需任何额外配置；比 prompt_toolkit 更轻量、与 PTY/管道完全兼容
import readline  # noqa: F401

from langchain_core.messages import AIMessage, RemoveMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from langgraph.types import Command
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

from gstack_agent.config import (
    HITL_ENABLED,
    LANGSMITH_ENABLED,
    MODEL,
    SUBAGENT_MODELS,
    VISUALIZER_ENABLED,
    WORKSPACE_DIR,
)


console = Console()


# ============================================================
# 启动横幅
# ============================================================
def render_banner(graph_name: str, hitl: bool) -> None:
    table = Table.grid(padding=(0, 2))
    table.add_column(justify="right", style="bold cyan")
    table.add_column()
    table.add_row("gstack-agent", "v0.1.0  ·  interactive shell")
    table.add_row("Model (main)", MODEL)
    # 子代理分布：如果全部和主代理相同，简化显示；否则列出各子代理 model
    distinct_subagent_models = set(SUBAGENT_MODELS.values()) - {MODEL}
    if not distinct_subagent_models:
        table.add_row("Subagents", "[dim](全部继承主代理 model)[/dim]")
    else:
        for sub_name, sub_model in SUBAGENT_MODELS.items():
            if sub_model != MODEL:
                table.add_row(f"  · {sub_name}", sub_model)
    table.add_row("Workspace", str(WORKSPACE_DIR))
    table.add_row("Skills", "/skills/  →  gstack/ (30+ SKILL.md)")
    table.add_row("Memory", "/memories/AGENTS.md  (cross-session)")
    table.add_row("HITL", "[green]on[/green]" if hitl else "[red]off[/red]  (--no-hitl)")
    table.add_row("Visualizer", "[green]on[/green]" if VISUALIZER_ENABLED else "[red]off[/red]")
    table.add_row("LangSmith", "[green]on[/green]" if LANGSMITH_ENABLED else "[dim]off[/dim]")
    console.print(Panel(table, title="🛠  gstack-agent", border_style="cyan"))
    console.print(
        Text(
            'Tip: Enter 提交  |  行尾 \\ 续行  |  """ 进入多行模式  |  /help 命令帮助  |  /exit 退出',
            style="dim italic",
        )
    )
    console.print()


# ============================================================
# Slash 命令处理
# ============================================================
def _handle_slash(
    cmd: str,
    *,
    thread_id_holder: list[str],
    graph_with_ckpt: Optional[Any] = None,
    session_allowlist: Optional[dict[str, set[str]]] = None,
) -> bool:
    """Return True 表示已处理（跳过本轮 invoke），False 表示不是斜杠命令."""
    if not cmd.startswith("/"):
        return False
    parts = cmd.strip().split()
    head = parts[0]
    sub = parts[1] if len(parts) >= 2 else None
    if head in ("/exit", "/quit", "/q"):
        console.print("[dim]bye 👋[/dim]")
        sys.exit(0)
    elif head in ("/help", "/h", "/?"):
        console.print(Panel(
            "/exit | /quit       退出\n"
            "/clear              清屏\n"
            "/reset              重置 thread（开新会话，丢弃当前消息历史；保留 allowlist）\n"
            "/diag               诊断当前 thread 消息状态（不修改）\n"
            "/heal               扫描并补全孤儿 tool_calls（thread 损坏时手动救援）\n"
            "/allowlist          查看会话 allowlist（[a]lways 加入的工具模式）\n"
            "/allowlist clear    清空会话 allowlist\n"
            "/help               本帮助",
            title="commands",
            border_style="dim",
        ))
    elif head == "/clear":
        os.system("clear" if os.name != "nt" else "cls")
    elif head == "/reset":
        import uuid
        thread_id_holder[0] = f"cli-{uuid.uuid4().hex[:8]}"
        console.print(f"[dim]new thread: {thread_id_holder[0]}（allowlist 保留）[/dim]")
    elif head == "/allowlist":
        if session_allowlist is None:
            console.print("[yellow](allowlist 未初始化)[/yellow]")
            return True
        if sub == "clear":
            n = sum(len(v) for v in session_allowlist.values())
            session_allowlist.clear()
            console.print(f"[green]已清空 allowlist（移除 {n} 条规则）[/green]")
        else:
            if not session_allowlist:
                console.print("[dim]allowlist 当前为空 — 在 HITL 选 [a]lways 即可加入[/dim]")
            else:
                table = Table(title="会话 allowlist", border_style="dim")
                table.add_column("工具", style="bold cyan")
                table.add_column("已允许的模式")
                for tool_name, pats in sorted(session_allowlist.items()):
                    table.add_row(tool_name, ", ".join(sorted(pats)))
                console.print(table)
    elif head == "/diag":
        if graph_with_ckpt is None:
            console.print("[yellow](graph 未初始化)[/yellow]")
            return True
        config = {"configurable": {"thread_id": thread_id_holder[0]}}
        # verbose=True 仅诊断不写回；如果 missing>0 也只是打印
        n = _heal_orphan_tool_calls(graph_with_ckpt, config, verbose=True)
        if n:
            console.print(f"[yellow](已自动补 {n} 个占位 ToolMessage)[/yellow]")
    elif head == "/heal":
        if graph_with_ckpt is None:
            console.print("[yellow](graph 未初始化)[/yellow]")
            return True
        config = {"configurable": {"thread_id": thread_id_holder[0]}}
        n = _heal_orphan_tool_calls(graph_with_ckpt, config, verbose=True)
        if n:
            console.print(f"[green]已修复 {n} 个孤儿 tool_calls，可以继续对话[/green]")
        else:
            console.print("[dim]当前 state 无孤儿 tool_calls[/dim]")
    else:
        console.print(f"[red]unknown command: {head}[/red]  (/help)")
    return True


# ============================================================
# Session-level allowlist（Claude Code 风格"approve once"→"always allow"）
# ============================================================
# 当用户对一次 tool_call 选 [a]lways 时，把该 tool 的"语义模式"（command 头 / 目录前缀
# / subagent_type 等）记入会话级 allowlist，后续相同模式自动 approve 不再打扰。
# 重启 CLI / 选 /allowlist clear 才清空——/reset 只重 thread 不动 allowlist。
#
# 危险命令 deny-list：rm / sudo / dd / kill / chmod 等永远禁止加入 allowlist，
# 即使用户选 [a]lways 也只 approve 当次。这是安全兜底。

# 永远禁止加入 allowlist 的 shell 命令头（哪怕用户选 always 也只生效本次）
_DANGEROUS_SHELL_HEADS: frozenset[str] = frozenset({
    "rm", "rmdir", "dd", "mkfs", "fdisk", "format",
    "sudo", "su", "doas",
    "kill", "killall", "pkill",
    "shutdown", "reboot", "halt", "poweroff",
    "chmod", "chown", "chgrp",
    # git 不全黑名单（git status/diff 安全），但 git push/reset 危险——保守起见整体不入 allowlist
    "git",
})


def _allowlist_pattern(tool_name: str, args: dict) -> Optional[str]:
    """从 tool_call args 抽取 allowlist 模式 key.

    返回 None 表示该工具不允许加入 allowlist（要么高风险，要么没有合适的语义模式）。
    返回 str 即为该 tool_call 在 allowlist 中的匹配 key。
    """
    if tool_name == "shell_exec":
        cmd = str(args.get("command") or "").strip()
        if not cmd:
            return None
        words = cmd.split()
        head = words[0]
        if head in _DANGEROUS_SHELL_HEADS:
            return None  # 危险命令永不入 allowlist
        # 取前两个 token：区分 `python3 -m` / `python3 setup.py` / `npm run` / `ls -la`
        if len(words) >= 2:
            return f"{head} {words[1]}"
        return head
    if tool_name in ("write_file", "edit_file"):
        path = str(args.get("file_path") or args.get("path") or "")
        if not path:
            return None
        # 用目录前缀做模式：approve 一次 /workspace/foo.html，
        # 同目录下其他 .html 也免问；但跨目录仍要审批
        from pathlib import PurePosixPath
        return str(PurePosixPath(path).parent).rstrip("/") + "/"
    if tool_name == "read_file":
        path = str(args.get("file_path") or args.get("path") or "")
        if not path:
            return None
        from pathlib import PurePosixPath
        return str(PurePosixPath(path).parent).rstrip("/") + "/"
    if tool_name == "task":
        # subagent 委派：按 subagent_type 模式 allowlist（如 always allow designer）
        st = args.get("subagent_type")
        return f"subagent:{st}" if st else None
    return None  # 其他工具默认不进 allowlist


def _matches_allowlist(
    tool_name: str,
    args: dict,
    allowlist: dict[str, set[str]],
) -> bool:
    """检查 tool_call 是否命中会话 allowlist.

    修复 v2:
      1. 层级前缀匹配：allowlist 中已有 "/"，则 "/workspace/" 也命中
         （解决跨目录重复审批问题）
      2. write_file / edit_file / read_file 共享 allowlist 命名空间
         （按 a 允许 write_file 后，edit_file / read_file 同目录也免问）
    """
    pat = _allowlist_pattern(tool_name, args)
    if pat is None:
        return False

    # 文件操作三工具共享 allowlist key
    file_op_keys = {"write_file", "edit_file", "read_file"}
    keys_to_check = {tool_name}
    if tool_name in file_op_keys:
        keys_to_check = file_op_keys

    for key in keys_to_check:
        allowed_pats = allowlist.get(key, set())
        # 精确匹配
        if pat in allowed_pats:
            return True
        # 层级前缀匹配：已有父目录模式则子目录也命中
        # 例如 allowlist 里有 "/"，则 "/workspace/" 也匹配
        for allowed in allowed_pats:
            if allowed.endswith("/") and pat.startswith(allowed):
                return True
    return False


def _add_to_allowlist(
    tool_name: str,
    args: dict,
    allowlist: dict[str, set[str]],
) -> Optional[str]:
    """把 tool_call 加入 allowlist；返回加入的模式 key 或 None（高风险拒绝）."""
    pat = _allowlist_pattern(tool_name, args)
    if pat is None:
        return None
    # 文件操作三工具共享同一个 allowlist 集合
    file_op_keys = {"write_file", "edit_file", "read_file"}
    if tool_name in file_op_keys:
        for key in file_op_keys:
            allowlist.setdefault(key, set()).add(pat)
    else:
        allowlist.setdefault(tool_name, set()).add(pat)
    return pat


# ============================================================
# HITL 审批 prompt（纯 input()，避免 rich Prompt 把 [a] 当 markup）
# ============================================================
def _ask_human(
    action_requests: list[dict],
    review_configs: list[dict],
    session_allowlist: Optional[dict[str, set[str]]] = None,
) -> list[dict]:
    """逐个 action_request 问用户决策，返回 decisions list.

    UI 设计：rich Panel 展示待审批信息 + 纯 input() 接收选择，
    避免 rich Prompt 在 [a]pprove 这种格式上把方括号当 markup 解析。
    """
    decisions = []
    if session_allowlist is None:
        session_allowlist = {}

    for i, action in enumerate(action_requests):
        name = action.get("name", "?")
        args = action.get("args", {})
        review_cfg = review_configs[i] if i < len(review_configs) else {}
        allowed = review_cfg.get("allowed_decisions", ["approve", "reject"])

        # ---- 0. allowlist 自动 approve（Claude Code 风格 "always allow this kind"） ----
        # 用户之前对同类请求选过 [a]lways → 现在自动通过，不弹 prompt
        if _matches_allowlist(name, args, session_allowlist):
            pat = _allowlist_pattern(name, args)
            console.print(f"[dim]✓ {name}({pat}) [bold]allowlisted[/bold] — 自动通过[/dim]")
            decisions.append({"type": "approve"})
            continue

        # ---- 1. 渲染待审批面板 ----
        body = Table.grid(padding=(0, 1))
        body.add_column(style="bold yellow")
        body.add_column()
        body.add_row("工具", name)
        args_str = str(args)
        if len(args_str) > 400:
            args_str = args_str[:400] + " ..."
        body.add_row("参数", args_str)
        # 把 allowed 翻译成中文
        allowed_zh = {
            "approve": "同意 (yes)",
            "reject": "拒绝 (no)",
            "edit": "改参数后执行 (edit)",
        }
        allowed_display = "  /  ".join(allowed_zh.get(a, a) for a in allowed)
        body.add_row("可选操作", allowed_display)
        # 如果该工具支持 allowlist，提示 [a]lways 选项的语义
        always_pat = _allowlist_pattern(name, args)
        if always_pat is not None and "approve" in allowed:
            body.add_row("[a]lways", f"对 [bold]{name}({always_pat})[/bold] 模式本次会话不再询问")
        elif "approve" in allowed and always_pat is None and name == "shell_exec":
            # 危险命令解释一下为什么没 [a] 选项
            body.add_row("[a]lways", "[red]本命令属于危险类，不允许加入 allowlist[/red]")
        console.print(Panel(body, title="⏸  人类审批 / HITL approval", border_style="yellow"))

        # ---- 2. 构造选项菜单 ----
        # 关键变更：拆 "y"（仅此一次）/ "a"（always 加入 allowlist）两个语义
        valid_inputs = {
            # → approve once（仅此一次）
            "y": "approve", "yes": "approve", "approve": "approve", "1": "approve",
            # → approve and add to allowlist（同类不再问）
            "a": "always", "always": "always", "all": "always",
            # → reject
            "n": "reject", "no": "reject", "r": "reject", "reject": "reject", "2": "reject",
            # → edit
            "e": "edit", "edit": "edit", "3": "edit",
            # → quit
            "q": "quit", "quit": "quit", "exit": "quit", "0": "quit",
        }

        # 显示选项菜单
        menu_lines = []
        if "approve" in allowed:
            menu_lines.append("  [bold green]y[/bold green]  yes      仅此一次同意")
            if always_pat is not None:
                menu_lines.append(
                    "  [bold green]a[/bold green]  always   同意，并对同类命令本次会话不再询问"
                )
        if "reject" in allowed:
            menu_lines.append("  [bold red]n[/bold red]  no       拒绝执行")
        if "edit" in allowed:
            menu_lines.append("  [bold cyan]e[/bold cyan]  edit     修改参数后执行")
        menu_lines.append("  [bold]q[/bold]  quit     退出 CLI")
        console.print("请选择操作：")
        for ln in menu_lines:
            console.print(ln)

        # ---- 3. 读取用户输入 ----
        decision_type: Optional[str] = None
        while decision_type is None:
            try:
                raw = input("> ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                console.print("\n[red]已取消（Ctrl+C）[/red]")
                sys.exit(1)

            if not raw:
                # 空输入默认 approve（与 yes/同意 一致）
                if "approve" in allowed:
                    decision_type = "approve"
                    break
                console.print("[yellow]请输入 y / n / e / q 中的一个[/yellow]")
                continue

            mapped = valid_inputs.get(raw)
            if mapped is None:
                console.print(f"[yellow]无法识别：'{raw}' — 请输入 y / n / e / q[/yellow]")
                continue
            if mapped not in allowed and mapped != "quit":
                console.print(f"[yellow]'{mapped}' 当前不允许（可选：{', '.join(allowed)}）[/yellow]")
                continue
            decision_type = mapped

        # ---- 4. 处理决策 ----
        if decision_type == "quit":
            console.print("[red]已退出 CLI[/red]")
            sys.exit(0)

        if decision_type == "edit":
            console.print("[dim]请输入新的参数（Python dict 字面量，例如 {\"path\": \"/foo\"})；按 Enter 保持原参数：[/dim]")
            try:
                new_args_text = input("新参数 > ").strip()
            except (EOFError, KeyboardInterrupt):
                new_args_text = ""
            if new_args_text:
                try:
                    import ast
                    new_args = ast.literal_eval(new_args_text)
                    decisions.append({"type": "edit", "args": new_args})
                    console.print(f"[dim]已用新参数继续：{new_args}[/dim]")
                    continue
                except Exception as e:  # noqa: BLE001
                    console.print(f"[red]参数解析失败：{e}；改为 approve 继续[/red]")
            decisions.append({"type": "approve"})

        elif decision_type == "reject":
            try:
                reason = input("拒绝原因（可留空） > ").strip()
            except (EOFError, KeyboardInterrupt):
                reason = ""
            if not reason:
                reason = "user rejected"
            decisions.append({"type": "reject", "message": reason})
            console.print(f"[dim]已拒绝：{reason}[/dim]")

        elif decision_type == "always":
            # approve 当次 + 把模式加入会话 allowlist
            added = _add_to_allowlist(name, args, session_allowlist)
            decisions.append({"type": "approve"})
            if added is not None:
                console.print(
                    f"[dim]已同意 + 已加入 allowlist：[bold]{name}({added})[/bold] "
                    f"本次会话同类不再询问[/dim]"
                )
            else:
                # 危险命令：always 退化为 once
                console.print(
                    f"[yellow]已同意（{name} 属于危险类，本次仅一次，未加入 allowlist）[/yellow]"
                )

        else:  # approve once
            decisions.append({"type": "approve"})
            console.print("[dim]已同意执行（仅此一次）[/dim]")

    return decisions


# ============================================================
# 主对话循环
# ============================================================
def _read_input() -> str:
    """读一行 / 多行输入。

    支持三种输入模式（自动检测，无需用户切换）：
    1. 单行 Enter 提交（最常见）
    2. 多行粘贴自动合并：粘贴长 prompt 时，input() 只读第一行，剩余行残留在
       stdin buffer。我们用 select 检测 buffer 是否还有立即可读数据，把
       同一个粘贴块内的所有行收拢成一次输入（关键修复）
    3. 显式多行模式：行尾 `\\` 续行 / triple-double-quote 包裹

    说明 stdin select：粘贴粘的所有字节会瞬间到达 buffer，select 持续返回
    可读；用户手动按 Enter 后 buffer 是空的，select 立即超时返回。所以这种
    机制能区分"粘贴多行"和"用户敲完一行"。
    """
    import select

    first = input(">>> ").rstrip("\r\n")

    # ---- 模式 1：检测多行粘贴（关键修复）----
    # 粘贴块内所有行会瞬间在 stdin buffer 里；用 select 50ms 超时探测
    # 是否还有立即可读数据。手动敲一行 Enter 时 buffer 立即空，select 立即返回 []
    #
    # 关键：续读必须用 sys.stdin.readline() 而不是 input("")
    # 原因：input() 会触发 readline 模块的行编辑功能，把读到的每一行
    # 重新 echo 到 stdout，造成"粘贴内容重复回显多次"的混乱效果
    extra_lines: list[str] = []
    if sys.stdin.isatty():
        while select.select([sys.stdin], [], [], 0.05)[0]:
            line = sys.stdin.readline()
            if not line:   # EOF
                break
            extra_lines.append(line.rstrip("\r\n"))
    if extra_lines:
        # 多行粘贴：合成一段（保留换行）+ 友好提示
        all_lines = [first] + extra_lines
        # 去掉末尾连续空行
        while all_lines and not all_lines[-1].strip():
            all_lines.pop()
        merged = "\n".join(all_lines).strip()
        if merged:
            print(f"[已识别多行粘贴：{len(all_lines)} 行 / {len(merged)} 字符]", file=sys.stderr)
        return merged

    # ---- 模式 2：行尾反斜杠续行（显式多行）----
    if first.endswith("\\"):
        lines = [first[:-1]]
        while True:
            cont = input("... ").rstrip("\r\n")
            if cont.endswith("\\"):
                lines.append(cont[:-1])
            else:
                lines.append(cont)
                break
        return "\n".join(lines).strip()

    # ---- 模式 3：triple-double-quote 包裹（显式多行）----
    if first == '"""':
        lines: list[str] = []
        while True:
            cont = input("... ")
            if cont.rstrip("\r\n") == '"""':
                break
            lines.append(cont)
        return "\n".join(lines).strip()

    # ---- 单行 ----
    return first.strip()


def _msg_kind(m: Any) -> str:
    """统一识别 message 类型（兼容 LangChain 对象 / dict / AIMessageChunk）.

    返回 'ai' / 'tool' / 'human' / 'system' / 'unknown'。
    用 .type 属性 + dict.role / dict.type 兼容多种序列化形态。

    关键修复：流式生成会产生 AIMessageChunk，其 .type='aimessagechunk' 而非 'ai'，
    导致前一版 heal 漏判孤儿；这里把所有 *messagechunk 后缀 / *message 前缀的
    chunk 类型都归一到对应基础类型。
    """
    t = getattr(m, "type", None)
    if t:
        t = str(t).lower()
    elif isinstance(m, dict):
        t = str(m.get("type") or m.get("role") or "unknown").lower()
    else:
        return "unknown"

    # 归一化：AIMessageChunk → ai, ToolMessageChunk → tool, etc.
    if t.startswith("ai"):
        return "ai"
    if t.startswith("tool"):
        return "tool"
    if t.startswith("human") or t == "user":
        return "human"
    if t.startswith("system"):
        return "system"
    return t or "unknown"


def _msg_tool_calls(m: Any) -> list:
    """从 message 中抽取 tool_calls（兼容对象 / dict / additional_kwargs）."""
    tcs = getattr(m, "tool_calls", None)
    if tcs:
        return list(tcs)
    # 旧版本 LangChain 把 tool_calls 放在 additional_kwargs
    ak = getattr(m, "additional_kwargs", None)
    if isinstance(ak, dict):
        ak_tcs = ak.get("tool_calls")
        if ak_tcs:
            return list(ak_tcs)
    if isinstance(m, dict):
        return list(m.get("tool_calls") or m.get("additional_kwargs", {}).get("tool_calls") or [])
    return []


def _msg_tool_call_id(m: Any) -> Optional[str]:
    """从 ToolMessage 抽取 tool_call_id（兼容对象 / dict）."""
    tc_id = getattr(m, "tool_call_id", None)
    if tc_id:
        return str(tc_id)
    if isinstance(m, dict):
        v = m.get("tool_call_id")
        if v:
            return str(v)
    return None


def _is_seq_compliant(msgs: list) -> bool:
    """检查消息序列是否符合 OpenAI/DeepSeek 硬约束。

    约束（顺序敏感，FIFO）：
      - 每条 AI(tool_calls=[A,B,C]) 必须紧跟 Tool(A), Tool(B), Tool(C)
        且顺序**不能颠倒**
      - Tool 消息不能出现在没有 pending tool_calls 时（孤立 ToolMessage）
    """
    pending: list[str] = []  # FIFO 队列：未配对的 tool_call_ids
    for m in msgs:
        kind = _msg_kind(m)
        if pending:
            # 还有未配对的 tool_calls，下一条必须是匹配且按声明顺序的 ToolMessage
            if kind != "tool":
                return False
            tc_id = _msg_tool_call_id(m)
            if tc_id != pending[0]:
                return False  # 顺序不匹配（如期望 A 但收到 B）
            pending.pop(0)
        else:
            # 没有 pending：Tool 消息不应出现在这里（孤立 ToolMessage）
            if kind == "tool":
                return False
        if kind == "ai":
            for tc in _msg_tool_calls(m):
                tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                if tc_id:
                    pending.append(str(tc_id))
    return not pending


def _heal_orphan_tool_calls(graph_with_ckpt, config: dict, *, verbose: bool = False) -> int:
    """检查并重建合规消息序列，返回修复的孤儿数。

    背景：DeepSeek/OpenAI Chat Completion 硬约束 — 每条 AI(tool_calls=[A,B,C])
    必须紧跟匹配的 ToolMessage(A), ToolMessage(B), ToolMessage(C)，才能继续
    Human/AI 消息。如果上轮 subagent 异常 / 流中断 / tool 未返回，state 会出现
    AI(tool_calls) 后面没有对应 ToolMessage 的孤儿，下一轮 invoke 直接 400 报死。

    **关键修复（v2）**：上一版用 `update_state({"messages": [Tool(X)]})` 想补
    占位，但 add_messages reducer 的语义是「按 ID 匹配则替换，否则追加到末尾」。
    Tool(X) 没有匹配 ID → 被追加到 messages 末尾，并不是插入到 AI(tool_calls)
    后面的正确位置。结果：heal 报告"已修复 N 个"但 API 仍然 400，因为序列依然不合规。

    新策略：
      1. 扫描全量消息，按 tool_call_id 索引现存的 ToolMessage
      2. 重建合规序列：每个 AI(tool_calls) 后立即跟其配对的 Tool（缺失则填占位）
      3. 用 `RemoveMessage(REMOVE_ALL_MESSAGES) + 新序列` 覆写整个 state
         — 这是 LangGraph 唯一能 "重排消息顺序" 的官方机制（add_messages 不支持插入）

    幂等：重建后再调用一次会得到相同结果（compliant check 直接返回 0）。

    兼容性：LangChain 1.2 的 message 可能是 AIMessage / AIMessageChunk / dict
    多种形态；用 .type / .role 字段统一识别（见 `_msg_kind`）。
    """
    try:
        snap = graph_with_ckpt.get_state(config)
    except Exception:  # noqa: BLE001
        return 0
    if not snap or not getattr(snap, "values", None):
        return 0
    msgs = snap.values.get("messages", []) or []
    if not msgs:
        return 0

    # ---- 早期返回：序列已合规 ----
    type_counter: dict[str, int] = {}
    for m in msgs:
        k = _msg_kind(m)
        type_counter[k] = type_counter.get(k, 0) + 1
    if _is_seq_compliant(msgs):
        if verbose:
            console.print(
                f"[dim](state diag: {len(msgs)} msgs, kinds={type_counter}, "
                f"compliant=yes, no rebuild needed)[/dim]"
            )
        return 0

    # ---- 重建合规序列 ----
    # Step 1: 收集所有现存 ToolMessage（按 tool_call_id 索引；保留首个）
    tool_msg_by_id: dict[str, Any] = {}
    for m in msgs:
        if _msg_kind(m) == "tool":
            tc_id = _msg_tool_call_id(m)
            if tc_id and tc_id not in tool_msg_by_id:
                tool_msg_by_id[tc_id] = m

    # Step 1b: 检测重复 tool_call_id（同一 id 在不同 AI 中出现）— verbose 报警
    all_tc_ids: list[str] = []
    for m in msgs:
        if _msg_kind(m) == "ai":
            for tc in _msg_tool_calls(m):
                tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                if tc_id:
                    all_tc_ids.append(str(tc_id))
    seen = set()
    dupes = {tc_id for tc_id in all_tc_ids if tc_id in seen or seen.add(tc_id)}
    dupes_warning = f" dupes={sorted(dupes)}" if dupes else ""

    # Step 2: 重建：保留所有非 Tool 消息原顺序；每个 AI(tool_calls) 后立即按
    # 声明顺序插入对应 ToolMessage（FIFO）。若 id 被多个 AI 声明，只给第一个 AI
    # 匹配，后续 AI 用占位——避免复用同一个 ToolMessage 到错误位置。
    healed_count = 0
    new_msgs: list = []
    used_tool_ids: set[str] = set()
    for m in msgs:
        kind = _msg_kind(m)
        if kind == "tool":
            continue  # 丢弃原位置的 Tool 消息，后面按需重新插入
        new_msgs.append(m)
        if kind == "ai":
            for tc in _msg_tool_calls(m):
                tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                if not tc_id:
                    continue
                tc_id = str(tc_id)
                # 只在尚未被使用时才复用原 ToolMessage；已用过 → 占位
                # 防止重复 id 把正确的 ToolMessage 塞给错误位置
                if tc_id in tool_msg_by_id and tc_id not in used_tool_ids:
                    new_msgs.append(tool_msg_by_id[tc_id])
                    used_tool_ids.add(tc_id)
                else:
                    new_msgs.append(ToolMessage(
                        tool_call_id=tc_id,
                        content="<aborted: previous turn did not produce a tool result for this call>",
                        name="aborted",
                    ))
                    healed_count += 1

    # 孤立 ToolMessage：在 tool_msg_by_id 中但没被任何 AI 声明 → 丢弃
    orphan_tool_count = len(tool_msg_by_id) - len(used_tool_ids)

    if verbose:
        console.print(
            f"[dim](state diag: {len(msgs)} msgs, kinds={type_counter}, "
            f"missing_tools={healed_count}, dropped_orphan_tools={orphan_tool_count}"
            f"{dupes_warning}, rebuilding...)[/dim]"
        )

    # Step 3: 用 REMOVE_ALL_MESSAGES + 新序列覆写
    try:
        graph_with_ckpt.update_state(
            config,
            {"messages": [RemoveMessage(id=REMOVE_ALL_MESSAGES)] + new_msgs}
        )
    except Exception as e:  # noqa: BLE001
        console.print(f"[yellow](自愈写回失败：{type(e).__name__}: {e})[/yellow]")
        return 0
    return healed_count + orphan_tool_count


def _stream_invoke(
    graph_with_ckpt,
    payload: Any,
    config: dict,
    session_allowlist: Optional[dict[str, set[str]]] = None,
) -> Optional[Any]:
    """跑一轮 invoke，返回 final state（dict）或 None（被中断）.

    finally 兜底：流被异常中断时（KeyboardInterrupt / 网络抖 / 子代理崩 /
    LLM 返 finish_reason=stop 但 state 已 commit AI(tool_calls)）会留下孤儿
    tool_call。这里在退出前主动 heal 一次，确保下一轮 invoke 的 state 已合规，
    用户不需要看到 BadRequestError 才知道损坏。
    """
    final_state: Optional[dict] = None
    interrupt_chunk: Optional[dict] = None

    try:
        for chunk in graph_with_ckpt.stream(payload, config=config, stream_mode="values"):
            # 流式拿到中间 state；最后一个非 __interrupt__ chunk 即为终态
            if "__interrupt__" in chunk:
                interrupt_chunk = chunk
                break
            final_state = chunk

        if interrupt_chunk is not None:
            # 解析 interrupt — 它是 list[Interrupt]
            interrupts = interrupt_chunk["__interrupt__"]
            first = interrupts[0]
            hitl_value = first.value if hasattr(first, "value") else first.get("value", {})
            action_requests = hitl_value.get("action_requests", [])
            review_configs = hitl_value.get("review_configs", [])
            decisions = _ask_human(action_requests, review_configs, session_allowlist)
            # 用 Command(resume=...) 恢复执行（递归处理可能的多轮中断）
            return _stream_invoke(
                graph_with_ckpt,
                Command(resume={"decisions": decisions}),
                config,
                session_allowlist,
            )

        return final_state
    finally:
        # 流退出（正常 / 异常 / 中断）后做一次预防性 heal — 不让孤儿 tool_call
        # 留到下一轮 invoke 才被发现。silent 不打扰用户（除非真的发现孤儿）
        try:
            n = _heal_orphan_tool_calls(graph_with_ckpt, config, verbose=False)
            if n:
                console.print(
                    f"[dim](post-stream heal: 已重建消息序列并补 {n} 个占位 ToolMessage)[/dim]"
                )
        except Exception:  # noqa: BLE001
            pass  # finally 不应抛异常掩盖原始错误


def _print_final(state: Optional[dict]) -> None:
    if not state:
        console.print("[dim]<empty state>[/dim]")
        return
    msgs = state.get("messages", []) if isinstance(state, dict) else []
    last_ai = None
    for m in reversed(msgs):
        kind = getattr(m, "type", None) or (m.get("role") if isinstance(m, dict) else None)
        content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else None)
        if kind == "ai" and content:
            last_ai = m
            break
    if not last_ai:
        console.print("[dim]<no ai response>[/dim]")
        return
    text = getattr(last_ai, "content", None) or last_ai.get("content", "")
    console.print()
    console.print(Panel(Markdown(text), title="🤖 gstack-agent", border_style="green"))


def main() -> None:
    parser = argparse.ArgumentParser(prog="gstack-agent")
    parser.add_argument("--no-hitl", action="store_true", help="禁用 HITL 审批（仅 demo 用）")
    parser.add_argument("--no-viz", action="store_true", help="禁用 visualizer middleware 实时打印")
    args = parser.parse_args()

    # CLI 参数覆盖环境变量（必须在 import agent 之前设置）
    if args.no_hitl:
        os.environ["GSTACK_AGENT_HITL"] = "0"
    if args.no_viz:
        os.environ["GSTACK_AGENT_VISUALIZER"] = "0"

    # 延迟 import 让上面的 env vars 生效
    from gstack_agent.agent import build_graph

    # CLI 模式：用 build_graph(checkpointer=...) 构造一份**带** checkpointer 的 graph
    # 这是 HITL 真正能 work 的关键 — Command(resume=...) 必须依赖 checkpointer 找到
    # 中断时的 state 快照才能恢复执行。
    checkpointer = InMemorySaver()
    raw_graph = build_graph(checkpointer=checkpointer)

    render_banner("gstack-agent", hitl=HITL_ENABLED and not args.no_hitl)

    thread_id_holder = ["cli-default"]

    # 会话级 allowlist：用户对 HITL 选 [a]lways 后，把 tool_call 模式记进来，
    # 同类后续自动 approve。跨 /reset 保留（thread 重置但用户的"信任决定"延续），
    # 重启 CLI 才清空，或 /allowlist clear 手动清。
    session_allowlist: dict[str, set[str]] = {}

    while True:
        try:
            user_input = _read_input()
        except KeyboardInterrupt:
            # Ctrl+C：清空当前输入，回到提示符（不退出）
            console.print("[dim](按 Ctrl+C 取消输入；输入 /exit 退出)[/dim]")
            continue
        except EOFError:
            # Ctrl+D：才真正退出
            console.print("\n[dim]bye 👋[/dim]")
            break

        if not user_input:
            continue

        if _handle_slash(
            user_input,
            thread_id_holder=thread_id_holder,
            graph_with_ckpt=raw_graph,
            session_allowlist=session_allowlist,
        ):
            continue

        config = {"configurable": {"thread_id": thread_id_holder[0]}}
        payload = {"messages": [{"role": "user", "content": user_input}]}

        # 每轮 invoke 之前先做消息序列健康检查（详见 _heal_orphan_tool_calls 注释）
        # 这是防御性措施：上一轮可能因 stream 提前结束留下孤儿 tool_calls，
        # 不修则 DeepSeek 直接 400 BadRequestError 报死
        healed = _heal_orphan_tool_calls(raw_graph, config)
        if healed:
            console.print(f"[dim](已修复 {healed} 个未完成的工具调用，继续...)[/dim]")

        try:
            final_state = _stream_invoke(raw_graph, payload, config, session_allowlist)
            _print_final(final_state)
        except Exception as e:  # noqa: BLE001
            err_str = str(e)
            err_name = type(e).__name__
            console.print(f"[red]error: {err_name}: {err_str[:300]}[/red]")

            # --- 智能诊断 + 引导 ---
            # BadRequestError 含 "tool_calls"/"tool messages" 字眼 = 经典消息序列损坏
            # 这种通常是 SummarizationMiddleware 在 LLM 调用前 truncate 历史时把
            # tool_call ↔ tool_response 配对弄断，state 本身是健康的，下一轮还会再撞
            # → 唯一稳妥出路是开新 thread
            is_msg_seq_corruption = (
                err_name == "BadRequestError"
                and "tool_calls" in err_str
                and "tool messages" in err_str
            )

            if is_msg_seq_corruption:
                # 主动 heal 一把（带诊断），看 state 里到底有几个孤儿
                console.print()
                console.print("[dim]→ 正在诊断 state 并尝试自动修复...[/dim]")
                healed_after = _heal_orphan_tool_calls(raw_graph, config, verbose=True)

                if healed_after > 0:
                    console.print(Panel(
                        f"[green]✓ 已自动补 {healed_after} 个占位 ToolMessage[/green]\n"
                        f"[dim]孤儿来源：上一轮 subagent 中断 / task 工具未返回 / 流式截断[/dim]\n\n"
                        f"现在可以[bold]直接继续输入[/bold]——下次 invoke 时消息序列已健康。",
                        title="✓ 自愈成功",
                        border_style="green",
                    ))
                else:
                    # state 是健康的但还报错：要么是 SummarizationMiddleware 切片漏 case，
                    # 要么是别的边界情况。这种情况下确实只能 reset
                    console.print(Panel(
                        "[yellow]state 本身是健康的，但 LLM 调用前消息序列被弄断[/yellow]\n\n"
                        "[bold]最可能原因[/bold]：DeepAgents 内置 SummarizationMiddleware 在某种\n"
                        "    边界情况下切分消息时把 AI/Tool 配对弄断了（langchain 1.2 的\n"
                        "    `_find_safe_cutoff_point` 不兼容当前消息形态）。\n"
                        "    这种 truncate 是 invoke 内临时的，无法通过 state 修复。\n\n"
                        "[bold cyan]/reset[/bold cyan]  开新会话（推荐）\n"
                        "[bold cyan]/diag[/bold cyan]   再次诊断 state\n\n"
                        "[dim]上一轮工作产物（已写入 workspace 的文件）依然保留[/dim]",
                        title="⚠ thread 已损坏",
                        border_style="yellow",
                    ))
            else:
                # 非消息序列错误（network/auth/rate limit 等）
                healed_after = _heal_orphan_tool_calls(raw_graph, config)
                if healed_after:
                    console.print(
                        f"[dim](已修复 {healed_after} 个孤儿 tool_calls，"
                        f"继续输入即可恢复)[/dim]"
                    )
                else:
                    import traceback
                    console.print(f"[dim]{traceback.format_exc()}[/dim]")


if __name__ == "__main__":
    main()
