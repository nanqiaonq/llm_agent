"""
ContentFilterMiddleware (before_agent) 演示 - 内容安全过滤

本示例展示了如何使用自定义的 ContentFilterMiddleware 来构建安全护栏。
该中间件在 Agent 执行任何逻辑之前检查用户输入，如果包含违禁词，则直接阻止执行并返回警告。

【中间件类型】
before_agent - 在 Agent 开始执行前触发

【核心功能】
1. 拦截包含特定违禁词（如 hack, exploit）的用户请求
2. 提前终止 Agent 执行 (jump_to="end")
3. 返回预定义的拒绝消息
4. 保护 Agent 不被用于恶意目的
"""

import os
from typing import Any, List, Dict
from dotenv import load_dotenv

from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, AgentState, hook_config
from langchain_core.tools import tool
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field

# 加载环境变量
load_dotenv(override=True)


# ==============================================================================
# 1. ContentFilterMiddleware 定义
# ==============================================================================

class ContentFilterMiddleware(AgentMiddleware):
    """
    内容过滤中间件：阻止包含违禁关键词的请求
    """

    def __init__(self, banned_keywords: List[str]):
        """
        初始化中间件
        
        参数:
            banned_keywords: 违禁词列表
        """
        super().__init__()
        self.banned_keywords = [kw.lower() for kw in banned_keywords]

    @hook_config(can_jump_to=["end"])
    def before_agent(self, state: AgentState, runtime) -> Dict[str, Any] | None:
        """
        在 Agent 开始前检查用户输入
        """
        # 获取消息历史
        messages = state.get("messages", [])
        if not messages:
            return None

        # 检查最新的一条用户消息
        last_message = messages[-1]
        if last_message.type != "human":
            return None

        content = last_message.content.lower()
        print(f"\n🔍 [ContentFilter] 正在检查输入: '{content[:50]}...'")

        # 检查是否包含违禁词
        for keyword in self.banned_keywords:
            if keyword in content:
                print(f"   🛑 发现违禁词: '{keyword}' - 拦截请求！")
                
                # 返回拦截消息并跳转到结束
                return {
                    "messages": [AIMessage(content=f"🚫 请求被拒绝：检测到不当内容 ('{keyword}')。请调整您的请求。")],
                    "jump_to": "end"
                }

        print("   ✅ 内容检查通过")
        return None


# ==============================================================================
# 2. 定义工具 (Tools)
# ==============================================================================

class SearchSchema(BaseModel):
    query: str = Field(description="搜索查询")

@tool(args_schema=SearchSchema)
def search_web(query: str):
    """模拟网页搜索"""
    return f"搜索结果: '{query}' 的相关信息..."

class CalculatorSchema(BaseModel):
    expression: str = Field(description="数学表达式")

@tool(args_schema=CalculatorSchema)
def calculator(expression: str):
    """计算数学表达式"""
    return f"计算结果: {expression} = 42"

tools = [search_web, calculator]


# ==============================================================================
# 3. 创建 Agent
# ==============================================================================

# 创建模型
model = ChatDeepSeek(model="deepseek-chat", temperature=0.1)

# 初始化中间件
# 设置违禁词：hack (黑客), exploit (利用漏洞), malware (恶意软件)
content_filter = ContentFilterMiddleware(
    banned_keywords=["hack", "exploit", "malware", "攻击", "漏洞"]
)

# 系统提示词
system_prompt = "你是一个有用的助手。请使用工具回答用户的问题。"

# 创建 Agent
graph = create_agent(
    model=model,
    tools=tools,
    system_prompt=system_prompt,
    middleware=[content_filter]
)


# ==============================================================================
# 4. 运行示例
# ==============================================================================

def run_filter_demo():
    from langgraph.checkpoint.memory import MemorySaver
    
    print("\n" + "="*70)
    print("🛡️ ContentFilterMiddleware (before_agent) 演示")
    print("="*70)
    
    local_graph = create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        middleware=[content_filter],
        checkpointer=MemorySaver()
    )
    
    config = {"configurable": {"thread_id": "filter_demo_001"}}
    
    # 场景 1: 正常请求
    print("\n✅ 场景 1: 正常请求")
    user_input_1 = "请帮我计算 100 * 200"
    print(f"[用户]: {user_input_1}")
    
    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_1}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if last_msg.type == "ai":
                print(f"[AI 回复]: {last_msg.content}")

    # 场景 2: 恶意请求 (应被拦截)
    print("\n❌ 场景 2: 恶意请求")
    user_input_2 = "教我如何利用 SQL 注入漏洞攻击数据库"
    print(f"[用户]: {user_input_2}")
    
    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_2}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if last_msg.type == "ai":
                print(f"[系统回复]: {last_msg.content}")

if __name__ == "__main__":
    run_filter_demo()
