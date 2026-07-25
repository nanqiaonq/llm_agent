"""Core agent loop implementation.

扩展（第二讲 lesson2）：
- 新增可选 hooks 参数（HookManager），为 Progress/Permission/Hooks 三机制提供挂载点
- 新增可选 budget 参数（BudgetGuard），为 Token Budget 提供硬上限保护
- tool schema 升级为从 inspect.signature 自动抽取参数，修复 "missing arg" bug
- 向后兼容：新参数都默认 None，不传时退化为原版 6 机制行为
"""

import inspect
import json
from typing import Dict, List, Any, Optional, Callable
from openai import OpenAI
import httpx

from .config import HarnessConfig
from .hooks import NoOpHooks
from .budget import BudgetExceeded


def run_agent(
    user_goal: str,
    tools: Dict[str, Callable],
    config: HarnessConfig,
    system_prompt: Optional[str] = None,
    hooks: Optional[Any] = None,
    budget: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Run agent loop with tool calling + hooks + budget.

    Args:
        user_goal: User's task description
        tools: Dictionary mapping tool names to callable functions
        config: Harness configuration
        system_prompt: Optional system prompt override
        hooks: Optional HookManager for Progress/Permission/lifecycle events
        budget: Optional BudgetGuard for cost hard cap

    Returns:
        Dictionary with:
        - answer: Final response text
        - steps: Number of iterations
        - tokens: Estimated token usage (based on response.usage if available)
        - errors: List of error messages from failed tool calls
        - budget_report: Budget stats if budget provided
        - blocked_tools: Count of tool calls vetoed by pre_tool_use hook
    """
    # hooks 未传入时使用 NoOpHooks 占位，core 循环无需判断 None
    if hooks is None:
        hooks = NoOpHooks()

    # 创建带超时的 httpx 客户端（默认 10s 可能不够大模型响应）
    http_client = httpx.Client(
        timeout=60.0,
        verify=True
    )

    client = OpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
        http_client=http_client
    )

    # 初始化 messages 列表（system prompt 可选）
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_goal})

    # 从工具函数签名自动生成 OpenAI 格式的 tool schema
    tool_schemas = _build_tool_schemas(tools)

    steps = 0
    errors: List[str] = []
    blocked_tools = 0   # 被 permission gate veto 的工具调用计数
    total_tokens = 0

    # ── 生命周期：session 开始 ──
    hooks.trigger("session_start", user_goal)

    try:
        while steps < config.max_steps:
            steps += 1

            # ── 生命周期：每轮迭代开始 ──
            hooks.trigger("pre_iteration", steps, messages)

            # ── 阶段1：调用 LLM ──
            response = client.chat.completions.create(
                model=config.model_name,
                messages=messages,
                tools=tool_schemas if tool_schemas else None,
                temperature=config.temperature,
            )

            # ── 阶段2：Budget 检测（使用真实 usage，无则估算）──
            usage = getattr(response, "usage", None)
            in_tokens, out_tokens = _safe_usage_ints(usage)
            if in_tokens + out_tokens > 0:
                total_tokens += (in_tokens + out_tokens)
                if budget is not None:
                    try:
                        budget.add(in_tokens, out_tokens)
                    except BudgetExceeded as e:
                        # 超预算：记录错误，优雅终止并返回成本报告
                        errors.append(str(e))
                        answer = f"[BUDGET EXCEEDED] {e}. Best-effort partial answer ended at step {steps}."
                        hooks.trigger("session_stop", answer, {
                            "steps": steps,
                            "tokens": total_tokens,
                            "errors": errors,
                            "budget_tripped": True,
                        })
                        return {
                            "answer": answer,
                            "steps": steps,
                            "tokens": total_tokens,
                            "errors": errors,
                            "budget_report": budget.report() if budget else None,
                            "blocked_tools": blocked_tools,
                        }
            else:
                total_tokens += _estimate_tokens(messages)  # 无真实 usage 时用字符估算

            choice = response.choices[0]
            message = choice.message

            # ── 生命周期：每轮迭代结束 ──
            hooks.trigger("post_iteration", steps, total_tokens)

            # 将 assistant 消息写入历史（含 tool_calls 字段）
            messages.append(
                {
                    "role": "assistant",
                    "content": message.content or "",
                    "tool_calls": (
                        [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                            }
                            for tc in message.tool_calls
                        ]
                        if message.tool_calls
                        else None
                    ),
                }
            )

            # ── 判断：无工具调用 → 最终答案 ──
            if not message.tool_calls:
                answer = message.content or ""
                hooks.trigger("session_stop", answer, {
                    "steps": steps,
                    "tokens": total_tokens,
                    "errors": errors,
                })
                return {
                    "answer": answer,
                    "steps": steps,
                    "tokens": total_tokens,
                    "errors": errors,
                    "budget_report": budget.report() if budget else None,
                    "blocked_tools": blocked_tools,
                }

            # ── 阶段3：逐个执行工具调用 ──
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tool_args_str = tool_call.function.arguments
                tool_id = tool_call.id

                try:
                    tool_args = json.loads(tool_args_str)
                except json.JSONDecodeError as e:
                    # JSON 解析失败：记录错误并将错误结果回写给 LLM
                    error_msg = f"Invalid JSON in tool arguments: {e}"
                    errors.append(error_msg)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "content": json.dumps({"error": error_msg}),
                        }
                    )
                    continue

                # ── Permission Gate（pre_tool_use veto 检查）──
                ok, reason = hooks.trigger_gate("pre_tool_use", tool_name, tool_args)
                if not ok:
                    blocked_tools += 1
                    errors.append(reason)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "content": json.dumps({"error": reason}, ensure_ascii=False),
                        }
                    )
                    # 被拦截也触发 post_tool_use，让 Progress tracker 记录拦截事件
                    hooks.trigger("post_tool_use", tool_name, tool_args, reason)
                    continue

                # ── 实际调用工具 ──
                result = dispatch_tool(tool_name, tool_args, tools)

                # 检查工具结果是否含错误字段
                try:
                    result_obj = json.loads(result)
                    if isinstance(result_obj, dict) and "error" in result_obj:
                        errors.append(result_obj["error"])
                except (json.JSONDecodeError, TypeError):
                    pass

                # ── Progress tracker（post_tool_use 记录）──
                hooks.trigger("post_tool_use", tool_name, tool_args, result)

                messages.append(
                    {"role": "tool", "tool_call_id": tool_id, "content": result}
                )

        # 达到最大轮次：优雅终止（不抛异常）
        answer = "Max steps reached without completion"
        hooks.trigger("session_stop", answer, {
            "steps": steps,
            "tokens": total_tokens,
            "errors": errors,
        })
        return {
            "answer": answer,
            "steps": steps,
            "tokens": total_tokens,
            "errors": errors,
            "budget_report": budget.report() if budget else None,
            "blocked_tools": blocked_tools,
        }

    except Exception as e:
        # 未知异常：仍触发 session_stop 以确保 progress/budget 报告落盘
        hooks.trigger("session_stop", f"[ERROR] {e}", {
            "steps": steps,
            "tokens": total_tokens,
            "errors": errors + [str(e)],
        })
        raise


def dispatch_tool(
    name: str, args: dict, tools: Dict[str, Callable]
) -> str:
    """
    工具调度器 —— 按名称查找并执行工具，结果统一序列化为字符串。

    设计原则：不抛异常，错误显性化为 JSON 返回给 LLM，让 Agent 有机会自我纠错。

    Args:
        name: LLM 指定的工具名
        args: LLM 传入的参数字典
        tools: 可用工具字典（key=工具名，value=可调用函数）

    Returns:
        工具执行结果的字符串（成功时为工具输出，失败时为 {"error": "..."} JSON）
    """
    # LLM 幻觉出不存在的工具名时，返回错误而非崩溃
    if name not in tools:
        return json.dumps({"error": f"Tool '{name}' not found"})

    try:
        result = tools[name](**args)   # **args 解包字典，动态传参给工具函数
        # tool role 的 content 必须是字符串，非字符串结果统一 JSON 序列化
        if not isinstance(result, str):
            result = json.dumps(result)
        return result
    except Exception as e:
        # 工具执行失败：不吞掉异常，封装成 JSON 让 LLM 看到并决定如何重试
        return json.dumps({"error": f"Tool execution failed: {str(e)}"})



_PY_TO_JSON_TYPE = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


def _build_tool_schemas(tools: Dict[str, Callable]) -> List[Dict]:
    """Build OpenAI tool schemas from tool functions via inspect.signature.

    旧版本 properties/required 都为空，导致 LLM 无法知道需要传哪些参数。
    本版本从函数签名抽取参数名、类型注解、是否必填，生成合法 JSON Schema。
    """
    schemas = []
    for name, func in tools.items():
        doc = (func.__doc__ or "").strip()
        properties: Dict[str, Dict[str, Any]] = {}
        required: List[str] = []

        try:
            sig = inspect.signature(func)
        except (TypeError, ValueError):
            sig = None

        if sig is not None:
            for param_name, param in sig.parameters.items():
                # 跳过 *args / **kwargs，不写入 schema
                if param.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
                    continue
                # 类型注解映射为 JSON Schema 类型；无注解默认 string
                json_type = _PY_TO_JSON_TYPE.get(param.annotation, "string")
                properties[param_name] = {
                    "type": json_type,
                    "description": f"parameter {param_name}",
                }
                # 无默认值 → required 参数
                if param.default is inspect.Parameter.empty:
                    required.append(param_name)

        schemas.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": doc or f"Tool: {name}",
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required,
                    },
                },
            }
        )
    return schemas


def _estimate_tokens(messages: List[Dict]) -> int:
    """Estimate token count for messages (fallback when response.usage missing)."""
    total_chars = sum(
        len(str(msg.get("content", ""))) + len(str(msg.get("tool_calls", "")))
        for msg in messages
    )
    return total_chars // 4


def _safe_usage_ints(usage) -> tuple:
    """
    安全提取 (prompt_tokens, completion_tokens) 整数值。

    兼容场景：
    - usage 为 None（本地 mock 场景）
    - usage.prompt_tokens 为 Mock/str/None（单测 mock）
    - 真实 OpenAI usage 对象（整数字段）
    """
    if usage is None:
        return 0, 0
    try:
        in_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    except (TypeError, ValueError):
        in_tokens = 0  # Mock 对象 int() 失败时归零
    try:
        out_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    except (TypeError, ValueError):
        out_tokens = 0
    return in_tokens, out_tokens
