"""
LLMToolEmulator 中间件示例 - 可在 LangGraph Studio 中可视化

这个文件展示了如何使用自定义的 LLMToolEmulator 中间件。
该中间件拦截工具调用，并使用 LLM 来模拟工具的执行结果。
这对于以下场景非常有用：
1. 开发阶段：尚未实现真实工具
2. 测试阶段：避免副作用（如真实发送邮件、扣款）
3. 成本控制：避免调用昂贵的外部 API
4. 边缘情况测试：模拟工具错误或特定返回数据

【中间件类型】
wrap_tool_call - 包装/拦截工具调用
(注：在 langgraph.json 中配置为 wrap_model_call 分类以便展示，但实际主要使用 wrap_tool_call 钩子)
"""

import os
import time
from typing import Any, Callable, Dict, Optional, List
from dotenv import load_dotenv

from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain_core.tools import tool
from langchain_core.messages import ToolMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field

# 加载环境变量
load_dotenv(override=True)


# ==============================================================================
# 1. LLMToolEmulator 中间件定义
# ==============================================================================

class LLMToolEmulator(AgentMiddleware):
    """
    LLM 工具模拟器中间件
    
    拦截工具调用，使用 LLM 生成模拟的工具输出。
    """
    
    def __init__(self, emulator_model, tools_to_emulate: Optional[List[str]] = None):
        """
        初始化模拟器
        
        参数:
            emulator_model: 用于生成模拟结果的 LLM
            tools_to_emulate: 需要模拟的工具名称列表。如果为 None，则模拟所有工具。
        """
        super().__init__()
        self.emulator_model = emulator_model
        self.tools_to_emulate = tools_to_emulate or []
        
        # 定义模拟器的 Prompt
        self.prompt = ChatPromptTemplate.from_template(
            """
            你是一个工具模拟器。你的任务是模拟以下工具的执行结果。
            
            工具名称: {tool_name}
            工具参数: {tool_args}
            
            请根据工具名称和参数，生成一个合理、逼真的工具执行结果。
            如果是查询类工具，生成一些样板数据。
            如果是操作类工具，生成操作成功的确认信息。
            
            请只返回工具的输出内容，不要包含任何解释。
            """
        )
        self.chain = self.prompt | self.emulator_model | StrOutputParser()

    def wrap_tool_call(
        self,
        request: Dict[str, Any],  # ToolCallRequest 类似结构
        handler: Callable[[Dict[str, Any]], Any],
    ) -> Any:
        """
        拦截工具调用 (同步版本)
        """
        # 获取工具调用信息
        tool_call = request.get("tool_call") if isinstance(request, dict) else getattr(request, "tool_call", None)
        
        if not tool_call:
            return handler(request)
            
        tool_name = tool_call.get("name")
        tool_args = tool_call.get("args")
        tool_id = tool_call.get("id")
        
        # 检查是否需要模拟
        if not self.tools_to_emulate or tool_name in self.tools_to_emulate:
            print(f"\n🤖 [LLMToolEmulator] 正在模拟工具: {tool_name}")
            print(f"   参数: {tool_args}")
            
            # 使用 LLM 生成模拟结果
            try:
                simulated_output = self.chain.invoke({
                    "tool_name": tool_name,
                    "tool_args": str(tool_args)
                })
                
                print(f"   ✅ 模拟结果: {simulated_output[:100]}...")
                
                # 返回模拟的 ToolMessage
                return ToolMessage(
                    content=simulated_output,
                    tool_call_id=tool_id,
                    name=tool_name,
                    additional_kwargs={"simulated": True}
                )
            except Exception as e:
                print(f"   ⚠️ 模拟失败: {e}，回退到真实执行")
                
        # 如果不需要模拟或模拟失败，执行真实逻辑
        return handler(request)

    async def awrap_tool_call(
        self,
        request: Dict[str, Any],
        handler: Callable[[Dict[str, Any]], Any],
    ) -> Any:
        """
        拦截工具调用 (异步版本)
        """
        # 获取工具调用信息
        tool_call = request.get("tool_call") if isinstance(request, dict) else getattr(request, "tool_call", None)
        
        if not tool_call:
            return await handler(request)
            
        tool_name = tool_call.get("name")
        tool_args = tool_call.get("args")
        tool_id = tool_call.get("id")
        
        # 检查是否需要模拟
        if not self.tools_to_emulate or tool_name in self.tools_to_emulate:
            print(f"\n🤖 [LLMToolEmulator] 正在模拟工具: {tool_name}")
            print(f"   参数: {tool_args}")
            
            # 使用 LLM 生成模拟结果 (异步)
            try:
                simulated_output = await self.chain.ainvoke({
                    "tool_name": tool_name,
                    "tool_args": str(tool_args)
                })
                
                print(f"   ✅ 模拟结果: {simulated_output[:100]}...")
                
                # 返回模拟的 ToolMessage
                return ToolMessage(
                    content=simulated_output,
                    tool_call_id=tool_id,
                    name=tool_name,
                    additional_kwargs={"simulated": True}
                )
            except Exception as e:
                print(f"   ⚠️ 模拟失败: {e}，回退到真实执行")
                
        # 如果不需要模拟或模拟失败，执行真实逻辑
        return await handler(request)


