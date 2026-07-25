# Harness Framework

轻量级 AI Agent 执行框架，实现八大核心机制。

## 项目结构

```
harness/
├── config.py       # 配置管理
├── core.py         # Agent Loop 核心循环
├── planner.py      # Feature List (TODO管理)
├── context.py      # Context Management (上下文压缩)
├── verifier.py     # Verification Loop (验证引导)
├── subagent.py     # Subagents (子任务委托)
└── evaluator.py    # Generator-Evaluator (方案评审)

tests/
├── test_core.py
├── test_planner.py
├── test_context.py
├── test_verifier.py
├── test_subagent.py
└── test_evaluator.py
```

## 已实现机制

### 批次2：核心循环
1. **Agent Loop** (`core.py`)
   - `run_agent()`: 主循环，支持工具调用
   - `dispatch_tool()`: 工具分发与错误处理
   - 自动记录错误，达到 max_steps 或无 tool_calls 时结束

2. **Feature List** (`planner.py`)
   - `todo_tool()`: TODO 列表管理
   - 支持查询、覆盖、合并三种模式
   - 状态：pending | in_progress | completed

### 批次3：高级机制
3. **Context Management** (`context.py`)
   - `compress_if_needed()`: 智能压缩
   - 保护 head (前2条) + tail (后6条)
   - 中间部分生成摘要

4. **Verification Loop** (`verifier.py`)
   - `SYSTEM_PROMPT_WITH_VERIFICATION`: 验证引导 prompt
   - 通过 system prompt 引导 agent 自我验证

5. **Subagents** (`subagent.py`)
   - `delegate()`: 子任务委托
   - 隔离上下文，限制工具访问
   - 返回结构化结果

6. **Generator-Evaluator** (`evaluator.py`)
   - `evaluate()`: 多方案评审
   - 返回最佳方案索引、分数、推理过程

## 测试覆盖

所有模块使用 `unittest.mock` 模拟 LLM 响应，无需真实 API 调用。

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定模块测试
pytest tests/test_core.py -v
```

## 配置

创建 `.env` 文件：

```
OPENROUTER_API_KEY=your_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
MODEL_NAME=deepseek/deepseek-chat
```

## 使用示例

```python
from harness.config import HarnessConfig
from harness.core import run_agent
from harness.planner import todo_tool

# 配置
config = HarnessConfig.from_env()

# 定义工具
tools = {
    "todo": todo_tool,
    # 其他工具...
}

# 运行 agent
result = run_agent(
    user_goal="完成任务规划",
    tools=tools,
    config=config
)

print(result["answer"])
print(f"步骤数: {result['steps']}")
print(f"错误: {result['errors']}")
```

## 下一步

- [ ] 实现剩余机制（Memory、Reflection）
- [ ] 集成真实 API 测试
- [ ] 添加更多工具示例
- [ ] 性能优化
