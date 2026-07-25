"""Tests for HookManager."""

import pytest

from harness.hooks import HookManager, NoOpHooks, EVENTS, GATE_EVENTS


def test_hooks_register_and_trigger():
    """注册的 handler 按序被调用，返回值被收集。"""
    h = HookManager()
    calls = []
    h.register("session_start", lambda goal: calls.append(("A", goal)))
    h.register("session_start", lambda goal: calls.append(("B", goal)))

    results = h.trigger("session_start", "test-goal")

    assert len(calls) == 2
    assert calls[0] == ("A", "test-goal")
    assert calls[1] == ("B", "test-goal")
    assert len(results) == 2


def test_hooks_unknown_event_raises():
    """注册未知事件名应抛 ValueError。"""
    h = HookManager()
    with pytest.raises(ValueError):
        h.register("nonexistent_event", lambda: None)


def test_hooks_trigger_handler_error_is_isolated():
    """某个 handler 抛异常不应影响其他 handler。"""
    h = HookManager()
    ran = []

    def bad_handler(*args, **kwargs):
        raise RuntimeError("oops")

    def good_handler(*args, **kwargs):
        ran.append("good")

    h.register("post_tool_use", bad_handler)
    h.register("post_tool_use", good_handler)

    results = h.trigger("post_tool_use", "tool_x", {}, "result")
    assert "good" in ran
    # First handler's result records the error
    assert "__hook_error__" in results[0]


def test_hooks_gate_pass():
    """trigger_gate：所有 handler 返回 True 时放行。"""
    h = HookManager()
    h.register("pre_tool_use", lambda tn, ta: (True, "ok"))
    h.register("pre_tool_use", lambda tn, ta: (True, "also ok"))

    ok, reason = h.trigger_gate("pre_tool_use", "run_bash", {"command": "ls"})
    assert ok is True


def test_hooks_gate_veto():
    """trigger_gate：任一 handler 返回 False 则 veto，立即返回。"""
    h = HookManager()
    call_order = []

    h.register("pre_tool_use", lambda tn, ta: call_order.append("first") or (True, "ok"))
    h.register("pre_tool_use", lambda tn, ta: call_order.append("second") or (False, "danger"))
    h.register("pre_tool_use", lambda tn, ta: call_order.append("third") or (True, "ok"))

    ok, reason = h.trigger_gate("pre_tool_use", "run_bash", {"command": "rm -rf /"})
    assert ok is False
    assert "danger" in reason
    # Third handler should not run (short-circuit after veto)
    assert call_order == ["first", "second"]


def test_hooks_gate_handler_error_is_veto():
    """gate handler 抛异常视为 veto（安全优先）。"""
    h = HookManager()
    h.register("pre_tool_use", lambda tn, ta: (_ for _ in ()).throw(RuntimeError("boom")))

    ok, reason = h.trigger_gate("pre_tool_use", "run_bash", {})
    assert ok is False
    assert "boom" in reason


def test_hooks_gate_event_only_valid_gate():
    """trigger_gate 仅允许 gate 事件（pre_tool_use）。"""
    h = HookManager()
    with pytest.raises(ValueError):
        h.trigger_gate("post_tool_use")  # 不是 gate 事件


def test_hooks_clear():
    """clear 能清空指定事件或全部事件。"""
    h = HookManager()
    h.register("session_start", lambda goal: None)
    h.register("post_tool_use", lambda t, a, r: None)
    assert len(h.handlers["session_start"]) == 1
    assert len(h.handlers["post_tool_use"]) == 1

    h.clear("session_start")
    assert len(h.handlers["session_start"]) == 0
    assert len(h.handlers["post_tool_use"]) == 1

    h.clear()
    assert len(h.handlers["post_tool_use"]) == 0


def test_noop_hooks_interface_compatible():
    """NoOpHooks 必须支持 HookManager 的全部接口（duck typing）。"""
    h = NoOpHooks()
    h.register("session_start", lambda: None)
    assert h.trigger("session_start") == []
    ok, reason = h.trigger_gate("pre_tool_use")
    assert ok is True
    h.clear()


def test_events_constant_includes_five_lifecycle_events():
    """EVENTS 常量至少包含五大生命周期事件。"""
    expected = {"session_start", "pre_iteration", "post_iteration",
                "pre_tool_use", "post_tool_use", "session_stop"}
    assert expected.issubset(set(EVENTS))


def test_pre_tool_use_is_gate_event():
    """pre_tool_use 必须是 gate 事件。"""
    assert "pre_tool_use" in GATE_EVENTS
