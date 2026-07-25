# 📘 LLM Agent 开发实战课程大纲

## step1：大模型技术入门

### part1：模型接入指南
- **全球顶尖在线大模型接入指南**
  1. 大模型核心原理与全球厂商现状概述
  2. OpenRouter 以及 DeepSeek 等国内平台注册
  3. OpenAI 通用接口 Chat Completions API 基础使用
  4. Chat Completions API 接口进阶使用
  5. 多模型交互实战项目 LLM-PlayGround

### part2：模型部署与调用指南
1. 全球三大开源平台介绍：HuggingFace、魔搭社区以及 GitHub
2. 开源平台实操、资源获取方式
3. 大模型权重原理及显存需求计算
4. AutoDL 云服务平台介绍与创建实例
5. 大模型量化技术介绍与 GGUF、AWQ 格式选型
6. 量化框架 llama.cpp、unsloth、ktransformers 介绍与实操
7. 本地部署 Ollama、vLLM 演示

### part3：模型 Agent 开发基础
1. 大模型 Agent 演进脉络与生态全景
2. Function Calling 概念详解与实战
3. Function Calling 故障排查与并行调用工具优化

### part4：模型 RAG 入门
1. 大模型局限与 RAG 核心概念介绍
2. RAG 双流水线执行流程与六大组件介绍
3. 手动搭建 RAG 离线阶段文档读取切分实战
4. 在线阶段代码实现与代码库问答系统项目实战

---

## step2：Agent 开发实战上手

### part5：LangChain 1.0 体系
- **1. LangChain 核心基础**
  1. LangChain 整体框架介绍
  2. LangChain 生态、核心依赖定位以及 Runnable 概念介绍
  3. 模型接口调用与速率限流和重试机制
  4. Messages 消息列表和 Prompt 提示词模版演示
  5. 标准化内容块、批处理和流式输出
  6. 结构化输出以及搭建对话问答机器人案例

- **2. Agent 核心与工具**
  1. Agent 核心概念与 ReAct 范式
  2. Tool 工具接入与自定义工具使用
  3. MCP 服务接入与意图识别分类优化
  4. SystemPrompt 系统提示词与流式输出
  5. 记忆管理之短期记忆、上下文裁剪与自定义 State 扩展
  6. 记忆管理之长期记忆、跨线程记忆管理

- **3. LangGraph 与中间件**
  1. LangGraph Studio 图结构可视化框架
  2. 中间件技术概览、类型分类与应用场景
  3. LangChain 内部集成中间件介绍与应用
  4. 装饰器与继承方法自定义中间件应用
  5. IT 运维多中间件组合应用案例实战

- **4. RAG 与 Agentic RAG**
  1. RAG 基础概述与 LangChain 搭建 RAG 检索功能
  2. Agentic RAG 概念介绍与自定义 RAG 检索工具 Tool
  3. 定义中间件构建完整 Agentic RAG 系统
  4. LangSmith 可视化工具注册与使用

- **5. DeepAgents 框架**
  1. DeepAgents 框架定位与功能介绍
  2. 系统提示词与子代理 SubAgent 工具
  3. 文件系统与 Backend 沙箱环境应用
  4. Backend 数据库存储与混合后端模式

- **6. DeepAgents 实战**
  1. DeepAgents 网络爬虫系统架构及实现逻辑
  2. 智能体运行效果与结果展示
  3. 四大子智能体与工具独立运行效果
  4. AgentChatCli 开源工具使用与 DeepAgents 总结

### part6：Agent Skills
- **1. Skills 基础与原理**
  1. 大模型 Agent Skills 演进脉络与官方应用
  2. Skills 渐进式披露运行原理与内部结构解析
  3. Skills 执行机制代码实现与 MCP 技术对比
  4. OpenAI 的 SDK 实现完整 Skills 运行逻辑讲解
  5. Agent Skills 生态边界与应用场景
  6. Agent Skills 基础入门课程答疑

- **2. Skills 设计实战**
  1. LangChain 搭建 Agent 基础环境
  2. 反面案例剖析 Skills 内核结构
  3. 三大核心 Skills 设计原则
  4. Skills 四种核心范式设计模式
  5. 从零到一创建文档摘要 Skills 与评估优化实战
  6. 升级版 mini-openclaw 项目创建评估 Skills 演示

### part7：Harness Engineering（驾驭工程）
- **1. 核心概念**
  1. Harness Engineering 原理与概念介绍
  2. Harness 的工程实现视角 - 八大核心机制
  3. Harness 的宏观产品视角 - 三支柱坐标系

- **2. Mini-Harness 实现**
  1. OpenAI 的 SDK 搭建 mini-Harness 配置环境
  2. 核心循环、工具调用与进度追踪实现逻辑
  3. 上下文管理、任务清单与自验证实现逻辑
  4. 子 Agent 编排实现逻辑
  5. 生成-评估分离实现与完整手搓 mini-harness 运行

