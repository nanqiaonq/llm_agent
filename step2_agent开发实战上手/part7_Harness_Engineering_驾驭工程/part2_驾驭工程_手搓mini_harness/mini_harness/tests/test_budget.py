"""Tests for BudgetGuard."""

import pytest

from harness.budget import BudgetGuard, BudgetExceeded
from harness.hooks import HookManager


def test_budget_initial_state():
    """初始状态 used=0，未触发。"""
    b = BudgetGuard(max_usd=1.0)
    assert b.used_in == 0
    assert b.used_out == 0
    assert b.cost() == 0.0
    assert b.tripped is False


def test_budget_add_accumulates():
    """add 累加 token 并更新成本。"""
    b = BudgetGuard(
        max_usd=10.0,
        price_per_1k_input=0.003,
        price_per_1k_output=0.012,
    )
    cost = b.add(input_tokens=1000, output_tokens=500)
    # 1000 * 0.003 / 1000 + 500 * 0.012 / 1000 = 0.003 + 0.006 = 0.009
    assert abs(cost - 0.009) < 1e-9
    assert b.used_in == 1000
    assert b.used_out == 500
    assert b.iteration_count == 1


def test_budget_raises_when_exceeded():
    """超出 max_usd 时抛 BudgetExceeded。"""
    b = BudgetGuard(
        max_usd=0.005,
        price_per_1k_input=0.003,
        price_per_1k_output=0.012,
    )
    # 第一次：0.003，在预算内
    b.add(input_tokens=1000, output_tokens=0)
    assert b.tripped is False

    # 第二次：再 + 0.006 input → 累计 0.009 > 0.005
    with pytest.raises(BudgetExceeded) as exc_info:
        b.add(input_tokens=2000, output_tokens=0)

    assert b.tripped is True
    assert "exceeded" in str(exc_info.value).lower() or "Budget" in str(exc_info.value)
    # 异常应携带 report
    assert hasattr(exc_info.value, "report")
    assert "cost_usd" in exc_info.value.report


def test_budget_remaining():
    """remaining 正确计算剩余预算。"""
    b = BudgetGuard(max_usd=1.0, price_per_1k_input=0.003, price_per_1k_output=0.012)
    b.add(input_tokens=100000, output_tokens=0)  # 0.3 usd
    assert abs(b.remaining() - 0.7) < 1e-6


def test_budget_report_structure():
    """report 返回结构化字典，课件可直接引用。"""
    b = BudgetGuard(max_usd=0.5)
    b.add(input_tokens=500, output_tokens=200)

    r = b.report()
    assert r["iterations"] == 1
    assert r["tokens_input"] == 500
    assert r["tokens_output"] == 200
    assert r["cost_usd"] >= 0
    assert r["max_usd"] == 0.5
    assert r["tripped"] is False


def test_budget_report_text_format():
    """report_text 返回可读单行字符串。"""
    b = BudgetGuard(max_usd=0.10)
    b.add(input_tokens=1000, output_tokens=500)
    text = b.report_text()
    assert "cost=" in text
    assert "max=" in text
    assert "iter=" in text


def test_budget_handles_negative_tokens():
    """负 token 应被 clip 为 0，防止恶意工具伪造 usage。"""
    b = BudgetGuard(max_usd=1.0)
    b.add(input_tokens=-100, output_tokens=-50)
    assert b.used_in == 0
    assert b.used_out == 0
    assert b.cost() == 0.0


def test_budget_hook_integration():
    """register_to 挂到 HookManager 的 session_stop 后能输出 report。"""
    b = BudgetGuard(max_usd=1.0)
    b.add(input_tokens=1000, output_tokens=500)

    hooks = HookManager()
    b.register_to(hooks)

    results = hooks.trigger("session_stop", "done", {"steps": 1})
    # Budget 的 hook 返回 budget_final
    assert any(
        isinstance(r, dict) and "budget_final" in r for r in results
    )


def test_budget_only_trips_once():
    """超限后第二次调用不再重复抛（只抛一次）。"""
    b = BudgetGuard(max_usd=0.001, price_per_1k_input=0.003)
    # 第一次直接超限
    with pytest.raises(BudgetExceeded):
        b.add(input_tokens=1000, output_tokens=0)
    assert b.tripped is True
    # 第二次：依然累加但不再抛
    b.add(input_tokens=500, output_tokens=0)
    assert b.used_in == 1500


def test_budget_iteration_count():
    """iteration_count 每次 add 递增。"""
    b = BudgetGuard(max_usd=10.0)
    for _ in range(5):
        b.add(input_tokens=100, output_tokens=50)
    assert b.iteration_count == 5
