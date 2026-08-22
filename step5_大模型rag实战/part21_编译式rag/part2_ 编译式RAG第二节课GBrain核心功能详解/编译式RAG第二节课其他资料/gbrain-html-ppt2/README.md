# GBrain：从笔记到会思考的大脑 — HTML 交互课件

编译式 RAG 的生产级实现，29 页交互式 HTML 课件。面向任何人（无需 Python/ML 背景），讲透 GBrain 这个 brain layer 的两大核心能力：**建图 Connect**（self-wiring 零 LLM 织成知识图谱）与 **读+想 Read & Think**（语义检索 + think 综合出带引用、带空白分析的答案）。

---

## 运行方式（重要）

本课件是**单页应用（SPA）**：`index.html` 通过 `fetch()` 动态加载 `slides/` 下的内容片段。

> ⚠️ **不能直接双击 `index.html` 打开。** `file://` 协议下浏览器 CORS 策略会拦截 `fetch()`，导致每页都显示"无法加载"，只剩外壳。**必须经 HTTP 服务访问。**

### 本地预览

```bash
cd "$(dirname "$0")"          # 进入课件目录
python3 -m http.server 8137   # 起一个静态服务器
```

浏览器打开 **http://localhost:8137/** 即可。

> 任意静态服务器均可，例如 `npx serve`、VS Code 的 Live Server 插件。

### 部署上线

整个目录是纯静态资源（无后端），可直接托管到 **GitHub Pages / Vercel / Netlify / Cloudflare Pages / nginx**，根目录指向 `index.html` 即可。

---

## 操作快捷键

| 操作 | 按键 |
|---|---|
| 上一页 | `←` / `↑` |
| 下一页 | `→` / `↓` / `空格` |
| 首页 / 末页 | `Home` / `End` |
| 目录 | `M` |
| 钢笔拖尾 | `T` |
| 画板 | `D` |
| 全屏 | `F` |
| 退出当前模式 | `Esc` |

触屏可左右滑动翻页。部分页面含 hover / 点击交互（建图演示、RRF 名次滑块、find_trajectory 时序对齐、search↔think 切换等）。

---

## 外部依赖

`index.html` 通过 CDN 引入 **Google Fonts**（Sora / Noto Sans SC / JetBrains Mono）和 **GSAP 3.12.5**。联网即可用；**纯内网 / 离线环境**需把这两项下载到本地并改 `index.html` 的引用，否则字体回退、交互页动画失效。

---

## 目录结构

```
index.html          外壳：工具栏 / 进度条 / 侧边菜单 / 翻页 / 双 canvas
css/main.css        P06 极简钢蓝数据感主题（CSS 变量 + 通用样式）
js/main.js          控制器：导航 / 菜单 / 快捷键 / 钢笔 / 画板 / loadSlide()
js/interactive.js   重交互页 slideHooks 注册表（每页一个 hook + cleanup）
slides/             29 个 slide 内容片段
                      S001–S024 = 正文页
                      T1–T4     = 4 张阶段过渡页
_pipeline/          生成过程中间产物（设计文档 / 审计截图 / 流水线状态），
                      运行时不加载；保留用于 html-courseware-team --resume 续传与再编辑
```

新增或删减页面时，需同步 `js/main.js` 顶部的三个数组：`slideFiles` / `slideTitles` / `chapters`（文件内 T6b 自检会校验三者长度一致）。

---

## 内容结构（6 阶段 / 29 页）

```
开篇与全景  →  能力一·建图  →  支撑层·存与取  →  能力二·读+想  →  生态与判断力  →  收尾
              (T1)            (T2)             (T3)            (T4)
```

最终带走的是**一把判断的尺**：拆开任何 RAG / 记忆系统的存储 / 检索 / 综合三层，判断 benchmark 诚不诚实、成本值不值。
