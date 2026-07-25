# gstack-agent

基于 DeepAgents 0.5 的生产级 Coding Agent。30+ skills + 4 专家子代理 + 多 provider 切换 + Claude Code 风格 CLI。

## 一句话能力

- **多 provider 模型**：主代理 / 4 个子代理可各自独立配 DeepSeek / OpenAI / Anthropic / OpenRouter / 任何 langchain provider
- **Claude Code 风格 CLI**：HITL 粒度审批 / 会话级 allowlist / 长任务心跳 / 多行粘贴自动识别 / 流式工具调用打印
- **30+ Skills 渐进披露**：`/skills/` 路由到 `gstack/`，按需 read SKILL.md
- **跨会话 Memory**：`/memories/AGENTS.md`
- **架构稳健性**：方案乙绕开 SummarizationMiddleware 边界 bug + 孤儿 tool_call 自愈

---

## 快速开始（30 秒）

```bash
cd Harness-DeepAgents
./gstack_agent/run.sh
```

前提：`gstack_agent/.env` 里有 `DEEPSEEK_API_KEY=sk-...`。其他什么都不用配，启动后看到 banner 即可输入 prompt。

```
┌── 🛠  gstack-agent ──────────────────────────────────────┐
│ gstack-agent  v0.1.0  ·  interactive shell              │
│ Model (main)  deepseek:deepseek-chat                    │
│    Subagents  (全部继承主代理 model)                    │
│    Workspace  /Users/you/gstack-agent-workspace         │
│       Skills  /skills/  →  gstack/ (30+ SKILL.md)       │
│       Memory  /memories/AGENTS.md  (cross-session)      │
│         HITL  on                                        │
│   Visualizer  on                                        │
└─────────────────────────────────────────────────────────┘
Tip: Enter 提交  |  行尾 \ 续行  |  """ 进入多行模式  |  /help 命令帮助  |  /exit 退出
>>>
```

---

## 配置（核心）

**所有配置都通过 `gstack_agent/.env` 文件**，启动时自动加载。

```
gstack_agent/.env    ← 编辑这个文件填 API key 和 model 配置
```

设计原则：**项目自包含**，不依赖任何全局环境变量文件（如 `~/.claude/.env`）。代码里 `gstack_agent/config.py` 只读取 `gstack_agent/.env` 这一个文件，不存任何 KEY。

**安全**：`.env` 已被项目根 `.gitignore` 忽略，不会进 git。

### 默认行为：全 DeepSeek，零额外配置

不设任何 `GSTACK_AGENT_*` 变量时，自动使用：

```
主代理 = deepseek:deepseek-chat
4 个子代理 = 同主代理
```

只需 `gstack_agent/.env` 里有 `DEEPSEEK_API_KEY` 即可跑。

### API Key 清单（按 provider 配）

| 环境变量 | 用途 | 何时必填 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek（默认 provider） | 默认配置必备 |
| `OPENAI_API_KEY` | OpenAI gpt-4o / gpt-5 | 想切 OpenAI 才配 |
| `ANTHROPIC_API_KEY` | Anthropic claude-* | 想切 Anthropic 才配 |
| `OPENROUTER_API_KEY` | OpenRouter（一 key 多模型） | 想切 OpenRouter 才配 |
| `LANGSMITH_API_KEY` | LangSmith 追踪 | 可选，配了自动开 |

### Model 选择（默认全 deepseek，按需切换）

| 变量 | 默认 | 作用 |
|---|---|---|
| `DEEPSEEK_MODEL` | `deepseek-chat` | DeepSeek 子模型名 |
| `GSTACK_AGENT_MODEL` | `deepseek:{DEEPSEEK_MODEL}` | 主代理完整 spec |
| `GSTACK_AGENT_SUBAGENT_MODEL` | 同主代理 | 4 个子代理 fallback |
| `GSTACK_AGENT_CEO_REVIEWER_MODEL` | 同 SUBAGENT | CEO reviewer 单独 |
| `GSTACK_AGENT_ENG_REVIEWER_MODEL` | 同 SUBAGENT | Engineering reviewer |
| `GSTACK_AGENT_DESIGNER_MODEL` | 同 SUBAGENT | Designer |
| `GSTACK_AGENT_DEBUGGER_MODEL` | 同 SUBAGENT | Debugger |

**spec 格式统一**：`provider:model`，例如：

```
deepseek:deepseek-chat
deepseek:deepseek-reasoner
openai:gpt-5
openai:gpt-4o
anthropic:claude-sonnet-4-6
openrouter:anthropic/claude-sonnet-4
openrouter:google/gemini-2.5-pro
```

