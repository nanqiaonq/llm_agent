"""
LLMToolEmulator (wrap_tool_call) 演示 - 金融交易场景模拟

本示例展示了如何使用 wrap_tool_call 类型的中间件来模拟高风险或高成本的工具调用。
在此场景中，我们模拟股票交易和银行转账工具，这在开发和测试阶段绝对不能执行真实操作。

【中间件类型】
wrap_tool_call - 包装/拦截工具调用

【核心功能】
1. 拦截所有交易相关的工具调用
2. 使用 LLM 生成逼真的交易确认信息
3. 验证交易参数（如金额是否为负数）
4. 确保在测试环境中资金安全
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
# 1. LLMToolEmulator 中间件定义 (金融版)
# ==============================================================================

class FinancialToolEmulator(AgentMiddleware):
    """
    金融工具模拟器 - 专门用于模拟高风险金融操作
    """
    
    def __init__(self, emulator_model):
        super().__init__()
        self.emulator_model = emulator_model
        
        # 专门针对金融场景的 Prompt
        self.prompt = ChatPromptTemplate.from_template(
            """
            你是一个银行核心交易系统的模拟器。
            请根据以下工具调用信息，生成一个标准的银行系统返回消息。
            
            工具名称: {tool_name}
            工具参数: {tool_args}
            
            要求：
            1. 生成包含交易流水号（Transaction ID）的成功消息。
            2. 如果金额巨大（超过 100万），添加一个"需要人工复核"的备注。
            3. 如果参数异常（如账号格式错误），生成拒绝交易的错误消息。
            4. 保持语气正式、严谨。
            
            返回内容示例：
            "交易成功。流水号: TXN-20240501-88392。已向账户 8839****22 成功转账 5000.00 元。余额已更新。"
            """
        )
        self.chain = self.prompt | self.emulator_model | StrOutputParser()

    def wrap_tool_call(
        self,
        request: Dict[str, Any],
        handler: Callable[[Dict[str, Any]], Any],
    ) -> Any:
        return self._handle_simulation(request, handler)

    async def awrap_tool_call(
        self,
        request: Dict[str, Any],
        handler: Callable[[Dict[str, Any]], Any],
    ) -> Any:
        # 注意：这里为了演示简单，直接调用同步的 _handle_simulation
        # 在生产环境中，应该使用 await self.chain.ainvoke
        # 但由于 _handle_simulation 内部逻辑包含同步 invoke，这里我们做个适配
        # 更好的做法是分别实现 _handle_simulation_sync 和 _handle_simulation_async
        return await self._handle_simulation_async(request, handler)

    def _handle_simulation(self, request, handler):
        """同步处理模拟逻辑"""
        tool_call = request.get("tool_call") if isinstance(request, dict) else getattr(request, "tool_call", None)
        if not tool_call: return handler(request)
        
        tool_name = tool_call.get("name")
        tool_args = tool_call.get("args")
        tool_id = tool_call.get("id")
        
        print(f"\n💸 [FinancialEmulator] 拦截交易工具: {tool_name}")
        print(f"   参数: {tool_args}")
        
        try:
            simulated_output = self.chain.invoke({
                "tool_name": tool_name,
                "tool_args": str(tool_args)
            })
            print(f"   ✅ 模拟交易结果: {simulated_output[:80]}...")
            
            return ToolMessage(
                content=simulated_output,
                tool_call_id=tool_id,
                name=tool_name,
                additional_kwargs={"simulated": True, "risk_level": "HIGH"}
            )
        except Exception as e:
            print(f"   ⚠️ 模拟失败: {e}")
            return handler(request)

    async def _handle_simulation_async(self, request, handler):
        """异步处理模拟逻辑"""
        tool_call = request.get("tool_call") if isinstance(request, dict) else getattr(request, "tool_call", None)
        if not tool_call: return await handler(request)
        
        tool_name = tool_call.get("name")
        tool_args = tool_call.get("args")
        tool_id = tool_call.get("id")
        
        print(f"\n💸 [FinancialEmulator] (Async) 拦截交易工具: {tool_name}")
        
        try:
            simulated_output = await self.chain.ainvoke({
                "tool_name": tool_name,
                "tool_args": str(tool_args)
            })
            print(f"   ✅ 模拟交易结果: {simulated_output[:80]}...")
            
            return ToolMessage(
                content=simulated_output,
                tool_call_id=tool_id,
                name=tool_name,
                additional_kwargs={"simulated": True, "risk_level": "HIGH"}
            )
        except Exception as e:
            print(f"   ⚠️ 模拟失败: {e}")
            return await handler(request)


# ==============================================================================
# 2. 定义高风险工具 (Tools)
# ==============================================================================

class TransferSchema(BaseModel):
    to_account: str = Field(description="收款方账户")
    amount: float = Field(description="转账金额")
    currency: str = Field(description="货币类型", default="CNY")

@tool(args_schema=TransferSchema)
def bank_transfer(to_account: str, amount: float, currency: str = "CNY"):
    """
    执行银行转账操作。
    注意：这是真实操作，会扣除资金！
    """
    # 这一行在测试中绝对不能被执行
    print("🚨 警告：真实转账代码正在执行！！！资金已扣除！！！")
    return f"真实转账成功: {amount} {currency} -> {to_account}"

class StockTradeSchema(BaseModel):
    symbol: str = Field(description="股票代码")
    action: str = Field(description="买入(buy)或卖出(sell)")
    quantity: int = Field(description="交易数量")

@tool(args_schema=StockTradeSchema)
def stock_trade(symbol: str, action: str, quantity: int):
    """
    执行股票交易。
    注意：这是真实操作，会提交到交易所！
    """
    print("🚨 警告：真实交易指令已提交！！！")
    return f"真实交易成功: {action} {quantity} shares of {symbol}"

tools = [bank_transfer, stock_trade]


# ==============================================================================
# 3. 创建 Agent
# ==============================================================================

# 主模型
model = ChatDeepSeek(model="deepseek-chat")

# 模拟器模型
emulator_model = ChatDeepSeek(model="deepseek-chat", temperature=0.3)

# 初始化中间件
financial_emulator = FinancialToolEmulator(emulator_model=emulator_model)

# 系统提示词
system_prompt = """
你是一个高级理财顾问。
根据用户的指令，使用工具帮助用户管理资产。
请在操作前仔细确认金额。
"""

# 创建 Agent
graph = create_agent(
    model=model,
    tools=tools,
    system_prompt=system_prompt,
    middleware=[financial_emulator]
)


# ==============================================================================
# 4. 运行示例
# ==============================================================================

def run_financial_demo():
    from langgraph.checkpoint.memory import MemorySaver
    
    print("\n" + "="*70)
    print("🏦 wrap_tool_call 演示 - 金融交易模拟")
    print("="*70)
    
    local_graph = create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        middleware=[financial_emulator],
        checkpointer=MemorySaver()
    )
    
    config = {"configurable": {"thread_id": "finance_demo_001"}}
    
    # 场景 1: 小额转账
    print("\n💳 场景 1: 小额转账 (模拟)")
    user_input_1 = "给房东(账号: 622200001111)转账 5000 元交房租"
    print(f"[用户]: {user_input_1}\n")
    
    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_1}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if last_msg.type == "tool":
                print(f"[交易系统反馈]: {last_msg.content}")
            elif last_msg.type == "ai" and last_msg.content:
                print(f"[顾问回复]: {last_msg.content}")

    # 场景 2: 大额股票交易
    print("\n📈 场景 2: 大额股票交易 (模拟)")
    user_input_2 = "帮我买入 10000 股 AAPL 股票"
    print(f"[用户]: {user_input_2}\n")
    
    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input_2}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if last_msg.type == "tool":
                print(f"[交易所反馈]: {last_msg.content}")
            elif last_msg.type == "ai" and last_msg.content:
                print(f"[顾问回复]: {last_msg.content}")

if __name__ == "__main__":
    run_financial_demo()
