"""gstack-agent 主 graph 定义。

Import 时构造一个 deepagent 实例并暴露为 ``graph``，供：
  1. langgraph dev 通过 langgraph.json 加载（path: gstack-agent/agent.py:graph）
  2. cli.py 直接 import 启动终端交互

企业版集成清单（按需启用）：
  - Skills          : 路由 /skills/ → gstack/ (30+ skills)
  - Memory          : 跨会话持久化偏好（gstack/AGENTS.md 注入）
  - CompositeBackend: workspace + skills + memories 三路由
  - Permissions     : deny .env / .git / secrets，allow 其他
  - HITL            : write_file / edit_file / shell_exec 默认审批
  - Subagents       : ceo_reviewer / eng_reviewer / designer / debugger 四个专家
  - Custom Tools    : shell_exec, code_search
  - Custom MW       : VisualizerMiddleware 实时打印
  - LangSmith       : 自动启用（如有 LANGSMITH_API_KEY）
"""
from __future__ import annotations

# Bootstrap: 让 langgraph dev / 直接执行此文件时也能 import gstack_agent.*
import sys as _sys
from pathlib import Path as _Path

_parent = str(_Path(__file__).resolve().parent.parent)
if _parent not in _sys.path:
    _sys.path.insert(0, _parent)


# ============================================================
# 方案乙：禁用 DeepAgents 默认 SummarizationMiddleware
# ============================================================
# 根因：langchain 1.2 的 SummarizationMiddleware._find_safe_cutoff_point 在
# 多 tool_calls turn 上存在切片边界 bug：state.messages 是健康的（AI/Tool 一一
# 配对），但 LLM 调用前 invoke 内做 truncate 时切坏配对，导致 DeepSeek/OpenAI
# 抛 BadRequestError("tool_calls 必须紧跟 tool messages")。这种 truncate 是
# invoke 内临时的，无法通过 state 自愈修复（heal 看 state 是健康的，但下一轮
# 中间件还是会切坏）。
#
# 设计哲学：Claude Code 等成熟 Coding Agent 不依赖 summarization 中间件管理
# 长上下文，而是靠：
#   1. 子代理上下文隔离（subagent 是独立 graph，主代理只看 final ToolMessage 摘要）
#   2. 精简提示词模式（避免子代理读完整 SKILL.md 才动手 → 控制 ToolMessage 大小）
#   3. 单进程 InMemorySaver（不 cross-session 累积消息）
#
# 工程方案：在 import deepagents 之前 pre-load 内部模块，把
# `create_summarization_middleware` 工厂函数 monkey-patch 替换为返回 noop
# middleware 的版本。主代理 stack（graph.py:449）和子代理 stack
# （subagents.py:506 + graph.py:572）都需要 patch。
#
# 副作用与权衡：
#   - 长 thread 消息历史会无界累积，可能撞模型 max_input_tokens（DeepSeek 64K）
#   - 缓解：用户主动 /reset 开新会话；正常使用每个 task 完成后只留 1-2KB 摘要，
#     50+ turn 也不会爆
#   - 不 patch 的话：每隔几轮就撞 BadRequestError，体验更差
# ============================================================
import deepagents.graph as _dg_graph  # noqa: E402
import deepagents.middleware.subagents as _dg_subagents  # noqa: E402
from langchain.agents.middleware import AgentMiddleware  # noqa: E402


class _NoopSummarizationMiddleware(AgentMiddleware):
    """空 middleware，禁用 deepagents default summarization。

    AgentMiddleware 基类不实现任何 hook → 真正 noop。LangGraph 装入后不会
    打断中间件链，只是在该位置不做任何事。
    """


def _noop_summ_factory(*_args, **_kwargs):  # noqa: ANN001, ANN202
    """工厂签名兼容原 `create_summarization_middleware(model, backend)`."""
    return _NoopSummarizationMiddleware()


# Monkey-patch 两个使用点：主代理 graph 装配 + 子代理 stack 构造
_dg_graph.create_summarization_middleware = _noop_summ_factory
_dg_subagents.create_summarization_middleware = _noop_summ_factory


# 现在 import deepagents 公开 API，create_deep_agent 内部用的就是 noop 版本
from deepagents import (  # noqa: E402
    AsyncSubAgent,  # noqa: F401  保留导出，未来扩展用
    CompiledSubAgent,  # noqa: F401
    create_deep_agent,
    FilesystemPermission,
)
from deepagents.backends import (
    CompositeBackend,
    FilesystemBackend,
)

