#!/usr/bin/env python3
"""
端到端真实 demo：Baseline Agent vs Full Harness（10 机制）

执行内容：
  1. Baseline Agent：单轮 LLM 调用（无 Harness）
  2. Full Harness Agent：启用全部 10 机制（原 6 + 新 4）
     - Progress Tracking（写 progress.md）
     - Permission Gate（挂 pre_tool_use，故意给 run_bash 工具测拦截）
     - Hooks（事件总线，承载 Progress/Permission/Budget）
     - Token Budget（BudgetGuard 硬上限）

任务：分析 test_data/refactor_project/main.py 中的重复代码并给出重构建议。

输出：
  - demo_outputs/progress.md（Progress Tracker 真实落盘）
  - demo_outputs/e2e_result.json（结构化指标）
  - demo_outputs/e2e_report.md（人类可读报告，课件直接引用）
"""

import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# 加 HarnessEngineering/ 根目录下的 .env（用户指定路径）
REPO_ROOT = Path(__file__).parent.parent.resolve()
HARNESS_ROOT = REPO_ROOT.parent.parent  # lesson2/mini_harness → lesson2 → HarnessEngineering
load_dotenv(dotenv_path=HARNESS_ROOT / ".env")

sys.path.insert(0, str(REPO_ROOT))

from openai import OpenAI  # noqa: E402

from harness.budget import BudgetGuard  # noqa: E402
from harness.config import HarnessConfig  # noqa: E402
from harness.core import run_agent  # noqa: E402
from harness.hooks import HookManager  # noqa: E402
from harness.permission import PermissionGate  # noqa: E402
from harness.planner import reset_todos, todo_tool  # noqa: E402
from harness.progress import ProgressTracker  # noqa: E402
from harness.verifier import SYSTEM_PROMPT_WITH_VERIFICATION, verify_python_code  # noqa: E402


# ---- 配置 ----
# 默认走 DeepSeek 直连（对当前网络更稳、成本更低）
# 可通过 DEMO_PROVIDER=openrouter 切换到 OpenRouter
DEMO_PROVIDER = os.getenv("DEMO_PROVIDER", "deepseek").lower()
if DEMO_PROVIDER == "openrouter":
    MODEL_NAME = os.getenv("DEMO_MODEL", "anthropic/claude-sonnet-4.6")
    API_KEY = os.getenv("OPENROUTER_API_KEY")
    BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
else:  # deepseek
    MODEL_NAME = os.getenv("DEMO_MODEL", "deepseek-chat")
    API_KEY = os.getenv("DEEPSEEK_API_KEY")
    BASE_URL = "https://api.deepseek.com"

OUTPUT_DIR = REPO_ROOT.parent / "demo_outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TEST_CODE_PATH = REPO_ROOT / "test_data" / "refactor_project" / "main.py"


def read_test_code() -> str:
    return TEST_CODE_PATH.read_text(encoding="utf-8")


# ====================================================================
# Demo 1: Baseline Agent（无 Harness，单轮调用）
# ====================================================================
def run_baseline(user_goal: str, code: str) -> dict:
    print("\n" + "=" * 60)
    print("[Baseline Agent] 单轮 LLM 调用，无 Harness 机制")
    print("=" * 60)

    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
    t0 = time.time()
    resp = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "你是代码重构助手。"},
            {"role": "user", "content": f"{user_goal}\n\n代码：\n```python\n{code}\n```"},
        ],
        max_tokens=5000,
    )
    elapsed = time.time() - t0
    answer = resp.choices[0].message.content or ""
    usage = resp.usage
    result = {
        "mode": "baseline",
        "steps": 1,
        "elapsed_seconds": round(elapsed, 2),
        "tokens_input": getattr(usage, "prompt_tokens", 0) or 0,
        "tokens_output": getattr(usage, "completion_tokens", 0) or 0,
        "tokens_total": getattr(usage, "total_tokens", 0) or 0,
        "answer": answer,
        "blocked_tools": 0,
        "budget_report": None,
        "errors": [],
    }
    print(f"  steps={result['steps']}  elapsed={result['elapsed_seconds']}s  tokens={result['tokens_total']}")
    return result


