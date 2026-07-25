# researcher.py — Async subagent target graph for chapter 5 demos
#
# 暴露一个最简的 deepagent，作为 lesson.ipynb 第 5 章 5.5/5.7 异步子代理 demo 的远程
# 执行目标。通过 langgraph.json 注册为 graph_id="researcher"。
#
# 启动方式：在课件目录运行 `langgraph dev`，默认监听 http://localhost:2024
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from deepagents import create_deep_agent

DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
MODEL = f"deepseek:{DEEPSEEK_MODEL}"

# 简单的"研究助手"子代理：接收一个研究主题，返回 3-5 条要点的简短总结。
# 不绑工具，确保在 LangGraph Server 上可独立运行（无外部 IO 依赖）。
graph = create_deep_agent(
    model=MODEL,
    system_prompt=(
        "You are a research assistant. Given a research topic, "
        "produce a concise summary in 3-5 bullet points (Chinese). "
        "Keep total output under 200 words."
    ),
)