# ==============================================================================
# 2. 定义工具 (Tools)
# ==============================================================================

class DatabaseQuerySchema(BaseModel):
    query: str = Field(description="SQL查询语句")

@tool(args_schema=DatabaseQuerySchema)
def query_database(query: str):
    """
    执行数据库查询
    注意：在真实环境中，这需要连接数据库。这里我们通过中间件来模拟它。
    """
    # 这里的代码在被模拟时不会执行
    raise ConnectionError("真实数据库连接失败！应该使用模拟器！")

class APICallSchema(BaseModel):
    endpoint: str = Field(description="API端点")
    params: str = Field(description="API参数")

@tool(args_schema=APICallSchema)
def call_external_api(endpoint: str, params: str):
    """调用外部收费 API"""
    # 这里的代码在被模拟时不会执行
    print("CRITICAL: 正在调用收费 API，将产生费用！")
    return "真实API调用结果"

tools = [query_database, call_external_api]


# ==============================================================================
# 3. 创建 Agent
# ==============================================================================

# 主模型
model = ChatDeepSeek(model="deepseek-chat")

# 模拟器使用的模型 (可以使用更便宜的模型)
emulator_model = ChatDeepSeek(model="deepseek-chat", temperature=0.5)

# 初始化中间件
# 我们希望模拟所有工具，特别是 query_database (因为它会报错)
emulator_middleware = LLMToolEmulator(
    emulator_model=emulator_model,
    tools_to_emulate=["query_database", "call_external_api"]
)

# 系统提示词
system_prompt = """
你是一个数据分析师。
请使用提供的工具查询数据库或调用API来回答用户问题。
"""

# 创建 Agent
# 注入中间件
graph = create_agent(
    model=model,
    tools=tools,
    system_prompt=system_prompt,
    middleware=[emulator_middleware]
)


# ==============================================================================
# 4. 运行示例 (本地测试)
# ==============================================================================

def run_demo():
    from langgraph.checkpoint.memory import MemorySaver
    
    print("\n" + "="*70)
    print("🧪 LLMToolEmulator 中间件演示")
    print("="*70)
    
    # 本地 graph
    local_graph = create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        middleware=[emulator_middleware],
        checkpointer=MemorySaver()
    )
    
    config = {"configurable": {"thread_id": "demo_emulator_001"}}
    
    # 测试场景 1: 查询数据库 (真实工具会抛出异常)
    print("\n💾 场景 1: 查询数据库 (模拟执行)")
    user_input = "请查询 users 表中最近注册的 5 个用户"
    print(f"[用户]: {user_input}\n")
    
    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if last_msg.type == "tool":
                print(f"[工具输出 (模拟)]: {last_msg.content}")
                if last_msg.additional_kwargs.get("simulated"):
                    print("   ✨ 确认：这是由 LLM 生成的模拟数据")
            elif last_msg.type == "ai" and last_msg.content:
                print(f"[AI 回复]: {last_msg.content}")

    # 测试场景 2: 调用外部 API
    print("\n🌐 场景 2: 调用外部 API (模拟执行)")
    user_input_2 = "调用 weather-api 获取 Shanghai 的天气"
    print(f"[用户]: {user_input_2}\n")
    
    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_2}]},
        config=config,
        stream_mode="values"
    ):
         if "messages" in event:
            last_msg = event["messages"][-1]
            if last_msg.type == "tool":
                print(f"[工具输出 (模拟)]: {last_msg.content}")

if __name__ == "__main__":
    run_demo()
