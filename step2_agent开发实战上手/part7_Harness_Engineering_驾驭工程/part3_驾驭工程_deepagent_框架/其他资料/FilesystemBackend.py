# LangGraph Studio 入口：暴露 deepagents 的 agent 对象供 Studio 可视化
# - langgraph dev 通过 langgraph.json 中 "deepagents": "./test.py:agent" 加载
# - 顶层只做模块定义；调用测试放到 __main__ 守卫里，避免 dev 启动时触发 LLM
from deepagents import create_deep_agent, FilesystemPermission
from deepagents.backends import FilesystemBackend
import os

# .env 容错加载（langgraph dev 会自动读 langgraph.json 中声明的 .env，
# 这里再 load 一次是为了支持 `python test.py` 直接运行）
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# 模型选择：与 ipynb 保持一致
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
MODEL = f"deepseek:{DEEPSEEK_MODEL}"

# 工作目录：固定到课件所在目录下的 workspace 子目录（本地直接可见）
PROJECT_ROOT = "/Users/mac/PycharmProjects/JupyterProject/HarnessEngineering/Harness-DeepAgents"
workspace_dir = os.path.join(PROJECT_ROOT, "workspace")
os.makedirs(workspace_dir, exist_ok=True)

# 关键：langgraph dev 会自动注入持久化（checkpointer/store），
# 这里 **不要** 自定义 MemorySaver，否则 local_dev 会拒绝加载图
agent = create_deep_agent(
    model=MODEL,
    system_prompt="You are a helpful coding assistant. Be concise.",
    backend=FilesystemBackend(root_dir=workspace_dir, virtual_mode=True),
    permissions=[
        FilesystemPermission(operations=["read", "write"], paths=["/**"], mode="allow"),
    ],
    debug=True,
)


# 仅在 `python test.py` 直接执行时运行实测；
# `langgraph dev` import 模块时不会触发下面这段
if __name__ == "__main__":
    print(f"工作目录: {workspace_dir}")
    print(f"Agent 创建成功: {type(agent).__name__}")

    config = {"configurable": {"thread_id": "tier2-test-001"}}
    result = agent.invoke(
        {"messages": [{"role": "user", "content": "创建一个文件 hello.txt，内容写上'Hello DeepAgents'"}]},
        config=config,
    )

    last_msg = result["messages"][-1]
    role = last_msg.type if hasattr(last_msg, "type") else last_msg.get("role", "unknown")
    print(f"最后消息角色: {role}")
    print(f"消息数量: {len(result['messages'])}")

    expected_file = os.path.join(workspace_dir, "hello.txt")
    if os.path.exists(expected_file):
        with open(expected_file, "r") as f:
            content = f.read()
        print(f"文件创建成功: {expected_file}")
        print(f"文件内容: {content}")
    else:
        print(f"文件未找到: {expected_file}")