### 切换示例

```bash
# 临时切换（一次跑）
GSTACK_AGENT_MODEL=openai:gpt-5 ./gstack_agent/run.sh

# 主代理强模型 + 子代理便宜模型（省钱套路）
GSTACK_AGENT_MODEL=anthropic:claude-sonnet-4-6 \
GSTACK_AGENT_SUBAGENT_MODEL=deepseek:deepseek-chat \
./gstack_agent/run.sh

# designer 单独切 Claude（设计任务用强模型，其他都 deepseek）
GSTACK_AGENT_DESIGNER_MODEL=anthropic:claude-sonnet-4-6 \
./gstack_agent/run.sh

# 永久写进 .env
echo "GSTACK_AGENT_DESIGNER_MODEL=anthropic:claude-sonnet-4-6" >> gstack_agent/.env
```

启动后 banner 会显示和主代理不同的子代理：

```
Model (main)  deepseek:deepseek-chat
   · designer  anthropic:claude-sonnet-4-6
```

### 切换非 deepseek 还需装 langchain provider 包

```bash
pip install langchain-anthropic     # 用 anthropic:*
pip install langchain-openai        # 用 openai:*
pip install langchain-openrouter    # 用 openrouter:*  (≥0.2.0)
```

未装就启动 → `ImportError`；装了但没配 KEY → `Could not resolve authentication method`。

### 行为开关

| 变量 | 默认 | 作用 |
|---|---|---|
| `GSTACK_AGENT_HITL` | `1` | HITL 审批（`0` 关闭，仅 demo / 自动化测试） |
| `GSTACK_AGENT_VISUALIZER` | `1` | 实时工具调用打印（`0` 关闭，输出更净） |
| `GSTACK_AGENT_WORKSPACE` | `~/gstack-agent-workspace` | 工作区路径 |

---

## CLI 使用

### 启动方式

```bash
# 推荐：一键启动（自动 PYTHONPATH + conda env，无需 pip install）
./gstack_agent/run.sh
./gstack_agent/run.sh --no-hitl    # 关 HITL（仅 demo）
./gstack_agent/run.sh --no-viz     # 关 visualizer

# 备用：pip install 后用全局命令
cd gstack_agent && pip install -e .
gstack-agent

# 手动：PYTHONPATH 启动
cd Harness-DeepAgents
PYTHONPATH=. python -m gstack_agent
```

### 多行输入（4 种方式自动识别）

