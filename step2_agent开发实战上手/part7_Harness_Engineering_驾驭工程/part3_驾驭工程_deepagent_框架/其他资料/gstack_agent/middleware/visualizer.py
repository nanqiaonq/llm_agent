"""VisualizerMiddleware: 类 Claude Code 风格的实时事件输出。

设计目标（克制而有信息量）：
- 思考状态: `· thinking...`        (灰色)
- 工具调用: `→ tool(args_brief)`   (青色)
- 工具返回: `  ↳ result_snippet`   (灰色，缩进)
- 隐藏所有内部 logger 输出（在 cli.py 层做 silence）

实现：
- 用 rich Console 着色（无 rich 时退化普通 print）
- args/result 截断（避免大型 content 刷屏）
- sync + async 双版本，langgraph dev 与 cli 都能 work
"""
from __future__ import annotations

import asyncio
import threading
import time
from typing import Any, Callable, Optional

from langchain.agents.middleware import (
    AgentMiddleware,
    ModelRequest,
    ModelResponse,
    ToolCallRequest,
)
from langchain_core.messages import ToolMessage
from langgraph.types import Command

try:
    from rich.console import Console
    _DEFAULT_CONSOLE: Optional[Console] = Console()
except ImportError:
    _DEFAULT_CONSOLE = None


# task 工具默认心跳间隔（秒）— 让用户每隔 N 秒看到一次"仍在执行中"
_HEARTBEAT_INTERVAL = 10.0


def _brief_args(args: Any, limit: int = 80) -> str:
    """把 args dict 缩略成单行简短描述（截断长 content）."""
    if not args:
        return ""
    if isinstance(args, dict):
        # 优先显示 path / file_path / pattern / command 等典型字段
        for key in ("file_path", "path", "pattern", "command", "subagent_type", "name"):
            if key in args:
                v = str(args[key])
                if len(v) > limit:
                    v = v[: limit - 3] + "..."
                return f"{key}={v!r}"
        # 退化：dump 整个 dict 截断
        s = str(args)
        return s[: limit - 3] + "..." if len(s) > limit else s
    s = str(args)
    return s[: limit - 3] + "..." if len(s) > limit else s


def _brief_result(content: Any, limit: int = 100) -> str:
    """把工具返回值缩略成单行（多行 → 首行 + 行数提示）."""
    if content is None:
        return ""
    s = str(content)
    if not s.strip():
        return "<empty>"
    lines = s.splitlines()
    if len(lines) > 1:
        first = lines[0].strip()[:limit]
        return f"{first} ({len(lines)} lines)"
    return s[: limit - 3] + "..." if len(s) > limit else s


