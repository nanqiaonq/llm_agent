# 编译式 RAG：LLM Wiki 原理 · 交互式 HTML 课件

一套 21 页的单页式（SPA）交互课件，讲解 Andrej Karpathy「LLM Wiki」提出的**编译式 RAG** 范式。核心主线：传统 RAG 与编译式 RAG **都依赖中间产物**，真正的分野是「机器索引 vs 可读 wiki」——而非「谁能自动同步」。

> 配套正课讲义：`../compiled-rag-llm-wiki/lesson.md`

---

## 快速启动

纯静态项目，无需构建、无需安装依赖。用任意本地静态服务器打开即可（幻灯片通过 `fetch` 动态加载，**必须经 HTTP 服务**，直接双击 `index.html` 会因 file:// 跨域而加载失败）：

```bash
cd compiled-rag-llm-wiki-html
python3 -m http.server 8753
```

浏览器访问 <http://localhost:8753/index.html>

> 动画依赖 GSAP 3.12.5（CDN 引入），首次加载需联网。

---

## 操作说明

| 操作 | 按键 / 控件 |
|---|---|
| 下一页 | `→` 或 `空格` |
| 上一页 | `←` |
| 关闭菜单 | `Esc` |
| 目录 | 工具栏「目录」(M) |
| 画笔拖尾 | 工具栏「钢笔」(T) |
| 画板涂写 | 工具栏「画板」(D) |
| 画笔颜色 | 工具栏「颜色」 |
| 全屏 | 工具栏「全屏」(F) |

部分页面（🔴 标记）含交互模拟器，按页内提示点击「提问 / 改数字 / 播放编译」等触发。

---

## 目录结构

```
compiled-rag-llm-wiki-html/
├── index.html          # 入口：SPA 容器 + 工具栏 + GSAP CDN
├── css/
│   └── main.css        # 全局样式（G1「月白灰蓝」配色）
├── js/
│   ├── main.js         # 导航 / 目录 / 翻页 / 钢笔画板；三数组 slideFiles·slideTitles·chapters
│   └── interactive.js  # 各交互页的 slideHooks 逻辑
├── slides/             # 21 页幻灯片
│   ├── S00x / S0xx     # 正文页
│   └── T2~T5           # 章节过渡门牌
└── README.md
```

幻灯片加载顺序由 `js/main.js` 的 `slideFiles` 数组定义；目录分组由 `chapters` 数组定义。新增 / 调整页面需同步这两个数组（`slideFiles.length === slideTitles.length`）。

---

## 课件构成（21 页 · 6 章）

| 章 | 页 | 主题 |
|---|---|---|
| 开场 | S001 / S002 | 封面 · 你大概率见过的别扭 |
| 机器索引 vs 可读 wiki | T2 · S003 · S004 · S005 | 答案抖动（生成层·两范式共有）· 中间产物滞后（通病）· 共同边界与真正分野 |
| 核心隐喻：编译 vs 解释 | T3 · S006 · S006b · S006c · S007 · S008 | 双轨模拟器 · 解释执行内部（算相似度）· 编译执行内部（读 index.md 导航）· 复利曲线 · DSPy 同名异义辨析 |
| LLM Wiki 怎么搭起来 | T4 · S009 · S010 · S011 · S012 | 三层架构所有权 · 编译生长 wiki · index.md/log.md · 三操作读写边界 |
| 成本真相与选型决策 | T5 · S013 · S014 | 20× 成本张力 · 四范式三元选型对照 |
| 收尾 | S015 | 编译式 RAG 心智地图 |

---

## 技术栈

原生 HTML / CSS / JavaScript（无框架、无打包、无后端）+ GSAP 动画。每页是独立的 HTML 片段，交互逻辑通过 `window.slideHooks['slides/xxx.html']` 注册，由 `main.js` 在切页时执行并清理。
