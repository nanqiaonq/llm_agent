"""
Token Budget — 预算硬保护

机制：⑪ Token Budget
救死因：⑧ 成本失控（长任务烧掉数美元而无人介入）
官方出处：Phil Schmid 2026-01 "Bitter Lesson for Harness" / OpenAI Anthropic billing API

硬保护的意义不是省钱，是让失控任务优雅停止而非无限烧。

三层 Budget 架构：
- Per-result cap：单次工具结果 / 模型输出的 token 上限（本实现不强制，由工具自行限制）
- Iteration budget：父子叠加的最大轮次（Subagents 章节的 max_iterations 已覆盖）
- --max-budget-usd：整个任务的美元硬上限（本模块核心）

与 core 集成：
- run_agent 每次 LLM 调用拿到 response.usage 后调用 budget.add(prompt_tokens, completion_tokens)
- 超限抛 BudgetExceeded，run_agent 捕获后优雅终止并返回成本报告
"""

from typing import Any, Dict, Optional


class BudgetExceeded(Exception):
    """超出预算时抛出。"""

    def __init__(self, message: str, report: Dict[str, Any] = None):
        super().__init__(message)
        self.report = report or {}


class BudgetGuard:
    """
    Token 预算守卫。

    默认定价参考 gpt-4.1 官方公开定价：
    - input: $0.002 / 1K tokens
    - output: $0.008 / 1K tokens
    # 定价源: https://openai.com/api/pricing/ (2026-04)

    使用方式：
        budget = BudgetGuard(max_usd=0.10)
        run_agent(goal, tools, config, budget=budget)
        # 触及阈值 agent 自动终止，返回成本报告
    """

    def __init__(
        self,
        max_usd: float = 1.0,
        # 定价源: https://openai.com/api/pricing/ (2026-04)
        price_per_1k_input: float = 0.002,
        price_per_1k_output: float = 0.008,
    ):
        """
        Args:
            max_usd: 预算硬上限（美元）
            price_per_1k_input: 每千 input token 价格
            price_per_1k_output: 每千 output token 价格
        """
        self.max_usd = float(max_usd)
        self.price_per_1k_input = float(price_per_1k_input)
        self.price_per_1k_output = float(price_per_1k_output)
        self.used_in = 0
        self.used_out = 0
        self.tripped = False
        self.iteration_count = 0

    def add(self, input_tokens: int = 0, output_tokens: int = 0) -> float:
        """
        累加本次调用的 token 消耗并检查预算。

        Returns:
            当前累计成本（美元）
        Raises:
            BudgetExceeded: 成本超过 max_usd
        """
        self.used_in += max(0, int(input_tokens))
        self.used_out += max(0, int(output_tokens))
        self.iteration_count += 1
        cost = self.cost()
        if cost > self.max_usd and not self.tripped:
            self.tripped = True
            raise BudgetExceeded(
                f"Budget exceeded: ${cost:.4f} > max=${self.max_usd:.4f}",
                report=self.report(),
            )
        return cost

    def cost(self) -> float:
        """当前累计成本。"""
        return (
            (self.used_in / 1000.0) * self.price_per_1k_input
            + (self.used_out / 1000.0) * self.price_per_1k_output
        )

    def remaining(self) -> float:
        """剩余预算（可为负数，表示已超限）。"""
        return self.max_usd - self.cost()

    def report(self) -> Dict[str, Any]:
        """结构化成本报告，课件和测试均可读。"""
        return {
            "iterations": self.iteration_count,
            "tokens_input": self.used_in,
            "tokens_output": self.used_out,
            "cost_usd": round(self.cost(), 6),
            "max_usd": self.max_usd,
            "remaining_usd": round(self.remaining(), 6),
            "tripped": self.tripped,
        }

    def report_text(self) -> str:
        """一行文本报告。"""
        r = self.report()
        status = "TRIPPED" if r["tripped"] else "ok"
        return (
            f"[Budget {status}] iter={r['iterations']} "
            f"in={r['tokens_input']} out={r['tokens_output']} "
            f"cost=${r['cost_usd']:.4f} / max=${r['max_usd']:.4f}"
        )

    def register_to(self, hooks) -> None:
        """
        挂载到 HookManager 的 session_stop 事件（仅用于落日志）。

        注意：Budget 的核心逻辑（add + 抛异常）是在 core.run_agent 里主动调用的，
        不依赖 hook 触发。hook 只用于 session 结束时输出最终报告。
        """
        hooks.register("session_stop", self._on_session_stop)

    def _on_session_stop(self, answer=None, metrics=None) -> Dict[str, Any]:
        return {"budget_final": self.report()}
