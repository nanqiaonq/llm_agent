# Harness Engineering L4 · Hermes + Nudge + F5

Harness Engineering 驾驭工程 · 第四节。纯静态 HTML 课件，33 页，主题三件套：Hermes 记忆系统、Nudge 机制、F5 取舍分析框架。本讲灵魂是 F5 三对张力评价框架（静态↔动态 / 信任↔约束 / 集中↔分治）。

目标受众：已完成前三节课的学员，熟悉 LangGraph/LangChain 中间件、子代理、HITL 概念。

---

## 目录结构

```
hermes-html-ppt/
├── index.html              # 入口文件，直接浏览器打开
├── README.md               # 本文档
├── css/
│   └── main.css            # 全局样式（CSS 变量内嵌，无外部 manifest 依赖）
├── js/
│   ├── main.js             # 主逻辑：slide 加载 / 路由 / 进度条 / 目录菜单
│   └── interactive.js      # 交互注册：钢笔拖尾 / 画板 / 颜色选择 / 全屏 / slideHooks
└── slides/                 # 33 个 slide 页面（S01-S33）
    ├── S01-cover.html
    ├── ...
    └── S33-honest-statement.html
```

---

## 技术栈

- 纯静态：HTML + CSS + 原生 JS，无构建工具
- 外部 CDN：GSAP 3.12.5（动画）、Google Fonts（Inter / Sora / Noto Sans SC / JetBrains Mono）
- 浏览器要求：Chrome / Edge / Safari 最近 2 个主版本均可

---

## 快速启动

**方式 A（推荐）**：在项目根目录启动本地静态服务器：

```bash
cd hermes-html-ppt
python3 -m http.server 8000
```

然后访问 `http://localhost:8000`。

**方式 B**：VS Code 安装 Live Server 插件，右键 `index.html` → Open with Live Server。

---

## 工具栏

左侧垂直排列五个按钮，讲课时均有用途：

| 按键 | 功能 |
|------|------|
| M | 目录菜单切换 |
| T | 钢笔拖尾（鼠标轨迹高亮，讲师指引用） |
| D | 画板模式（自由绘制，标注用） |
| 颜色选择器 | 4 色：琥珀 `#d4a574` / 冷青 `#7dd3c0` / 米白 `#e8ecf0` / 警示红 `#e57373` |
| F | 全屏 |

---

## 键盘导航

- 左箭头 / 右箭头 / Space：上一页 / 下一页
- M / T / D / F：触发对应工具栏功能
- Esc 或数字键：可能用于关闭目录菜单，具体行为建议实际操作确认

---

## 章节结构

| 范围 | 章节 | 内容 |
|------|------|------|
| S01-S05 | 开篇与共识 | Hermes 出场 / Harness Engineering 共识 / 与 OpenClaw 对比 |
| S06-S13 | 第一章 · 记忆系统 | 冷热记忆 / SQLite 持久化 / FTS5 双索引 / LLM 摘要 / 8 Provider 全景 |
| S14-S22 | 第二章 · Nudge 机制 | 技能四源 / 双计数器 / 决策时机 / 4 重约束 / Prompt Reflection / Skill Commit / MVP Demo / Nudge 全流程动画 |
| S23-S30 | 第三章 · F5 取舍分析 | 三轴坐标 / 动态轴散点 / 约束矩阵 / ACP 双入口 / F5 表格 / F5 演示 / 关键词映射 |
| S31-S33 | 总结与诚实声明 | Takeaways / Next Hook / Honest Statement |

---

## 维护说明

- **修改单页**：直接编辑 `slides/S{XX}-*.html`
- **修改总页码或目录**：编辑 `js/main.js` 顶部的 `slideFiles` / `slideTitles` / `chapters` 三个数组（已硬编码，不读 JSON）
- **修改全局视觉变量**：编辑 `css/main.css` 顶部 `:root` 的 CSS 变量
- **修改交互逻辑**（钢笔 / 画板 / 颜色）：编辑 `js/interactive.js`
