"""gstack-agent 全局配置：路径 / 模型 / .env 加载。

在导入时执行一次，提供所有模块共用的常量。
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# ============================================================
# 路径常量
# ============================================================
# 课件根目录（含 gstack/ 与 langgraph.json）
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# gstack skill 集合的真实磁盘位置；CompositeBackend 会把 /skills/ 虚拟路径路由到此
GSTACK_DIR = PROJECT_ROOT / "gstack"

# Agent 运行时的工作目录，所有非 /skills/ 与 /memories/ 的路径都落到这里
# 默认在 ~/gstack-agent-workspace（用户主目录便于浏览），可用 GSTACK_AGENT_WORKSPACE 环境变量覆盖
DEFAULT_WORKSPACE = Path.home() / "gstack-agent-workspace"
WORKSPACE_DIR = Path(os.getenv("GSTACK_AGENT_WORKSPACE", str(DEFAULT_WORKSPACE))).expanduser()
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

# 持久化 memory 的目录（/memories/AGENTS.md 路由到这里）
MEMORIES_DIR = WORKSPACE_DIR / ".memories"
MEMORIES_DIR.mkdir(parents=True, exist_ok=True)

# system prompt 来源
SYSTEM_PROMPT_FILE = Path(__file__).resolve().parent / "prompts" / "system.md"

# ============================================================
# .env 加载（项目自包含：只读 gstack_agent/.env）
# ============================================================
# 设计原则：配置就近、项目自包含、不依赖全局 ~/.claude/.env。
# 用户在 gstack_agent/.env 填 API key 和 model 配置即可生效，
# 该文件不应提交到 git（项目根 .gitignore 里已忽略）。
_LOCAL_ENV = Path(__file__).resolve().parent / ".env"
if _LOCAL_ENV.exists():
    load_dotenv(_LOCAL_ENV, override=False)

# ============================================================
# 模型配置（多 provider 支持）
# ============================================================
# 主代理 model spec（完整 "provider:model" 格式）。
# 优先级：GSTACK_AGENT_MODEL > deepseek:{DEEPSEEK_MODEL} > deepseek:deepseek-chat
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
MODEL = os.getenv("GSTACK_AGENT_MODEL", f"deepseek:{DEEPSEEK_MODEL}")

# 子代理全局 fallback：未给具体子代理指定 model 时使用
# 默认与主代理相同（同栈跑）；典型省钱套路是主代理用强模型 + 子代理用便宜模型
SUBAGENT_MODEL = os.getenv("GSTACK_AGENT_SUBAGENT_MODEL", MODEL)

# 各具名子代理可独立指定 model；未设则 fallback 到 SUBAGENT_MODEL
# 使用场景示例：
#   - GSTACK_AGENT_DESIGNER_MODEL=anthropic:claude-sonnet-4-6  (设计任务用强模型)
#   - GSTACK_AGENT_DEBUGGER_MODEL=openai:gpt-5                  (调试任务用 OpenAI)
#   - 其他默认走 deepseek 省钱
SUBAGENT_MODELS: dict[str, str] = {
    "ceo_reviewer": os.getenv("GSTACK_AGENT_CEO_REVIEWER_MODEL", SUBAGENT_MODEL),
    "eng_reviewer": os.getenv("GSTACK_AGENT_ENG_REVIEWER_MODEL", SUBAGENT_MODEL),
    "designer":     os.getenv("GSTACK_AGENT_DESIGNER_MODEL",     SUBAGENT_MODEL),
    "debugger":     os.getenv("GSTACK_AGENT_DEBUGGER_MODEL",     SUBAGENT_MODEL),
}

# ============================================================
# 运行时配置
# ============================================================
# 是否启用 HITL 审批（默认开启 — 安全优先）
HITL_ENABLED = os.getenv("GSTACK_AGENT_HITL", "1") == "1"

# 是否启用实时 Visualizer middleware（默认开启）
VISUALIZER_ENABLED = os.getenv("GSTACK_AGENT_VISUALIZER", "1") == "1"

# LangSmith 集成（如果 LANGSMITH_API_KEY 存在则自动启用）
LANGSMITH_ENABLED = bool(os.getenv("LANGSMITH_API_KEY"))
if LANGSMITH_ENABLED:
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
    os.environ.setdefault("LANGCHAIN_PROJECT", "gstack-agent")
