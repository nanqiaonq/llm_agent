# 大模型 Agent 开发基础 Part 3 · HTML 交互课件

> 从 Agent 演进历程出发，系统讲解 ReAct 模式核心原理、Function Calling 六步流程、工具定义最佳实践与串行/并行调用策略。

## 🎯 项目概述

这是一个纯前端的交互式课件，旨在帮助学员：
1. 理解 Agent 从插件时代到 Function Calling 的演进历程。
2. 掌握 ReAct 模式的核心思想（Think → Action → Observe 循环）。
3. 深入理解 Function Calling 六步流程与工具定义规范。
4. 通过交互模拟器体验串行 ReAct、并行 ReAct 与单轮 FC 的差异。

## 🚀 快速启动

本项目为纯静态 HTML/JS，无需编译。

### 方法 1: Python 服务器 (推荐)
```bash
cd agent-part3-courseware
python -m http.server 8004
# 访问 http://localhost:8004
```

### 方法 2: VS Code Live Server
1. 安装 Live Server 插件。
2. 右键 `index.html` -> "Open with Live Server"。

## 📁 目录结构

```
agent-part3-courseware/
├── index.html              # 主入口 (幻灯片路由 + 星空背景)
├── react_visualizer.html   # 独立 ReAct 模拟器 (可单独打开)
├── css/
│   └── main.css            # 全局样式 (星空主题 + 响应式布局)
├── js/
│   ├── main.js             # 核心导航逻辑 (翻页/进度/菜单)
│   └── interactive.js      # 交互组件逻辑 (动画/模拟器)
└── slides/                 # 31 张幻灯片页面 (HTML 片段)
    ├── S001-cover.html
    ├── S002-learning-path.html
    ├── ...
    └── S030-next-steps.html
```

## 🛠️ 设计约束 (贡献者必读)

为了保证演示质量，所有页面必须遵守：
1. **居中对齐**：使用 `.slide` 类的默认 Flexbox 居中。
2. **80% 填充限制**：内容不应贴边，留有足够呼吸感。
3. **无滚动条**：内容必须适配视口高度 (`100vh`)，溢出会被裁剪。
4. **响应式字体**：使用 `clamp()` 确保在不同分辨率下可读。

## 🧩 交互组件清单

- [S004] Agent 演进时间线动画
- [S008] CEO 助手任务分解动画
- [S010] RAG 到 Agent 能力对比动画
- [S012] Chain of Thought 推理步骤展示
- [S013] Think-Action-Observe 循环动画
- [S014] 天气查询案例流程图
- [S017] Agent 四大支柱交互展示
- [S019b] 工作流决策矩阵交互器
- [S020] 决策矩阵热力图
- [S023] Function Calling 六步流程动画
- [S026] 工具定义黄金模板展示
- [S028] 串行 vs 并行调用对比动画
- [react_visualizer.html] 完整 ReAct 模拟器（支持三种模式切换）

## ⌨️ 快捷键

| 按键 | 功能 |
|------|------|
| `←` `→` | 前后翻页 |
| `F` | 全屏切换 |
| `M` | 课程目录菜单 |
| `T` | 钢笔拖尾效果 |

## 🎨 核心特性

### 1. ReAct 模拟器 (react_visualizer.html)
独立的交互式模拟器，支持三种模式对比：
- **单轮 FC**：演示传统 Function Calling 的局限性（1 轮后终止）
- **串行 ReAct**：演示 4 轮 Think→Action→Observe 循环
- **并行 ReAct**：演示并行工具调用优化（3 轮完成任务）

特性：
- 实时 Messages[] 数组可视化
- SVG 流程图动态高亮
- 安全阀计数器（防止无限循环）
- 逐步执行 / 自动播放模式
- 支持前进/后退/重置

### 2. 星空主题背景
- 动态星空粒子效果
- 渐变星云背景
- 钢笔拖尾交互（按 T 键启用）

### 3. 响应式设计
- 支持桌面端 (1920×1080) 和平板端 (1024×768)
- 自适应字体大小 (`clamp()`)
- 触摸手势支持（移动端左右滑动翻页）

## 📚 课程章节结构

### 第一章：Agent 演进历程
- S001: 封面
- S002: 学习路径
- S004: 演进时间线（插件时代 → Function Calling）
- S005: 原生能力 vs 涌现能力
- S006: 插件时代的失败教训

### 第二章：Agent 核心概念
- S008: CEO 助手案例（任务分解）
- S009: Agent 六维能力模型
- S010: 从 RAG 到 Agent 的能力跃迁

### 第三章：ReAct 模式深度解析
- S012: Chain of Thought 原理
- S013: Think-Action-Observe 循环
- S014: 天气查询案例
- S015: CoT vs ReAct 对比

### 第四章：Agent 架构设计
- S017: 四大支柱（规划/记忆/工具/反思）
- S018: LLM 能力边界与补齐策略

### 第五章：Function Calling 实战
- S019b: 工作流决策矩阵
- S020: 决策矩阵详解
- S022: 核心误区澄清
- S023: 六步流程详解
- S024: 工具定义规范
- S025: description 字段的重要性
- S026: 黄金模板
- S027: tool_choice 参数
- S028: 串行 vs 并行调用
- S029: 常见问题排查

## 🔧 技术栈

- **前端框架**：纯 Vanilla JS（无依赖）
- **动画库**：GSAP 3.12.2
- **样式**：CSS3 (Flexbox + Grid + CSS Variables)
- **图标**：Emoji (无需字体库)

## 📝 开发指南

### 添加新幻灯片
1. 在 `slides/` 目录创建新 HTML 文件（如 `S031-new-slide.html`）
2. 在 `js/main.js` 的 `slides` 数组中添加配置：
   ```javascript
   { id: 31, file: 'S031-new-slide.html', title: '新章节标题' }
   ```
3. 刷新页面即可看到新幻灯片

### 添加交互组件
1. 在幻灯片 HTML 中添加交互元素（按钮/输入框等）
2. 在 `js/interactive.js` 中添加事件监听器
3. 使用 GSAP 实现动画效果

### 样式定制
- 全局颜色变量定义在 `css/main.css` 的 `:root` 中
- 修改 `--primary-color`、`--accent-color` 等变量即可更换主题色

## 🐛 已知问题

1. **Safari 兼容性**：部分 CSS `backdrop-filter` 效果在旧版 Safari 中可能不生效
2. **移动端性能**：星空背景在低端移动设备上可能卡顿（可通过 `main.css` 中的 `@media` 查询禁用）
3. **打印支持**：当前版本不支持打印输出（幻灯片为固定视口设计）

## 📄 许可证

本项目仅供教学使用，未经授权不得用于商业用途。

## 🙏 致谢

- 动画库：[GSAP](https://greensock.com/gsap/)
- 设计灵感：Apple Keynote + Reveal.js
- 星空效果参考：CodePen 社区

---

**最后更新**：2026-03-05
**版本**：v1.0.0
**维护者**：LLM Agent 课程组
