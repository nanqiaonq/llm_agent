"""
SummarizationMiddleware 完整示例 - 可在 LangGraph Studio 中可视化

这个文件展示了如何在 LangGraph Agent 中使用 LangChain 官方的 SummarizationMiddleware
来自动管理对话历史，防止超出 token 限制。

【核心功能】
1. 自动监控消息的 token 数量
2. 当超过阈值时，自动总结旧消息
3. 保留最近的 N 条消息
4. 确保 AI/Tool 消息对保持在一起

【中间件类型】
before_model - 在模型调用前处理消息

【适用场景】
- 长对话场景（客服、咨询等）
- 防止超出模型 token 限制
- 保持对话上下文的连续性
- 自动压缩历史消息
"""

import os
from dotenv import load_dotenv
from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# 1. 加载环境变量
load_dotenv(override=True)


# ---------------------------------------------------------------------------
# 2. 定义工具 (Tools)
# ---------------------------------------------------------------------------

class SendEmailSchema(BaseModel):
    """发送邮件的参数模式"""
    recipient: str = Field(description="邮件接收者的邮箱地址")
    subject: str = Field(description="邮件主题")
    body: str = Field(description="邮件正文内容")

@tool(args_schema=SendEmailSchema)
def send_email(recipient: str, subject: str, body: str):
    """模拟发送邮件的工具"""
    print(f"\n======== [工具执行: 发送邮件] ========")
    print(f"收件人: {recipient}")
    print(f"主题  : {subject}")
    print(f"内容  : {body}")
    print(f"=====================================\n")
    # 返回较长的内容以增加 token 数量
    return f"""邮件发送成功！
收件人: {recipient}
主题: {subject}
内容: {body}
发送时间: 2024-01-01 10:00:00
邮件ID: MSG-{hash(recipient) % 10000}
状态: 已送达"""

class SearchWebSchema(BaseModel):
    """搜索网页的参数模式"""
    query: str = Field(description="搜索查询关键词")

@tool(args_schema=SearchWebSchema)
def search_web(query: str):
    """模拟网页搜索工具"""
    print(f"\n======== [工具执行: 搜索网页] ========")
    print(f"查询: {query}")
    print(f"=====================================\n")
    # 返回较长的内容以增加 token 数量
    return f"""搜索结果 - '{query}':
1. {query} 官方文档 - 详细介绍了 {query} 的使用方法和最佳实践
2. {query} 教程 - 从入门到精通的完整教程
3. {query} GitHub 仓库 - 开源项目和代码示例
4. {query} 社区讨论 - 常见问题和解决方案
5. {query} 最新动态 - 2024年的新特性和更新
共找到约 1,234,567 条相关结果"""

class AnalyzeDataSchema(BaseModel):
    """分析数据的参数模式"""
    data_source: str = Field(description="数据源名称")

@tool(args_schema=AnalyzeDataSchema)
def analyze_data(data_source: str):
    """模拟数据分析工具"""
    print(f"\n======== [工具执行: 分析数据] ========")
    print(f"数据源: {data_source}")
    print(f"=====================================\n")
    # 返回较长的内容以增加 token 数量
    return f"""数据分析报告 - {data_source}:
总记录数: 10,000
有效记录: 9,856
异常记录: 144
数据质量: 98.56%
主要发现:
- 趋势1: 数据呈现上升趋势，增长率约15%
- 趋势2: 周末数据量明显低于工作日
- 趋势3: 高峰时段集中在上午10-12点
建议: 建议增加数据采集频率，优化数据清洗流程"""

tools = [send_email, search_web, analyze_data]

# ---------------------------------------------------------------------------
# 3. 创建模型
# ---------------------------------------------------------------------------

model = ChatDeepSeek(model="deepseek-chat")

# ---------------------------------------------------------------------------
# 4. 创建带 SummarizationMiddleware 的图
# ---------------------------------------------------------------------------

system_prompt = """
你是一个专业的智能助手。
当用户请求执行操作时，你应该直接调用相应的工具。
不要问任何后续问题，直接生成工具调用。
"""

# 配置 SummarizationMiddleware
# 设置较低的阈值以便在测试中触发总结
summarization_middleware = SummarizationMiddleware(
    model=model,  # 使用相同的模型来生成摘要
    max_tokens_before_summary=500,  # 当消息超过 500 tokens 时触发总结
    messages_to_keep=3,  # 保留最近的 3 条消息
)

# 创建 Agent - LangGraph Studio 需要这个变量名为 'graph'
# 注意：LangGraph Studio 会自动处理持久化，不需要传入 checkpointer
graph = create_agent(
    model=model,
    tools=tools,
    system_prompt=system_prompt,
    middleware=[summarization_middleware]
)

# ---------------------------------------------------------------------------
# 5. 定义观察和执行函数
# ---------------------------------------------------------------------------

