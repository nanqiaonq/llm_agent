"""Integration tests: core + hooks + budget 三者联动。

验证新增的 hooks 和 budget 参数在 run_agent 中的端到端行为，
全部使用 mock OpenAI 避免真实 API 调用。
"""

import json
from unittest.mock import Mock, patch

from harness.config import HarnessConfig
from harness.core import run_agent
from harness.hooks import HookManager
from harness.budget import BudgetGuard, BudgetExceeded
from harness.permission import PermissionGate
from harness.progress import ProgressTracker


def _mock_response(content: str = "", tool_calls=None, prompt_tokens: int = 100, completion_tokens: int = 50):
    """构造一个带 usage 的 mock OpenAI response。"""
    resp = Mock()
    choice = Mock()
    msg = Mock()
    msg.content = content
    msg.tool_calls = tool_calls
    choice.message = msg
    resp.choices = [choice]

    usage = Mock()
    usage.prompt_tokens = prompt_tokens
    usage.completion_tokens = completion_tokens
    resp.usage = usage

    return resp


def _mock_tool_call(call_id: str, name: str, args: dict):
    tc = Mock()
    tc.id = call_id
    tc.function.name = name
    tc.function.arguments = json.dumps(args)
    return tc


@patch("harness.core.OpenAI")
def test_hooks_lifecycle_events_fire_in_order(mock_openai_class):
    """session_start / pre_iteration / post_iteration / session_stop 按序触发。"""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client
    mock_client.chat.completions.create.return_value = _mock_response(content="done")

    events = []
    hooks = HookManager()
    hooks.register("session_start", lambda goal: events.append(("start", goal)))
    hooks.register("pre_iteration", lambda step, msgs: events.append(("pre_iter", step)))
    hooks.register("post_iteration", lambda step, tokens: events.append(("post_iter", step, tokens)))
    hooks.register("session_stop", lambda answer, metrics: events.append(("stop", answer, metrics["steps"])))

    config = HarnessConfig(api_key="test", base_url="http://test")
    result = run_agent("goal-x", {}, config, hooks=hooks)

    # Event order
    assert events[0] == ("start", "goal-x")
    assert events[1] == ("pre_iter", 1)
    assert events[2][0] == "post_iter"
    assert events[3][0] == "stop"
    assert events[3][2] == 1  # steps=1


@patch("harness.core.OpenAI")
def test_permission_gate_blocks_dangerous_tool(mock_openai_class):
    """Permission Gate 拦截危险 tool call，agent 得到 DENIED error 而非真实执行。"""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # 轮 1: agent 发起危险 tool call
    # 轮 2: agent 收到 DENIED 后不再调 tool（给 final answer）
    tc = _mock_tool_call("c1", "run_bash", {"command": "rm -rf /"})
    mock_client.chat.completions.create.side_effect = [
        _mock_response(tool_calls=[tc]),
        _mock_response(content="放弃危险操作"),
    ]

    executed = []

    def dangerous_tool(command: str) -> str:
        """危险工具，本应被 Permission Gate 拦住。"""
        executed.append(command)
        return "executed (should not happen)"

    hooks = HookManager()
    gate = PermissionGate()
    gate.register_to(hooks)

    config = HarnessConfig(api_key="test", base_url="http://test")
    result = run_agent(
        "demo",
        {"run_bash": dangerous_tool},
        config,
        hooks=hooks,
    )

    # 验证工具没真跑
    assert len(executed) == 0
    # 验证 blocked_tools 计数
    assert result["blocked_tools"] == 1
    # 验证错误信息包含 DENIED
    assert any("PERMISSION DENIED" in e for e in result["errors"])


