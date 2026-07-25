step1_大模型技术入门
    part1_模型接入指南
        全球顶尖在线大模型接入指南
        1.大模型核心原理与全球厂商现状概述
        2.openRouter以及deepseek等国内平台注册
        3.OpenAI通用接口Chat Completions API基础使用
        4.Chat Completions API 接口进阶使用
        5.多模型交互实战项目LLM-PlayGround
    part2_模型部署与调用指南
        1. 全球三大开源平台介绍Huggingface、魔搭社区以及Github
        2. 开源平台实操、资源获取方式
        3. 大模型权重原理及显存需求计算
        4. AutoDL云服务平台介绍与创建实例
        5. 大模型量化技术介绍与GGUF、AWQ格式选型
        6. 量化框架llama.cpp、unsloth、ktransformers介绍与实操
        7. 本地部署ollama、vLLM演示  
    part3_模型agent开发基础
        1.1 大模型Agent演进脉络与生态全景
        1.2 Function Calling 概念详解与实战
        1.3 Function Calling 故障排查与并行调用工具优化    
    part4_模型rag入门
        1.1 大模型局限与RAG核心概念介绍
        1.2 RAG双流水线执行流程与六大组件介绍
        1.3 手动搭建RAG离线阶段文档读取切分实战
        1.4 在线阶段代码实现与代码库问答系统项目实战 

step2_agent开发实战上手
    part5_langchain1.0体系
        1.1 LangChain整体框架介绍
        1.2 LangChain生态、核心依赖定位以及Runnable概念介绍
        1.3 模型接口调用与速率限流和重试机制
        1.4 Messages消息列表和Prompt提示词模版演示
        1.5 标准化内容块、批处理和流式输出
        1.6 结构化输出以及搭建对话问答机器人案例
        2.1 Agent核心概念与React范式
        2.2 Tool工具接入与自定义工具使用
        2.3 MCP服务接入与意图识别分类优化
        2.4 SystemPrompt系统提示词与流式输出
        2.5 记忆管理之短期记忆、上下文裁剪与自定义State扩展
        2.6 记忆管理之长期记忆、跨线程记忆管理
        3.1 LangGraph Studio 图结构可视化框架
        3.2 中间件技术概览、类型分类与应用场景
        3.3 LangChain内部集成中间件介绍与应用
        3.4 装饰器与继承方法自定义中间件应用
        3.5 IT运维多中间件组合应用案例实战
        4.1 RAG基础概述与LangChain搭建RAG检索功能
        4.2 AgenticRAG概念介绍与自定义RAG检索工具Tool
        4.3 定义中间件构建完整AgenticRAG系统
        4.4 LangSmith可视化工具注册与使用
        5.1 DeepAgents框架定位与功能介绍
        5.2 系统提示词与子代理subAgent工具
        5.3 文件系统与backend沙箱环境应用
        5.4 backend数据库存储与混合后端模式
        6.1 DeepAgents网络爬虫系统架构及实现逻辑
        6.2 智能体运行效果与结果展示
        6.3 四大子智能体与工具独立运行效果
        6.4 AgentChatCli开源工具使用与DeepAgents总结
    part6_Agent_skills
        1.1 大模型Agent Skills演进脉络与官方应用
        1.2 Skills渐进式披露运行原理与内部结构解析
        1.3 Skills执行机制代码实现与MCP技术对比
        1.4 openai的sdk实现完整skills运行逻辑讲解
        1.5 Agent skills生态边界与应用场景
        1.6 AgentSkills基础入门课程答疑
        2.1 LangChain搭建Agent基础环境
        2.2 反面案例剖析Skills内核结构
        2.3 三大核心Skills设计原则
        2.4 SKills四种核心范式设计模式
        2.5 从零到一创建文档摘要Skills与评估优化实战
        2.6 升级版mini-openclaw项目创建评估skills演示
    part7_Harness_Engineering_驾驭工程
        1.1 Harness Engineering原理与概念介绍
        1.2 Harness 的工程实现视角-八大核心机制
        1.3 Harness的宏观产品视角-三支柱坐标系
        2.1 OpenAI的sdk搭建mini-Harness配置环境
        2.2 核心循环、工具调用与进度追踪实现逻辑
        2.3 上下文管理、任务清单与自验证实现逻辑
        2.4 子 Agent 编排实现逻辑
        2.5 生成-评估分离实现与完整手搓mini-harness运行
        3.1 DeepAgents框架定位与环境准备
        3.2 核心函数create_deep_agent八步组装流水线拆解
        3.3 Middleware中间件Hook扩展与实战
        3.4 Backend虚拟文件系统与子代理subAgent定义方式实战
        3.5 HITL人在闭环、Skill集成、Memory读取与权限设置
        3.6 集成案例测试gstack-agent生成HTML网页实战
        4.1 HermesAgent介绍与功能对比
        4.2 Hermes热冷记忆系统分层管理实现
        4.3 自我升级skills双计数器+子Agent四重约束
        4.4 Hermes思维取舍坐标与定位
        5.1 Hermes自进化curator整理机制
        5.2 ContextVar血统隔离防自动覆盖
        5.3 GEPA提示词优化器进化闭环
        5.4 harness四维横评驾驭工程选型
        6.1 项目实战导览：本机部署 + 五层架构 + 三大页面
        6.2 自我进化主线：解决任务 → 沉淀经验 → 强化技能 → 循环迭代
        6.3 三层记忆：SOUL 人格 / MEMORY 经验 / SqliteSaver 会话
        6.4 System Prompt 分层拼接：三层记忆装配 + 技能两级加载
        6.5 进化触发器：Agent 内核 + 中间件钩子机制
        6.6 技能自主生成：双段 Generator 沉淀新技能
        6.7 技能自主强化：Actor + Curator 双角色打磨
        6.8 安全与自省收尾：危险命令拦截 + 周期自省 + 会话诊断
   part8_claude_code架构与源码深度解析
       1.1 官方ClaudeCode介绍与安装部署
       1.2 cc-switch配置管理工具接入DeepSeekV4Pro模型
       1.3 ClaudeCode开源项目cc-haha部署
       2.1 ClaudeCode架构地图与QueryLoop思想
       2.2 Tool底层协议与Skill、MCP、Hook扩展三件套
       2.3 安全约束行为的四层安全管线
       3.1 上下文四层压缩机制与提示词缓存
       3.2 单文件记忆系统SessionMemory与双轨记忆架构
       3.3 子Agent上下文隔离与Fork缓存共享成本
       3.4 Coordinator集中编排思想与多模型混合路由
       4.1 Agent Teams 多智能体协作沟通模式
       4.2 FuFan-CC项目全景与主页面模块介绍
       4.3 UI页面与Agent SDK逻辑映射复现
       4.4 ClaudeCode多智能体team搭建经验与思考
   part9_openclaw原理与开发实战
        1.1 OpenClaw背景介绍与安装部署
        1.2 Agent运行时QueryLoop双侧循环与插话机制
        1.3 工具Tool、插件plugin、标签分类capability拓展介绍
        1.4 安装权限拦截与沙箱隔离
        2.1 上下文ContextEngine拼接五阶段流程
        2.2 上下文全局压缩兜底与工具截断机制
        2.3 多智能体分治思想与共享隔离边界
        2.4 记忆文件管理机制、存储与检索配置扩展
        3.1 FuFan-OpenClaw部署安装与功能介绍
        3.2 create_agent核心创建与基础功能集成
        3.3 记忆检索混合RRF机制核心实现
        3.4 多智能体工具集成与全链路串讲