def run_interactive_session():
    """本地运行的交互式会话（需要 checkpointer）"""
    from langgraph.checkpoint.memory import MemorySaver

    print("\n" + "="*70)
    print("🎯 SummarizationMiddleware 完整演示")
    print("="*70)
    print("\n【测试目标】")
    print("通过多轮对话产生足够的 tokens，触发 SummarizationMiddleware")
    print(f"配置: max_tokens_before_summary=500, messages_to_keep=3")
    print("="*70 + "\n")

    # 本地运行时需要创建带 checkpointer 的 graph
    local_graph = create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        middleware=[summarization_middleware],
        checkpointer=MemorySaver()  # 本地运行需要
    )

    # 配置线程 ID
    thread_id = "demo_summarization_001"
    config = {"configurable": {"thread_id": thread_id}}

    # === 场景 1: 发送邮件 ===
    print("\n📧 场景 1: 发送邮件")
    print("-" * 70)

    user_input_1 = "帮我给 team@example.com 发一封邮件，主题是'项目进度更新'，内容是本周完成了核心功能开发。"
    print(f"[用户]: {user_input_1}\n")

    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_1}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if hasattr(last_msg, 'type'):
                if last_msg.type == "ai" and hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                    print(f"[AI 决策]: 调用工具 -> {last_msg.tool_calls[0]['name']}")
                elif last_msg.type == "tool":
                    print(f"[工具输出]: {last_msg.content[:100]}...")
                elif last_msg.type == "ai" and last_msg.content:
                    print(f"[AI 回复]: {last_msg.content}")

    # 检查状态
    snapshot = local_graph.get_state(config)
    print(f"\n[状态检查] 当前消息数量: {len(snapshot.values['messages'])}")

    # === 场景 2: 搜索网页 ===
    print("\n🔍 场景 2: 搜索网页")
    print("-" * 70)

    user_input_2 = "帮我搜索一下 LangChain 的最新文档"
    print(f"[用户]: {user_input_2}\n")

    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_2}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if hasattr(last_msg, 'type'):
                if last_msg.type == "ai" and hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                    print(f"[AI 决策]: 调用工具 -> {last_msg.tool_calls[0]['name']}")
                elif last_msg.type == "tool":
                    print(f"[工具输出]: {last_msg.content[:100]}...")
                elif last_msg.type == "ai" and last_msg.content:
                    print(f"[AI 回复]: {last_msg.content}")

    # 检查状态
    snapshot = local_graph.get_state(config)
    print(f"\n[状态检查] 当前消息数量: {len(snapshot.values['messages'])}")

    # === 场景 3: 分析数据 ===
    print("\n📊 场景 3: 分析数据")
    print("-" * 70)

    user_input_3 = "帮我分析一下 sales_2024 数据源"
    print(f"[用户]: {user_input_3}\n")

    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_3}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if hasattr(last_msg, 'type'):
                if last_msg.type == "ai" and hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                    print(f"[AI 决策]: 调用工具 -> {last_msg.tool_calls[0]['name']}")
                elif last_msg.type == "tool":
                    print(f"[工具输出]: {last_msg.content[:100]}...")
                elif last_msg.type == "ai" and last_msg.content:
                    print(f"[AI 回复]: {last_msg.content}")

    # 检查状态
    snapshot = local_graph.get_state(config)
    print(f"\n[状态检查] 当前消息数量: {len(snapshot.values['messages'])}")

    # === 场景 4: 再次发送邮件（应该触发总结）===
    print("\n📧 场景 4: 再次发送邮件（预期触发总结）")
    print("-" * 70)

    user_input_4 = "再给 hr@example.com 发一封邮件，主题是'休假申请'，内容是下周一想请假一天。"
    print(f"[用户]: {user_input_4}\n")

    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_4}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if hasattr(last_msg, 'type'):
                if last_msg.type == "human" and "summary" in last_msg.content.lower():
                    print(f"\n🎉 [检测到总结] SummarizationMiddleware 已触发！")
                    print(f"[摘要内容]: {last_msg.content[:200]}...\n")
                elif last_msg.type == "ai" and hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                    print(f"[AI 决策]: 调用工具 -> {last_msg.tool_calls[0]['name']}")
                elif last_msg.type == "tool":
                    print(f"[工具输出]: {last_msg.content[:100]}...")
                elif last_msg.type == "ai" and last_msg.content:
                    print(f"[AI 回复]: {last_msg.content}")

    # 最终状态检查
    snapshot = local_graph.get_state(config)
    print(f"\n[最终状态] 消息数量: {len(snapshot.values['messages'])}")

    # 检查是否有摘要消息
    has_summary = any(
        msg.type == "human" and "summary" in msg.content.lower()
        for msg in snapshot.values['messages']
    )

    print("\n" + "="*70)
    print("📊 测试结果")
    print("="*70)
    print(f"✅ 中间件触发: {'是' if has_summary else '否'}")
    print(f"📝 最终消息数: {len(snapshot.values['messages'])}")
    print(f"💡 说明: {'成功触发总结，旧消息已被压缩' if has_summary else '未触发总结，可能需要更多对话'}")
    print("="*70 + "\n")

if __name__ == "__main__":
    run_interactive_session()
