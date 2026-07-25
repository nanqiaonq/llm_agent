"""
PersistenceMiddleware (after_agent) 演示 - 结果持久化

本示例展示了如何使用自定义的 PersistenceMiddleware 来实现 Agent 执行结果的自动持久化。
该中间件利用 `after_model` 钩子（模拟 after_agent），在模型响应后触发，将最终状态、输出结果
和执行元数据保存到本地文件系统（模拟数据库存储）。

【中间件类型】
after_agent (使用 after_model 钩子实现)

【核心功能】
1. 捕获 Agent 的最终执行状态
2. 提取关键信息（用户输入、AI 回复、工具调用）
3. 自动将结果持久化到 JSON 文件
4. 实现会话历史的归档
"""

import os
import json
import time
from typing import Any, Dict, List
from datetime import datetime
from dotenv import load_dotenv

from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, AgentState
from langchain_core.tools import tool
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage
from pydantic import BaseModel, Field

# 加载环境变量
load_dotenv(override=True)


# ==============================================================================
# 1. PersistenceMiddleware 定义
# ==============================================================================

class PersistenceMiddleware(AgentMiddleware):
    """
    持久化中间件：在 Agent 执行结束后保存结果
    """

    def __init__(self, save_path: str = "execution_logs"):
        """
        初始化中间件
        
        参数:
            save_path: 日志保存目录
        """
        super().__init__()
        self.save_path = save_path
        if not os.path.exists(save_path):
            os.makedirs(save_path)

    def after_model(self, state: AgentState, runtime) -> Dict[str, Any] | None:
        """
        在模型调用后触发持久化
        注意：官方 AgentMiddleware 暂无 after_agent 钩子，我们使用 after_model 
        来捕获模型响应并进行持久化，模拟执行后的保存行为。
        """
        # 获取消息历史
        messages = state.get("messages", [])
        if not messages:
            return None
            
        last_msg = messages[-1]
        
        # 只有当模型产生最终回复（非工具调用）时，才视为一次交互的"完成"并保存
        # 这是一个简化的判断逻辑
        if last_msg.type == "ai" and not (hasattr(last_msg, 'tool_calls') and last_msg.tool_calls):
            self._persist_result(state)
            
        return None

    def _persist_result(self, state: Dict[str, Any]):
        """执行实际的保存逻辑"""
        print("\n💾 [PersistenceMiddleware] 正在持久化执行结果...")
        
        # 获取会话信息 (模拟)
        session_id = f"session_{int(time.time())}"
        timestamp = datetime.now().isoformat()
        
        messages = state.get("messages", [])
        
        # 构建结构化记录
        record = {
            "session_id": session_id,
            "timestamp": timestamp,
            "status": "success",
            "conversation": self._serialize_messages(messages),
            "final_output": self._get_final_output(messages),
            "metadata": {
                "total_messages": len(messages),
                "agent_state": str(state.get("next", "end"))
            }
        }
        
        # 保存到文件
        filename = f"{self.save_path}/log_{session_id}.json"
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
            print(f"   ✅ 结果已保存至: {filename}")
        except Exception as e:
            print(f"   ❌ 保存失败: {e}")

    def _serialize_messages(self, messages: List[BaseMessage]) -> List[Dict]:
        """序列化消息列表"""
        serialized = []
        for msg in messages:
            msg_data = {
                "type": msg.type,
                "content": msg.content
            }
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                msg_data["tool_calls"] = [
                    {"name": tc["name"], "args": tc["args"]} 
                    for tc in msg.tool_calls
                ]
            serialized.append(msg_data)
        return serialized

    def _get_final_output(self, messages: List[BaseMessage]) -> str:
        """提取最终回复"""
        if not messages:
            return ""
        last_msg = messages[-1]
        if last_msg.type == "ai":
            return last_msg.content
        return ""


# ==============================================================================
# 2. 定义工具 (Tools)
# ==============================================================================

class ReportSchema(BaseModel):
    topic: str = Field(description="报告主题")

@tool(args_schema=ReportSchema)
def generate_report(topic: str):
    """生成业务报告"""
    return f"关于 {topic} 的详细业务分析报告...\n1. 市场趋势...\n2. 竞争对手..."

tools = [generate_report]


# ==============================================================================
# 3. 创建 Agent
# ==============================================================================

# 创建模型
model = ChatDeepSeek(model="deepseek-chat", temperature=0.1)

# 初始化中间件
persistence_middleware = PersistenceMiddleware()

# 系统提示词
system_prompt = "你是一个专业的业务分析师。请帮助用户生成报告。"

# 创建 Agent
# 注意：我们传入了 PersistenceMiddleware 实例
graph = create_agent(
    model=model,
    tools=tools,
    system_prompt=system_prompt,
    middleware=[persistence_middleware]
)


# ==============================================================================
# 4. 运行示例
# ==============================================================================

def run_persistence_demo():
    from langgraph.checkpoint.memory import MemorySaver
    
    print("\n" + "="*70)
    print("💾 PersistenceMiddleware (after_agent) 演示")
    print("="*70)
    
    local_graph = create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        middleware=[persistence_middleware],
        checkpointer=MemorySaver()
    )
    
    # 模拟一个会话
    session_id = "report_gen_001"
    config = {"configurable": {"thread_id": session_id}}
    
    user_input = "请帮我生成一份关于'AI 行业发展'的报告"
    print(f"\n[用户]: {user_input}")
    
    # 执行 Agent
    # 中间件会自动在模型回复后触发持久化
    for event in local_graph.stream(
        {"messages": [{"role": "user", "content": user_input}]},
        config=config,
        stream_mode="values"
    ):
        if "messages" in event:
            last_msg = event["messages"][-1]
            if last_msg.type == "ai":
                if hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                    print(f"[AI]: 调用工具 -> {last_msg.tool_calls[0]['name']}")
                else:
                    print(f"[AI]: {last_msg.content[:50]}...")

if __name__ == "__main__":
    run_persistence_demo()