# ====================================================================
# Demo 2: Full Harness Agent（10 机制全开）
# ====================================================================
def run_full_harness(user_goal: str, code: str) -> dict:
    print("\n" + "=" * 60)
    print("[Full Harness] 启用全部 10 机制（6 原有 + 4 新增）")
    print("=" * 60)

    reset_todos()

    # 1) Hooks 事件总线
    hooks = HookManager()

    # 2) Progress Tracker（写 progress.md）
    progress_path = OUTPUT_DIR / "progress.md"
    # 每次 demo 重置 progress.md，避免历史累积
    progress_path.unlink(missing_ok=True)
    tracker = ProgressTracker(str(progress_path), max_content_len=5000)
    tracker.register_to(hooks)

    # 3) Permission Gate（挂 pre_tool_use）
    gate = PermissionGate()
    gate.register_to(hooks)

    # 4) Token Budget（10 轮任务上限 $0.50）
    # 默认按 claude-sonnet-4.6 档次定价；DeepSeek 更便宜，此处留大额缓冲
    budget = BudgetGuard(
        max_usd=0.50,
        price_per_1k_input=0.003,
        price_per_1k_output=0.015,
    )
    budget.register_to(hooks)

    # 工具集：读/写/执行 shell + 重构分析 + TODO 规划
    # 故意暴露 run_bash，让 agent 可能尝试清理命令，观察 Permission Gate 是否拦截
    def run_bash(command: str) -> str:
        """执行 shell 命令"""
        return json.dumps({"status": "executed", "stdout": f"mock output of: {command}"})

    def refactor_code(code: str) -> str:
        """分析代码并提供重构建议"""
        return json.dumps({
            "duplications_found": 3,
            "suggestion": "提取 validate_data(data, required_fields) 消除三处重复验证逻辑；将硬编码配置移到 config.py",
        })

    def run_python(code: str) -> str:
        """真执行一段 Python 代码，返回 stdout / stderr / exit_code，用于验证重构代码能跑。"""
        return json.dumps(verify_python_code(code, timeout=15), ensure_ascii=False)

    tools = {
        "todo": todo_tool,
        "refactor_code": refactor_code,
        "run_bash": run_bash,
        "run_python": run_python,
    }

    config = HarnessConfig(
        api_key=API_KEY,
        base_url=BASE_URL,
        model_name=MODEL_NAME,
        max_steps=15,
    )

    # 增强 prompt：让 agent 规划 → 分析 → 收束
    enhanced_goal = f"""{user_goal}

    请严格按以下步骤完成：
    1. 用 todo 工具创建任务清单（4 条：识别重复 / 分析重构点 / 生成重构代码并真跑验证 / 综合建议）。
    2. 调用 refactor_code(code) 分析代码（必须传 code 参数）。
    3. 生成一段**自包含可执行**的重构 Python 代码（包含必要 import、函数定义，以及至少 2 个 assert 断言用来验证重构后与原函数输入输出等价），调用 run_python(code) 真跑一遍。
       如果 exit_code != 0 或 stderr 非空，修改代码再跑一次，直到 passed=true 为止（最多重试 2 次）。
    4. 逐条把 todo 标记为 completed。
    5. 最后一轮不要再调工具，直接用中文输出完整重构方案作为 final answer，
    包含：(a) 至少 2 处重复模式的具体位置；(b) 重构代码示例（就用上面 run_python 验证通过的版本）；(c) 为什么这样重构更好；(d) run_python 的验证结果摘要（passed/exit_code/关键 stdout）。
    final answer 不少于 500 字符。

    待分析代码：
    ```python
    {code}
    ```
    """ 

    t0 = time.time()
    result = run_agent(
        user_goal=enhanced_goal,
        tools=tools,
        config=config,
        system_prompt=SYSTEM_PROMPT_WITH_VERIFICATION,
        hooks=hooks,
        budget=budget,
    )
    elapsed = time.time() - t0

    result["mode"] = "full_harness"
    result["elapsed_seconds"] = round(elapsed, 2)
    result["tokens_total"] = result.get("tokens", 0)

    print(
        f"  steps={result['steps']}  elapsed={result['elapsed_seconds']}s  "
        f"tokens={result['tokens_total']}  blocked={result['blocked_tools']}  "
        f"errors={len(result['errors'])}"
    )
    if result.get("budget_report"):
        br = result["budget_report"]
        print(f"  budget: cost=${br['cost_usd']:.4f} / max=${br['max_usd']:.2f} tripped={br['tripped']}")
    print(f"  progress.md 写入：{progress_path}")

    return result