| 方式 | 说明 |
|---|---|
| 直接 Enter | 单行最常用 |
| 行尾 `\` | 显式续行（`...` 提示符） |
| `"""` 进入 / 退出 | 显式多行模式 |
| 直接粘贴长 prompt | 自动识别（`select.select()` 探测 stdin buffer 瞬时多行） |

粘贴长 prompt 时会显示 `[已识别多行粘贴：N 行 / N 字符]`，确认收拢成一次输入。

### Slash 命令

```
/exit | /quit       退出
/clear              清屏
/reset              重置 thread（开新会话，丢弃消息历史；保留 allowlist）
/diag               诊断当前 thread 消息状态（不修改）
/heal               扫描并补全孤儿 tool_calls（thread 损坏时手动救援）
/allowlist          查看会话 allowlist
/allowlist clear    清空会话 allowlist
/help               本帮助
```

### HITL 审批（粒度设计）

每次主代理调 `task` / `shell_exec` / `write_file` / `edit_file` 时弹审批面板：

```
⏸  人类审批 / HITL approval
工具      shell_exec
参数      {'command': 'python3 -m http.server 8787 &', 'timeout': 3}
[a]lways  对 shell_exec(python3 -m) 模式本次会话不再询问

请选择操作：
  y  yes      仅此一次同意
  a  always   同意，并对同类命令本次会话不再询问
  n  no       拒绝执行
  q  quit     退出 CLI
```

| 键 | 含义 |
|---|---|
| `y` / Enter | 仅此次同意 |
| `a` | 同意 + 加入会话 allowlist（同类不再问） |
| `n` | 拒绝（要求填原因） |
| `e` | 修改参数后执行（仅 write/edit_file） |
| `q` | 退出 CLI |

**子代理 task 委派审批一次** = 你 approve 后子代理内部所有工具自动通过，不会反复打扰。

### 会话级 Allowlist（核心 UX）

按 `[a]` 后，相同模式的请求自动通过，打印一行 `✓ ... allowlisted — 自动通过`。

| 工具 | 模式粒度 | 例子 |
|---|---|---|
| `shell_exec` | 命令前两个 token | `python3 -m`、`ls -la`、`cd /workspace` |
| `write_file` / `edit_file` | 文件目录前缀 | `/workspace/` 下所有写都免问 |
| `read_file` | 目录前缀 | `/skills/design-html/` 下所有读 |
| `task` | `subagent:<name>` | `subagent:designer`、`subagent:ceo_reviewer` |

**危险命令永远禁止 allowlist**（即使按 `[a]` 也只生效本次）：

```
rm rmdir dd mkfs sudo su kill killall pkill chmod chown chgrp
shutdown reboot halt poweroff git
```

`/reset` 重置 thread 但**保留 allowlist**——你之前对工具的"信任决定"在新对话延续；重启 CLI 才清空。

---

## 子代理体系

主代理通过 `task` 工具委派，每个子代理独立上下文不污染主代理。

| 子代理 | 用途 | 触发场景 |
|---|---|---|
| `ceo_reviewer` | CEO 审查产品想法找 10-star 形态 | 用户给个 idea 要落地 |
| `eng_reviewer` | 工程审查（架构 / 数据流 / 测试计划） | idea 要工程化锁定 |
| `designer` | 视觉设计 + HTML 输出 | 配色 / 字体 / HTML 原型 |
| `debugger` | 5-Phase 根因调试 | bug / 测试失败 |
| `general-purpose` | 兜底任意任务 | 不匹配上述场景 |

子代理跳过 HITL 继承（`interrupt_on={}`）——主代理 approve 后子代理内部 N+ 工具调用不再打扰。

---

## 推荐用例：产品想法 → HTML 原型一条龙

```
请帮我把"做一个能让远程团队同步焦点工作的简洁应用"这个想法落到 HTML 原型。
按以下顺序：
1. ceo_reviewer 找 10-star 形态
2. designer 子代理产出设计系统 + HTML
最终写到 /focus-mvp.html
```

预期产物：`~/gstack-agent-workspace/focus-mvp.html`

### 提示词模式（精简版，避免长 turn 不稳定）

让 designer 子代理跳过读完整 SKILL.md，**直接给设计规格**：

```
我已完成 CEO 审查。请调 designer 子代理产出 HTML，**不要先去读 /skills/design-*/SKILL.md，按规格直写**：

主标题：Ship production agents, not prompt demos
视觉：深色技术风（背景 #0a0b0e、主色 #00d4aa、Inter + JetBrains Mono）
IA：Hero → Value Props → Curriculum → CTA
输出位置：/deepagents-landing.html

任何分析/思考都禁止单独输出，必须直接以 write_file 工具调用结束 turn。
```

强约束三要素：
1. 跳过读 SKILL.md（控制 turn 体积）
2. 直接给规格（避免子代理纠结设计选择）
3. 强制 tool_call 收尾（避免 deepseek "光说不做"）

---

## 工程亮点（架构特性）

### 1. 方案乙：禁用 SummarizationMiddleware

**问题**：DeepAgents 默认装的 `SummarizationMiddleware` 在多 tool_calls turn 上有切片边界 bug——会让 DeepSeek/OpenAI 抛 `BadRequestError("tool_calls must be followed by tool messages")`。

**解法**：在 `agent.py` 顶部 monkey-patch，用 noop middleware 替换：

```python
import deepagents.graph as _dg_graph
import deepagents.middleware.subagents as _dg_subagents
_dg_graph.create_summarization_middleware = _noop_summ_factory
_dg_subagents.create_summarization_middleware = _noop_summ_factory
```

**副作用**：长 thread 消息无界累积，可能撞模型 max_input_tokens（DeepSeek 64K）。
**缓解**：每个 task 完成后只留 1-2KB 摘要（子代理上下文隔离），50+ turn 都不会爆；用户主动 `/reset` 兜底。

### 2. 孤儿 tool_call 自愈（heal）

每轮 invoke 前后扫描 `state.messages`，发现 AIMessage 带 `tool_calls` 但缺对应 ToolMessage 时自动补占位（`<aborted: ...>`）。

兼容三种消息形态：`AIMessage` / `AIMessageChunk` / dict（`role` / `type` / `additional_kwargs.tool_calls`）。前一版只用 `isinstance(AIMessage)` 漏判 `AIMessageChunk` 导致 heal 失效，已修。

### 3. task 工具心跳

子代理委派耗时长（30s ~ 3min），visualizer middleware 每 10 秒打印一行：

```
⏳ designer 仍在执行中... (30s)
⏳ designer 仍在执行中... (60s)
```

避免误以为卡死。其他短工具不打扰。

### 4. 多行粘贴自动识别

CLI `_read_input()` 用 `select.select()` 探测 stdin buffer 是否瞬间有多行——粘贴长 prompt 时一次性收拢，不会被 input() 分多次读。续读用 `sys.stdin.readline()` 而非 `input("")`，避免 readline 模块的行编辑回显造成"重复显示"假象。

### 5. CompositeBackend 三路由

```
default     → ~/gstack-agent-workspace  (用户文件)
/skills/    → Harness-DeepAgents/gstack/ (30+ SKILL.md)
/memories/  → ~/gstack-agent-workspace/.memories  (跨会话偏好)
```

agent 视角的 `/foo.html` 会落盘到 `~/gstack-agent-workspace/foo.html`。

### 6. Permissions（first-match-wins）

```python
deny:  /.env /.env.* /secrets/** /.git/objects/** /.git/refs/** /.ssh/** /.aws/**
allow: /**
```

防 LLM 误改敏感文件 / git 内部状态。

---

## 项目结构

```
gstack_agent/
├── README.md (this)
├── pyproject.toml
├── run.sh                  # 一键启动脚本
├── __init__.py
├── __main__.py             # python -m gstack_agent 入口
├── agent.py                # 主 graph 定义 + 方案乙 monkey-patch
├── cli.py                  # 终端 CLI（HITL + allowlist + 多行 + heal）
├── config.py               # 环境变量解析（多 provider）
├── prompts/
│   └── system.md           # 主 system_prompt
├── tools/
│   ├── shell_exec.py       # bash 工具（白名单 + 沙箱）
│   └── code_search.py      # ripgrep 包装
└── middleware/
    └── visualizer.py       # 实时打印 + task 心跳
```

---

## LangGraph Dev（Studio UI / API）

```bash
cd Harness-DeepAgents
langgraph dev --port 2024 --no-browser
# Studio: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
# 注册名: gstack-agent
```

`langgraph.json` 已注册此 graph，dev 自动注入 checkpointer（无需手动）。

---

## LangSmith 追踪

```bash
echo "LANGSMITH_API_KEY=ls__..." >> gstack_agent/.env
echo "LANGCHAIN_PROJECT=gstack-agent" >> gstack_agent/.env  # 可选
```

启动 banner 显示 `LangSmith on`，所有 invoke 自动追踪。

---

## 故障排查

| 现象 | 原因 | 修复 |
|---|---|---|
| `BadRequestError: tool_calls must be followed...` | 老版本残留（已修复） | 重启 CLI |
| `/heal` 报"修复 0 个"但仍报错 | SummarizationMiddleware 边界（已修） | `/reset` |
| 心跳长时间没反应 | LLM 调用真挂起 | Ctrl+C 中断本轮 |
| `ImportError: langchain_anthropic` 等 | 没装 provider 包 | `pip install langchain-anthropic` |
| `Could not resolve authentication method` | 没配对应 API key | `.env` 加 `XXX_API_KEY=` |
| HTML 落到 `workspace/workspace/` 多一层 | prompt 写了 `/workspace/foo` | 写 `/foo` 即可 |
| LLM "光说不做"输出文字就 stop | DeepSeek 行为 | prompt 末尾加 "必须直接以 tool_call 结束 turn" |
| 子代理 124s 后挂掉 | 让子代理读完整 SKILL.md → 长 turn | 用精简提示词模式（直接给规格） |

---

## 已知限制

1. **shell_exec 看不到虚拟文件系统**：CompositeBackend 的 `/workspace/foo.html` 是虚拟路径，`shell_exec` 跑真实 bash 时看不到。**验证文件用 `read_file` 工具，不要用 `wc -c`/`ls`**。
2. **方案乙副作用**：长 thread 消息无界累积，50+ turn 后可能撞 model max_input_tokens，遇到就 `/reset`。
3. **DeepSeek "光说不做"**：偶尔输出"我要做 X"然后 finish_reason=stop 不调工具。在精简提示词加强约束。
4. **InMemorySaver**：消息历史不持久化，重启 CLI 全部丢失（隐私 + 简化考虑）。需要持久化可换 SqliteSaver。
5. **HITL 关闭后**：`--no-hitl` 时所有工具自动通过；仅 demo / 自动化测试用。

---

## 版本

`v0.1.0` —— DeepAgents 0.5.3 + LangChain 1.2.15 + LangGraph 1.1.10 + langchain-deepseek 1.0.1