class VisualizerMiddleware(AgentMiddleware):
    """Claude Code 风格的实时事件可视化."""

    def __init__(self, console: Optional["Console"] = None):
        self._console = console if console is not None else _DEFAULT_CONSOLE
        self._call_no = 0

    # ------------------------------------------------------------
    # 内部统一打印接口：用 rich markup 着色；无 rich 时退化为 plain print
    # ------------------------------------------------------------
    def _emit(self, markup: str, plain: str) -> None:
        if self._console is not None:
            self._console.print(markup)
        else:
            print(plain)

    def _emit_think(self) -> None:
        self._emit("[dim]· thinking...[/dim]", "· thinking...")

    def _emit_tool_call(self, name: str, args: Any) -> None:
        brief = _brief_args(args)
        markup = f"[cyan]→ {name}[/cyan]" + (f" [dim]({brief})[/dim]" if brief else "")
        plain = f"→ {name}" + (f" ({brief})" if brief else "")
        self._emit(markup, plain)

    def _emit_tool_return(self, name: str, content: Any, elapsed: float) -> None:
        brief = _brief_result(content)
        # 简短：耗时不显示 0.00s 这种没意义的；超过 0.5s 才显示
        timing = f" [dim]({elapsed:.1f}s)[/dim]" if elapsed > 0.5 else ""
        markup = f"  [dim]↳[/dim] [dim]{brief}[/dim]{timing}"
        plain = f"  ↳ {brief}" + (f" ({elapsed:.1f}s)" if elapsed > 0.5 else "")
        self._emit(markup, plain)

    def _emit_tool_error(self, name: str, exc: Exception) -> None:
        markup = f"  [red]× {name}: {type(exc).__name__}[/red]"
        plain = f"  × {name}: {type(exc).__name__}"
        self._emit(markup, plain)

    # ============================================================
    # 心跳：长耗时工具（典型是 task 子代理委派）期间，每隔 N 秒打印一行
    # "仍在执行中..."，避免学员误以为程序卡死。
    # 子代理内部消息无法穿透到这里（独立 graph + 独立 middleware），
    # 所以走"外部心跳"是最稳妥、零侵入的方案。
    # ============================================================
    def _heartbeat_label(self, name: str, args: Any) -> str:
        """task 工具显示子代理名，其他工具显示工具名."""
        if name == "task" and isinstance(args, dict):
            sub = args.get("subagent_type") or args.get("name") or "subagent"
            return f"{sub}"
        return name

    def _emit_heartbeat(self, label: str, elapsed_s: int) -> None:
        markup = f"  [dim]⏳ {label} 仍在执行中... ({elapsed_s}s)[/dim]"
        plain = f"  ⏳ {label} 仍在执行中... ({elapsed_s}s)"
        self._emit(markup, plain)

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        self._call_no += 1
        self._emit_think()
        start = time.perf_counter()
        try:
            response = handler(request)
        except Exception as e:  # noqa: BLE001
            self._emit_tool_error("model", e)
            raise
        # 模型耗时不主动显示（除非超过 5s 才提示一下）
        elapsed = time.perf_counter() - start
        if elapsed > 5.0:
            self._emit(f"  [dim]({elapsed:.1f}s)[/dim]", f"  ({elapsed:.1f}s)")
        return response

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        name = request.tool_call.get("name", "?")
        args = request.tool_call.get("args", {})
        self._emit_tool_call(name, args)

        # 心跳：仅对 task（子代理委派）启动，避免对快工具产生噪音
        stop_event: Optional[threading.Event] = None
        hb_thread: Optional[threading.Thread] = None
        if name == "task":
            label = self._heartbeat_label(name, args)
            stop_event = threading.Event()

            def _beat() -> None:
                elapsed_s = 0
                while not stop_event.wait(timeout=_HEARTBEAT_INTERVAL):
                    elapsed_s += int(_HEARTBEAT_INTERVAL)
                    self._emit_heartbeat(label, elapsed_s)

            hb_thread = threading.Thread(target=_beat, daemon=True, name=f"hb-{label}")
            hb_thread.start()

        start = time.perf_counter()
        try:
            result = handler(request)
        except Exception as e:  # noqa: BLE001
            if stop_event is not None:
                stop_event.set()
            self._emit_tool_error(name, e)
            raise
        finally:
            if stop_event is not None:
                stop_event.set()

        elapsed = time.perf_counter() - start
        content = getattr(result, "content", None)
        if content is None and isinstance(result, dict):
            content = result.get("content")
        self._emit_tool_return(name, content, elapsed)
        return result

    # ============================================================
    # Async 版本（langgraph dev / ainvoke 路径）
    # ============================================================
    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Any],
    ) -> ModelResponse:
        self._call_no += 1
        self._emit_think()
        start = time.perf_counter()
        try:
            response = await handler(request)
        except Exception as e:  # noqa: BLE001
            self._emit_tool_error("model", e)
            raise
        elapsed = time.perf_counter() - start
        if elapsed > 5.0:
            self._emit(f"  [dim]({elapsed:.1f}s)[/dim]", f"  ({elapsed:.1f}s)")
        return response

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Any],
    ) -> ToolMessage | Command:
        name = request.tool_call.get("name", "?")
        args = request.tool_call.get("args", {})
        self._emit_tool_call(name, args)

        # async 心跳任务：langgraph dev / ainvoke 路径下用 asyncio.Task
        hb_task: Optional[asyncio.Task] = None
        if name == "task":
            label = self._heartbeat_label(name, args)

            async def _beat() -> None:
                elapsed_s = 0
                try:
                    while True:
                        await asyncio.sleep(_HEARTBEAT_INTERVAL)
                        elapsed_s += int(_HEARTBEAT_INTERVAL)
                        self._emit_heartbeat(label, elapsed_s)
                except asyncio.CancelledError:
                    return

            hb_task = asyncio.create_task(_beat(), name=f"hb-{label}")

        start = time.perf_counter()
        try:
            result = await handler(request)
        except Exception as e:  # noqa: BLE001
            if hb_task is not None:
                hb_task.cancel()
            self._emit_tool_error(name, e)
            raise
        finally:
            if hb_task is not None:
                hb_task.cancel()

        elapsed = time.perf_counter() - start
        content = getattr(result, "content", None)
        if content is None and isinstance(result, dict):
            content = result.get("content")
        self._emit_tool_return(name, content, elapsed)
        return result
