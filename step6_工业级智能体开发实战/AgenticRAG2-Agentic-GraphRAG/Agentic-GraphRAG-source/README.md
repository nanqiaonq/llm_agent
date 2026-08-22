# LangExtractApp - 智能文本提取平台

基于 LangExtract + DeepSeek 的通用文本结构化提取平台。

## 项目概述

LangExtractApp 是一个通用的文本智能提取平台，支持多种场景的结构化信息提取。平台采用前后端分离架构，可灵活扩展不同的应用场景。

## 支持的场景

- **放射学报告** - 医学影像报告结构化提取
- **药物信息** - 病历中的药物处方提取
- **新闻信息** - 人物、地点、事件提取
- **自定义场景** - 用户可定义提取规则

## 项目结构

```
LangExtractApp/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # FastAPI 入口
│   │   ├── config.py           # 配置管理
│   │   ├── api/
│   │   │   └── routes.py       # API 路由
│   │   ├── core/
│   │   │   └── extractor.py    # 提取器核心
│   │   ├── models/
│   │   │   └── schemas.py      # Pydantic 模型
│   │   ├── scenarios/          # 场景定义
│   │   │   ├── radiology.py    # 放射学场景
│   │   │   ├── medication.py   # 药物场景
│   │   │   └── news.py         # 新闻场景
│   │   └── utils/
│   │       ├── sanitize.py     # 文本预处理
│   │       └── cache.py        # 缓存管理
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── components/         # React 组件
│   │   ├── pages/              # 页面
│   │   ├── services/           # API 服务
│   │   ├── hooks/              # 自定义 Hooks
│   │   └── types/              # TypeScript 类型
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## 快速开始

### 后端启动

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 配置环境变量
copy .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 启动服务
uvicorn app.main:app --reload --port 8000
```

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

## API 文档

启动后端后访问: http://localhost:8000/docs

## 技术栈

### 后端
- **FastAPI** - 现代高性能 Python Web 框架
- **LangExtract** - Google 结构化提取库
- **DeepSeek API** - 大语言模型 (deepseek-chat)
- **Pydantic** - 数据验证
- **uvicorn** - ASGI 服务器

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **TailwindCSS** - 样式框架
- **Axios** - HTTP 客户端
