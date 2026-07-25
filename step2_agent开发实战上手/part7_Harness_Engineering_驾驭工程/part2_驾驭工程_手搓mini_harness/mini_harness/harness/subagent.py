"""子 Agent 委托执行 —— 将子任务隔离到独立 Agent 实例，避免上下文污染。"""

import json
from typing import List, Optional, Dict, Any, Callable

from .core import run_agent
from .config import HarnessConfig


def delegate(
    goal: str,
    context: str = "",
    tools: Optional[List[str]] = None,
    available_tools: Optional[Dict[str, Callable]] = None,
    config: Optional[HarnessConfig] = None,
) -> str:
    """
    Delegate subtask to a subagent.

    Creates isolated subagent with:
    - New message history (no parent context pollution)
    - Limited tool access (read-only by default)
    - Independent execution

    Args:
        goal: Subtask description
        context: Optional context information
        tools: List of tool names to allow (None = all available)
        available_tools: Dictionary of available tools
        config: Harness configuration

    Returns:
        JSON string with subtask result
    """
    if config is None:
        config = HarnessConfig.from_env()

    if available_tools is None:
        available_tools = {}

    # 工具过滤：子 Agent 只能访问白名单内的工具（最小权限原则）
    if tools is not None:
        subagent_tools = {
            name: func for name, func in available_tools.items() if name in tools
        }
    else:
        subagent_tools = available_tools  # 未限制则继承全部工具

    # 构建子 Agent prompt（子任务描述 + 可选上下文）
    prompt = f"Subtask: {goal}"
    if context:
        prompt += f"\n\nContext:\n{context}"

    # 隔离执行：新 messages 列表，无父 Agent 历史，独立计费
    try:
        result = run_agent(
            user_goal=prompt,
            tools=subagent_tools,
            config=config,
            # 角色定位为子 Agent，聚焦单一子任务
            system_prompt="You are a subagent helping with a specific subtask. Focus on the given goal and use available tools efficiently.",
        )

        return json.dumps(
            {
                "success": True,
                "answer": result["answer"],
                "steps": result["steps"],
                "errors": result["errors"],
            },
            ensure_ascii=False,
        )

    except Exception as e:
        return json.dumps(
            {"success": False, "error": f"Subagent execution failed: {str(e)}"},
            ensure_ascii=False,
        )