- **3. DeepAgents 进阶**
  1. DeepAgents 框架定位与环境准备
  2. 核心函数 `create_deep_agent` 八步组装流水线拆解
  3. Middleware 中间件 Hook 扩展与实战
  4. Backend 虚拟文件系统与子代理 SubAgent 定义方式实战
  5. HITL 人在闭环、Skill 集成、Memory 读取与权限设置
  6. 集成案例测试：gstack-agent 生成 HTML 网页实战

- **4. Hermes Agent**
  1. Hermes Agent 介绍与功能对比
  2. Hermes 热冷记忆系统分层管理实现
  3. 自我升级 Skills 双计数器 + 子 Agent 四重约束
  4. Hermes 思维取舍坐标与定位

- **5. 自进化机制**
  1. Hermes 自进化 Curator 整理机制
  2. ContextVar 血统隔离防自动覆盖
  3. GEPA 提示词优化器进化闭环
  4. Harness 四维横评驾驭工程选型

- **6. 项目实战：五层架构**
  1. 项目实战导览：本机部署 + 五层架构 + 三大页面
  2. 自我进化主线：解决任务 → 沉淀经验 → 强化技能 → 循环迭代
  3. 三层记忆：SOUL 人格 / MEMORY 经验 / SqliteSaver 会话
  4. System Prompt 分层拼接：三层记忆装配 + 技能两级加载
  5. 进化触发器：Agent 内核 + 中间件钩子机制
  6. 技能自主生成：双段 Generator 沉淀新技能
  7. 技能自主强化：Actor + Curator 双角色打磨
  8. 安全与自省收尾：危险命令拦截 + 周期自省 + 会话诊断

### part8：Claude Code 架构与源码深度解析
- **1. 部署与配置**
  1. 官方 Claude Code 介绍与安装部署
  2. cc-switch 配置管理工具接入 DeepSeek V4 Pro 模型
  3. Claude Code 开源项目 cc-haha 部署

- **2. 架构核心**
  1. Claude Code 架构地图与 QueryLoop 思想
  2. Tool 底层协议与 Skill、MCP、Hook 扩展三件套
  3. 安全约束行为的四层安全管线
  4. Claude Code 快速入门

- **3. 上下文与记忆**
  1. 上下文四层压缩机制与提示词缓存
  2. 单文件记忆系统 SessionMemory 与双轨记忆架构
  3. 子 Agent 上下文隔离与 Fork 缓存共享成本
  4. Coordinator 集中编排思想与多模型混合路由

- **4. 多智能体协作**
  1. Agent Teams 多智能体协作沟通模式
  2. FuFan-CC 项目全景与主页面模块介绍
  3. UI 页面与 Agent SDK 逻辑映射复现
  4. Claude Code 多智能体 Team 搭建经验与思考

### part9：OpenClaw 原理与开发实战
- **1. 核心机制**
  1. OpenClaw 背景介绍与安装部署
  2. Agent 运行时 QueryLoop 双侧循环与插话机制
  3. 工具 Tool、插件 Plugin、标签分类 Capability 拓展介绍
  4. 安装权限拦截与沙箱隔离

- **2. 上下文与记忆**
  1. 上下文 ContextEngine 拼接五阶段流程
  2. 上下文全局压缩兜底与工具截断机制
  3. 多智能体分治思想与共享隔离边界
  4. 记忆文件管理机制、存储与检索配置扩展

- **3. FuFan-OpenClaw 实战**
  1. FuFan-OpenClaw 部署安装与功能介绍
  2. `create_agent` 核心创建与基础功能集成
  3. 记忆检索混合 RRF 机制核心实现
  4. 多智能体工具集成与全链路串讲


---

## 专题

### part1：Codex 
- **1. 核心机制与基础操作**
  1. 认识 Codex 安装与界面配置
  2. 第一个任务待办清单
  3. 计划模式做点餐收银系统
  4. 用 Git 管理代码版本
  5. 让 Codex 帮我们生图
  6. AGENTS.md 项目与全局规约
  7. 多 Agent 并行干活
  8. Computer_Use 操控电脑界面
  9. 自动化与 Skill 与手机远程

- **2. 进阶实战应用**
  1. 用 Codex 做数据看板
  2. 用 Codex 做信息图
  3. 用 Codex 做 PPT
  4. 用 Record_Replay 录制并重复
  5. 用 Goal 模式与 MCP 完成长任务

- **3. GitHub 协同开发实战**
  1. GitHub 和 Git 简要介绍
  2. 用 Codex 了解 GitHub 开源项目
  3. Codex 真实项目开发流程
  4. Codex 多分支协同开发

- **4. Loop Engineering 工程化落地**
  1. 从 Prompt 开始理解 Loop Engineering
  2. Codex 自动化任务的 Goal Loop 改造
  3. 手动构建 Loop Engineering 内循环
  4. 总结构建 Loop Engineering 工程习惯



