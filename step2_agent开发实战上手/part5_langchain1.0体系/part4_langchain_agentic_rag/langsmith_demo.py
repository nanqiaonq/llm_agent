import os

from langchain.chat_models import init_chat_model
from langchain_openai import ChatOpenAI

# 设置环境变量
os.environ["LANGCHAIN_TRACING_V2"] = "true"
# 设置LangSmith的API密钥
os.environ["LANGSMITH_API_KEY"] = "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"
# 设置LangSmith的项目名称
os.environ["LANGSMITH_PROJECT"] = "nq"


# 验证环境变量是否设置成功
print(os.getenv("LANGCHAIN_TRACING_V2"))
print(os.getenv("LANGSMITH_API_KEY"))
print(os.getenv("LANGSMITH_PROJECT"))

from langchain.agents import create_agent
# api_key="sk-73036237bdb54f62b9f2f11bca6aff4d"
# base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
# modlel_name_qwen3="qwen3-max"
# modlel_name_qwen3_6="qwen3.6-plus"


def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"


model = ChatOpenAI(
    model="qwen3-max",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    api_key="sk-73036237bdb54f62b9f2f11bca6aff4d",
)

agent = create_agent(
    model=  model,
    tools=[get_weather],
    system_prompt="You are a helpful assistant",
)

# Run the agent
result = agent.invoke(
    {"messages": [{"role": "user", "content": "What is the weather in San Francisco?"}]}
)
print(result)