@patch("harness.core.OpenAI")
def test_budget_exceeds_terminates_gracefully(mock_openai_class):
    """Budget 超限时 run_agent 优雅终止，返回 budget_tripped 的报告。"""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client
    # 大 token 消耗，一轮就超限
    mock_client.chat.completions.create.return_value = _mock_response(
        content="long answer",
        prompt_tokens=100000,   # 100k input
        completion_tokens=50000,  # 50k output
    )

    budget = BudgetGuard(
        max_usd=0.10,
        price_per_1k_input=0.003,
        price_per_1k_output=0.012,
    )
    # 100k * 0.003/1k + 50k * 0.012/1k = 0.3 + 0.6 = 0.9 → 超 0.10

    config = HarnessConfig(api_key="test", base_url="http://test")
    result = run_agent("big task", {}, config, budget=budget)

    assert "BUDGET EXCEEDED" in result["answer"]
    assert result["budget_report"] is not None
    assert result["budget_report"]["tripped"] is True
    assert result["budget_report"]["cost_usd"] > 0.10


@patch("harness.core.OpenAI")
def test_progress_tracker_records_real_tool_calls(mock_openai_class, tmp_path):
    """ProgressTracker 通过 hooks 记录 tool call 到 progress.md。"""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    tc = _mock_tool_call("c1", "read_file", {"path": "test.txt"})
    mock_client.chat.completions.create.side_effect = [
        _mock_response(tool_calls=[tc]),
        _mock_response(content="读取完成"),
    ]

    def read_file(path: str) -> str:
        """读文件."""
        return f"content of {path}"

    log_path = tmp_path / "progress.md"
    tracker = ProgressTracker(str(log_path))
    hooks = HookManager()
    tracker.register_to(hooks)

    config = HarnessConfig(api_key="test", base_url="http://test")
    result = run_agent(
        "读取 test.txt",
        {"read_file": read_file},
        config,
        hooks=hooks,
    )

    assert log_path.exists()
    content = log_path.read_text(encoding="utf-8")
    # Session 生命周期
    assert "Session" in content
    assert "started" in content
    assert "ended" in content
    # Tool 调用记录
    assert "tool=read_file" in content
    assert "test.txt" in content
    # Final answer
    assert "读取完成" in content


@patch("harness.core.OpenAI")
def test_all_four_new_mechanisms_together(mock_openai_class, tmp_path):
    """综合集成：Progress + Permission + Hooks + Budget 同时生效。"""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # 第 1 轮：agent 尝试危险命令
    tc1 = _mock_tool_call("c1", "run_bash", {"command": "rm -rf /"})
    # 第 2 轮：agent 被拦后，做安全读文件
    tc2 = _mock_tool_call("c2", "read_file", {"path": "a.txt"})
    # 第 3 轮：final answer
    mock_client.chat.completions.create.side_effect = [
        _mock_response(tool_calls=[tc1], prompt_tokens=500, completion_tokens=200),
        _mock_response(tool_calls=[tc2], prompt_tokens=500, completion_tokens=200),
        _mock_response(content="完成", prompt_tokens=500, completion_tokens=200),
    ]

    # 四机制全开
    hooks = HookManager()
    tracker = ProgressTracker(str(tmp_path / "progress.md"))
    tracker.register_to(hooks)
    gate = PermissionGate()
    gate.register_to(hooks)
    budget = BudgetGuard(max_usd=1.0)

    tools = {
        "run_bash": lambda command: f"ran: {command}",
        "read_file": lambda path: f"content of {path}",
    }

    config = HarnessConfig(api_key="test", base_url="http://test", max_steps=10)
    result = run_agent("混合任务", tools, config, hooks=hooks, budget=budget)

    # 四个机制都有痕迹：
    # 1. Permission: blocked_tools >= 1
    assert result["blocked_tools"] >= 1
    # 2. Budget: 没超限（1 USD >> 消耗），但有 report
    assert result["budget_report"] is not None
    assert result["budget_report"]["tripped"] is False
    # 3. Progress: progress.md 有内容
    progress_content = (tmp_path / "progress.md").read_text(encoding="utf-8")
    assert "run_bash" in progress_content
    assert "read_file" in progress_content
    # 4. Hooks: 完成到 final answer
    assert "完成" in result["answer"]