from gstack_agent.config import (
    GSTACK_DIR,
    HITL_ENABLED,
    MEMORIES_DIR,
    MODEL,
    SUBAGENT_MODEL,
    SUBAGENT_MODELS,    # ← 新增
    SYSTEM_PROMPT_FILE,
    VISUALIZER_ENABLED,
    WORKSPACE_DIR,
)
from gstack_agent.middleware.visualizer import VisualizerMiddleware
from gstack_agent.tools.code_search import code_search
from gstack_agent.tools.shell_exec import shell_exec


# ============================================================
# 1. System Prompt 加载（从 prompts/system.md）
# ============================================================
SYSTEM_PROMPT = SYSTEM_PROMPT_FILE.read_text(encoding="utf-8")


# ============================================================
# 2. CompositeBackend 五路由
#    /skills/     → gstack/ 真实磁盘（30+ SKILL.md）
#    /memories/   → MEMORIES_DIR (跨会话持久化)
#    /projects/   → ~/PycharmProjects/ (课件项目目录)
#    /kb/         → ~/本地知识库/ (Obsidian Vault)
#    其他         → WORKSPACE_DIR (默认工作区)
# ============================================================
backend = CompositeBackend(
    default=FilesystemBackend(root_dir=str(WORKSPACE_DIR), virtual_mode=True),
    routes={
        "/skills/": FilesystemBackend(root_dir=str(GSTACK_DIR), virtual_mode=True),
        "/memories/": FilesystemBackend(root_dir=str(MEMORIES_DIR), virtual_mode=True),
        "/projects/": FilesystemBackend(root_dir="/Users/mac/PycharmProjects", virtual_mode=True),
        "/kb/": FilesystemBackend(root_dir="/Users/mac/本地知识库", virtual_mode=True),
    },
)


# ============================================================
# 3. Permissions（first-match-wins，deny 规则前置）
#    防止 LLM 误改敏感文件 / git 内部状态
# ============================================================
permissions = [
    # 敏感文件 deny
    FilesystemPermission(operations=["read", "write"], paths=[
        "/.env", "/.env.*", "/secrets/**",
        "/.git/objects/**", "/.git/refs/**",
        "/.ssh/**", "/.aws/**",
    ], mode="deny"),
    # 其他全部放行
    FilesystemPermission(operations=["read", "write"], paths=["/**"], mode="allow"),
]


# ============================================================
# 4. HITL 审批策略（默认安全模式）
#
# 原则：**审批一次粗粒度决策，而不是每个细粒度操作都问**
#   - 主代理调用 task（委派给子代理）→ 审批一次："是否委派给 X 子代理"
#     → 同意后子代理内部所有 shell/write/edit 全部自动通过
#   - 主代理直接调 shell_exec/write_file/edit_file → 也审批一次
#
# 工程原因：
#   - 子代理本来就是隔离上下文，安全决策由主代理委派时完成
#   - 子代理内部步骤多（一次任务可能调 10+ 工具），每步都问会让人疯掉
#   - 这是 Claude Code 等成熟 agent CLI 的通用做法
#
# 子代理跳过 HITL 通过 subagent spec 中显式 interrupt_on={} 实现（见下面 subagents 配置）
# ============================================================
if HITL_ENABLED:
    interrupt_on = {
        "task": {"allowed_decisions": ["approve", "reject"]},        # 委派子代理时审批一次
        "shell_exec": {"allowed_decisions": ["approve", "reject"]},   # 主代理直跑 shell
        "write_file": True,                                            # 主代理直接写文件 (approve / edit / reject 全开)
        "edit_file": True,                                             # 主代理直接改文件
    }
else:
    interrupt_on = None


# ============================================================
# 5. Subagents — 四个专家子代理覆盖产品 → 设计 → 工程 → 调试
#    LLM 通过 task 工具委派，符合 gstack ETHOS 的"角色分离"
#
# **关键设计**：每个子代理 spec 显式传 interrupt_on={}（空字典）
#    deepagents 默认让子代理继承主代理的 interrupt_on（graph.py:524），
#    这会导致子代理内部每次 shell_exec / write_file 都问审批，体验很差。
#    显式覆盖为 {} 后，子代理装 HumanInTheLoopMiddleware 时（subagents.py:562
#    的 `if interrupt_on:` 判断）会跳过 → 子代理内部全部自动通过，
#    安全保证由主代理在 task 委派时一次性审批完成。
# ============================================================
_SUBAGENT_NO_HITL = {"interrupt_on": {}}   # 显式空字典 = 跳过 HITL 继承