# ====================================================================
# 报告生成
# ====================================================================
def make_report(baseline: dict, harness: dict) -> str:
    def sect(title, body):
        return f"## {title}\n\n{body}\n"

    metrics_table = f"""<p align="center"><font face="黑体" size=4>Baseline vs Full Harness 端到端对比</font></p>

| 维度 | Baseline | Full Harness (10 机制) | 差异 |
|---|---|---|---|
| 步骤数 | {baseline['steps']} | {harness['steps']} | {'+' if harness['steps'] > baseline['steps'] else ''}{harness['steps'] - baseline['steps']} |
| 耗时 (s) | {baseline['elapsed_seconds']} | {harness['elapsed_seconds']} | {'+' if harness['elapsed_seconds'] > baseline['elapsed_seconds'] else ''}{round(harness['elapsed_seconds'] - baseline['elapsed_seconds'], 2)} |
| 总 tokens | {baseline['tokens_total']} | {harness['tokens_total']} | {'+' if harness['tokens_total'] > baseline['tokens_total'] else ''}{harness['tokens_total'] - baseline['tokens_total']} |
| 拦截次数 (Permission) | {baseline['blocked_tools']} | {harness['blocked_tools']} | — |
| 错误数 | {len(baseline.get('errors', []))} | {len(harness.get('errors', []))} | — |
"""

    budget_section = ""
    if harness.get("budget_report"):
        br = harness["budget_report"]
        budget_section = f"""
## Budget 报告（Full Harness）

- 累计成本：${br['cost_usd']:.4f} USD
- 预算上限：${br['max_usd']:.2f} USD
- 是否超限：{'是（已优雅终止）' if br['tripped'] else '否'}
- 迭代数：{br['iterations']}
- 输入 tokens：{br['tokens_input']}
- 输出 tokens：{br['tokens_output']}
"""

    baseline_answer = baseline["answer"] or ""
    harness_answer = harness["answer"] or ""

    return f"""# E2E Demo 报告：Baseline vs Full Harness

> 模型：`{MODEL_NAME}`
> 测试时间：{time.strftime('%Y-%m-%d %H:%M:%S')}
> 测试任务：分析 `main.py` 中的重复代码并给出重构建议

{metrics_table}
{budget_section}

## Baseline 输出（完整）

```
{baseline_answer}
```

## Full Harness 输出（完整）

```
{harness_answer}
```

## 关键观察

1. Full Harness 通过 TODO 工具把任务拆成清单，每步单独推理。
2. Progress Tracker 实时把每步写到 `demo_outputs/progress.md`，跨 session 续传的基础设施。
3. Permission Gate 对 `run_bash` 的危险命令进行拦截，demo 中 `blocked_tools={harness['blocked_tools']}`。
4. Token Budget 实时累计成本并在超限时优雅终止（本次 ${harness.get('budget_report', {}).get('cost_usd', 0):.4f} < 上限 $0.50，未触发）。

## 文件清单

- `demo_outputs/progress.md` — Progress Tracker 真实落盘记录
- `demo_outputs/e2e_result.json` — 完整指标（JSON 可编程读）
- `demo_outputs/e2e_report.md` — 本报告（课件可直接引用）
"""


def _retry(fn, attempts: int = 5, delay: float = 5.0, label: str = "call"):
    """对 fn 做简单重试，应对偶发 TLS / 网络错误。"""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            last = e
            print(f"  ⚠️ {label} attempt {i+1}/{attempts} failed: {type(e).__name__}: {e}")
            if i < attempts - 1:
                time.sleep(delay)
    raise last


def main():
    if not API_KEY:
        print("❌ 缺少 OPENROUTER_API_KEY，请检查 HarnessEngineering/.env")
        sys.exit(1)

    mode = os.getenv("E2E_MODE", "both").lower()  # both / baseline / harness

    print("=" * 60)
    print(f"端到端 Demo：Baseline vs Full Harness（10 机制）")
    print(f"模型：{MODEL_NAME}")
    print(f"测试文件：{TEST_CODE_PATH}")
    print(f"模式：{mode}")
    print("=" * 60)

    user_goal = "分析这个 Python 文件中的代码重复问题，列出至少 2 处重复模式并给出重构建议。"
    code = read_test_code()

    baseline_json_path = OUTPUT_DIR / "baseline_result.json"
    harness_json_path = OUTPUT_DIR / "harness_result.json"

    baseline = None
    harness = None

    # Baseline
    if mode in ("both", "baseline"):
        baseline = _retry(lambda: run_baseline(user_goal, code), label="baseline")
        baseline_json_path.write_text(json.dumps(baseline, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  → saved {baseline_json_path}")
    elif baseline_json_path.exists():
        baseline = json.loads(baseline_json_path.read_text(encoding="utf-8"))
        print(f"  ↻ loaded cached baseline from {baseline_json_path}")

    # Full Harness
    if mode in ("both", "harness"):
        harness = _retry(lambda: run_full_harness(user_goal, code), label="harness")
        harness_json_path.write_text(json.dumps(harness, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  → saved {harness_json_path}")
    elif harness_json_path.exists():
        harness = json.loads(harness_json_path.read_text(encoding="utf-8"))
        print(f"  ↻ loaded cached harness from {harness_json_path}")

    if baseline is None or harness is None:
        print("⚠️ 缺少一侧数据，跳过报告合成")
        return

    # 合并报告
    result_json = OUTPUT_DIR / "e2e_result.json"
    result_json.write_text(
        json.dumps({"baseline": baseline, "full_harness": harness}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    report_md = OUTPUT_DIR / "e2e_report.md"
    report_md.write_text(make_report(baseline, harness), encoding="utf-8")

    print("\n" + "=" * 60)
    print("✅ E2E Demo 完成")
    print(f"  JSON 报告：{result_json}")
    print(f"  MD 报告：{report_md}")
    print(f"  Progress 日志：{OUTPUT_DIR / 'progress.md'}")
    print("=" * 60)


if __name__ == "__main__":
    main()
