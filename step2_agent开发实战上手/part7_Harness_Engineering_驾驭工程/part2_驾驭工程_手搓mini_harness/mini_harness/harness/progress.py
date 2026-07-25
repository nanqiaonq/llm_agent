"""
Progress Tracking — 进度追踪

机制：③ Progress Tracking（Memory 事实层玩具版）
救死因：⑤ 状态丢失（跨 session 续传的最小基础设施）
官方出处：Effective Harnesses for Long-Running Agents (2025-11-26, Anthropic)
- 用 progress.md + git commit 跨 session 续传
- 新工人来了读日志就能接手

最小实现思路：
- 每次 tool call 后 append 一行到 progress.md
- session 开始/结束各写一次分隔线
- 通过 HookManager 挂载到 session_start / post_tool_use / session_stop
"""

import json
import datetime
from pathlib import Path
from typing import Any, Dict


class ProgressTracker:
    """
    Progress Tracking 实现，通过 hook 机制与 core.run_agent 解耦。

    使用方式：
        tracker = ProgressTracker("progress.md")
        hooks = HookManager()
        tracker.register_to(hooks)
        run_agent(goal, tools, config, hooks=hooks)
    """

    def __init__(self, path: str = "progress.md", max_content_len: int = 200):
        """
        Args:
            path: progress.md 存储路径（绝对或相对）
            max_content_len: 每条日志最多保留多少字符（避免 tool result 撑爆文件）
        """
        self.path = Path(path)
        self.max_content_len = max_content_len
        self.session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self._entry_count = 0

    def register_to(self, hooks) -> None:
        """挂载到 HookManager 的三个事件。"""
        hooks.register("session_start", self.on_session_start)
        hooks.register("post_tool_use", self.on_post_tool_use)
        hooks.register("session_stop", self.on_session_stop)

    def on_session_start(self, user_goal: str = "") -> None:
        """session 开始时写入分隔线和目标。"""
        ts = self._timestamp()
        goal_preview = self._truncate(str(user_goal), self.max_content_len)
        content = (
            f"\n---\n"
            f"## Session {self.session_id} started at {ts}\n"
            f"- goal: {goal_preview}\n"
        )
        self._append(content)

    def on_post_tool_use(
        self,
        tool_name: str = "",
        tool_args: Dict[str, Any] = None,
        result: Any = "",
    ) -> None:
        """每次 tool call 后写入一条日志。"""
        self._entry_count += 1
        ts = self._timestamp()
        args_str = self._safe_json(tool_args or {})
        result_str = self._truncate(str(result), self.max_content_len)
        content = (
            f"\n### {ts} · step {self._entry_count} · tool={tool_name}\n"
            f"- args: {self._truncate(args_str, self.max_content_len)}\n"
            f"- result: {result_str}\n"
        )
        self._append(content)

    def on_session_stop(
        self,
        answer: Any = "",
        metrics: Dict[str, Any] = None,
    ) -> None:
        """session 结束时写入总结。"""
        ts = self._timestamp()
        metrics = metrics or {}
        answer_preview = self._truncate(str(answer), self.max_content_len)
        content = (
            f"\n## Session {self.session_id} ended at {ts}\n"
            f"- steps: {metrics.get('steps', '?')}\n"
            f"- tokens: {metrics.get('tokens', '?')}\n"
            f"- errors: {len(metrics.get('errors', []))}\n"
            f"- final answer: {answer_preview}\n"
            f"---\n"
        )
        self._append(content)

    def read_recent(self, n_sessions: int = 1) -> str:
        """
        读取最近 n 个 session 的进度（供新 session 续传参考）。

        简单实现：从文件末尾倒着找 "## Session" 分隔。
        """
        if not self.path.exists():
            return ""
        full = self.path.read_text(encoding="utf-8")
        # 按 session 分割字符串切片，取最后 N 个 session
        sessions = full.split("\n## Session ")
        if len(sessions) <= 1:
            return full
        # 重新拼接 "## Session" 前缀，修复 split 切掉分隔符的问题
        recent = "\n## Session ".join(sessions[-n_sessions:])
        if not recent.startswith("## Session"):
            recent = "## Session " + recent
        return recent

    def _append(self, text: str) -> None:
        # parents=True 防止首次运行时目录不存在报错
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(text)

    def _timestamp(self) -> str:
        return datetime.datetime.now().isoformat(timespec="seconds")

    def _truncate(self, s: str, max_len: int) -> str:
        if len(s) <= max_len:
            return s
        return s[:max_len] + f"...[truncated, total {len(s)} chars]"

    def _safe_json(self, obj) -> str:
        try:
            return json.dumps(obj, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(obj)