# general-purpose 必须显式声明，否则框架自动添加的版本会继承主代理 interrupt_on
_GENERAL_PURPOSE_SUBAGENT = {
    "name": "general-purpose",
    "description": (
        "Default fallback subagent for any task that doesn't match a specialized subagent. "
        "Carries out the delegated step-by-step and returns concise results."
    ),
    "system_prompt": (
        "You are a general-purpose task executor. Carry out the delegated subtask "
        "step-by-step, use available tools as needed, and return a concise result."
    ),
    **_SUBAGENT_NO_HITL,
}

subagents = [
    _GENERAL_PURPOSE_SUBAGENT,
    {
        "name": "ceo_reviewer",
        "description": (
            "CEO-style product reviewer. Use when user has a product idea and wants to find "
            "the '10-star form' — the most ambitious yet feasible version. Reads "
            "/skills/plan-ceo-review/SKILL.md and follows it."
        ),
        "system_prompt": (
            "You are a CEO-level product reviewer. Read /skills/plan-ceo-review/SKILL.md first, "
            "then apply that methodology to the user's idea. Be opinionated and concrete."
        ),
        "model": SUBAGENT_MODELS["ceo_reviewer"],
        **_SUBAGENT_NO_HITL,
    },
    {
        "name": "eng_reviewer",
        "description": (
            "Engineering manager reviewer. Use when an idea needs architecture / data flow / "
            "edge cases / test plan locked down. Reads /skills/plan-eng-review/SKILL.md."
        ),
        "system_prompt": (
            "You are an engineering manager. Read /skills/plan-eng-review/SKILL.md first, then "
            "apply it to lock architecture, data flow, edge cases, and test plan."
        ),
        "model": SUBAGENT_MODELS["eng_reviewer"],
        **_SUBAGENT_NO_HITL,
    },
    {
        "name": "designer",
        "description": (
            "Design system specialist. Use when user needs visual design, color/typography "
            "system, or HTML prototype. Reads /skills/design-consultation/SKILL.md or "
            "/skills/design-html/SKILL.md depending on phase."
        ),
        "system_prompt": (
            "You are a design system specialist. Read the relevant SKILL.md "
            "(/skills/design-consultation/SKILL.md for systems, /skills/design-html/SKILL.md "
            "for HTML output), then produce concrete artifacts."
        ),
        "model": SUBAGENT_MODELS["designer"],
        **_SUBAGENT_NO_HITL,
    },
    {
        "name": "debugger",
        "description": (
            "Root-cause debugger. Use when user reports a bug, test failure, or unexpected "
            "behavior. Reads /skills/investigate/SKILL.md and follows the 5-Phase Iron Law."
        ),
        "system_prompt": (
            "You are a root-cause debugger. Read /skills/investigate/SKILL.md first, then "
            "apply the 5-Phase Iron Law strictly: NO FIXES WITHOUT INVESTIGATION."
        ),
        "model": SUBAGENT_MODELS["debugger"],
        **_SUBAGENT_NO_HITL,
    },
]


# ============================================================
# 6. Middleware — Visualizer (实时打印 hook 输出)
#    禁用时只关闭可视化，不影响 agent 行为
# ============================================================
extra_middleware = []
if VISUALIZER_ENABLED:
    extra_middleware.append(VisualizerMiddleware())


# ============================================================
# 7. 构建主 graph
#    暴露两种构造路径：
#    - graph (module-level)         : langgraph dev 加载用，由 dev 自动注入 checkpointer
#    - build_graph(checkpointer=...) : cli.py 直接调用，传 InMemorySaver 让 HITL 可恢复
# ============================================================
def build_graph(checkpointer=None):
    """构造 gstack-agent graph，支持外部注入 checkpointer。

    Args:
        checkpointer: LangGraph checkpointer（HITL 必需）；CLI 传 InMemorySaver；
                      langgraph dev 不传（由 dev 自动注入）

    Returns:
        编译好的 CompiledStateGraph
    """
    return create_deep_agent(
        name="gstack-agent",
        model=MODEL,
        system_prompt=SYSTEM_PROMPT,
        tools=[shell_exec, code_search],
        skills=["/skills/"],
        memory=["/memories/AGENTS.md"],
        backend=backend,
        permissions=permissions,
        interrupt_on=interrupt_on,
        subagents=subagents,
        middleware=extra_middleware,
        checkpointer=checkpointer,
    )


# langgraph dev 加载时调用此 module-level 变量；不传 checkpointer，由 dev 自动注入
graph = build_graph()
