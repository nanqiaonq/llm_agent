"""
Hook event bus for Harness framework.

机制：Hooks（Harness 的神经系统）
救死因：④ tool 错误吞 / ⑥ 没刹车 / ⑦ 没审批（通过 hook 钩子挂载 Permission/Progress/Budget）
官方出处：Claude Code 27 种 hook 事件 / OpenAI Codex Skills 系统

设计原则：
- 事件驱动：关键事件前后插入检查、记录、拦截动作
- 分两类：普通事件（trigger，不可否决）和 gate 事件（trigger_gate，可 veto）
- NoOp 默认：run_agent 未传 hooks 时使用 NoOpHooks，不影响原行为
"""

from typing import Callable, Dict, List, Tuple, Any


# 六大标准事件
EVENTS = [
    "session_start",   # 会话开始：加载 MEMORY.md / 初始化 progress.md
    "pre_iteration",   # 每轮 LLM 调用前：Budget 检查、context 压缩触发
    "post_iteration",  # 每轮 LLM 调用后：usage 统计、post-round 状态保存
    "pre_tool_use",    # 工具调用前（可 veto）：Permission Gate 挂载点
    "post_tool_use",   # 工具调用后：错误显性化、自动 lint、progress 记录
    "session_stop",    # 会话结束：final report、清理
]

# 可 veto 的事件集合（trigger_gate 只对这些事件生效）
GATE_EVENTS = {"pre_tool_use"}


class HookManager:
    """
    Hook 事件管理器。

    使用方式：
        hooks = HookManager()
        hooks.register("post_tool_use", lambda tool, args, result: print(f"{tool} done"))
        hooks.trigger("post_tool_use", "read_file", {"path": "a.txt"}, "hello")

    Veto 机制（仅限 pre_tool_use）：
        hooks.register("pre_tool_use", my_permission_check)  # 返回 (bool, str)
        ok, reason = hooks.trigger_gate("pre_tool_use", "run_bash", {"cmd": "rm -rf /"})
    """

    def __init__(self):
        self.handlers: Dict[str, List[Callable]] = {e: [] for e in EVENTS}

    def register(self, event: str, fn: Callable) -> None:
        """注册一个 handler 到指定事件。"""
        if event not in self.handlers:
            raise ValueError(f"Unknown event: {event}. Valid: {EVENTS}")
        self.handlers[event].append(fn)

    def trigger(self, event: str, *args, **kwargs) -> List[Any]:
        """
        触发普通事件，顺序调用所有 handler。
        返回所有 handler 的返回值列表（供调用方观察）。
        失败的 handler 不影响其他 handler 执行。
        """
        if event not in self.handlers:
            return []
        results = []
        for fn in self.handlers[event]:
            try:
                results.append(fn(*args, **kwargs))
            except Exception as e:
                # handler 失败不中断其他 handler（容错设计）
                results.append({"__hook_error__": str(e), "__handler__": fn.__name__})
        return results

    def trigger_gate(self, event: str, *args, **kwargs) -> Tuple[bool, str]:
        """
        触发 gate 事件（仅 pre_tool_use），任意 handler 返回 False 即 veto。
        Handler 约定返回 (ok: bool, reason: str)。

        Returns:
            (True, "ok") 如所有 handler 放行
            (False, reason) 任一 handler 否决
        """
        if event not in GATE_EVENTS:
            raise ValueError(f"Event {event} is not a gate event. Valid: {GATE_EVENTS}")
        if event not in self.handlers:
            return True, "ok"
        for fn in self.handlers[event]:
            try:
                result = fn(*args, **kwargs)
                if isinstance(result, tuple) and len(result) == 2:
                    ok, reason = result
                    if not ok:
                        return False, str(reason)
                # handler 返回非标准格式时视为放行（宽松模式，避免误拦）
            except Exception as e:
                # gate handler 失败视为 veto（严格模式，安全优先）
                return False, f"Gate handler {fn.__name__} failed: {e}"
        return True, "ok"

    def clear(self, event: str = None) -> None:
        """清空指定事件的 handler（或所有事件），主要用于测试。"""
        if event is None:
            for e in self.handlers:
                self.handlers[e] = []
        elif event in self.handlers:
            self.handlers[event] = []


class NoOpHooks:
    """
    空 hook 实现。run_agent 未传 hooks 时使用，保持向后兼容。
    零开销占位，调用方无需判断 hooks 是否存在。
    """

    def register(self, event, fn):
        pass

    def trigger(self, event, *args, **kwargs):
        return []

    def trigger_gate(self, event, *args, **kwargs):
        return True, "ok"

    def clear(self, event=None):
        pass
