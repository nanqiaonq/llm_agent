# Harness Engineering 驾驭工程 · 第一节 HTML 课件

基于原生 HTML / CSS / JS 的单页课件（SPA），共 26 页 / 4 章。

## 快速运行

在课件根目录启动一个静态 HTTP 服务，然后浏览器打开即可：

```bash
cd /Users/mac/PycharmProjects/JupyterProject/HarnessEngineering/html-courseware
python3 -m http.server 8765
```

浏览器访问：

```
http://localhost:8765/
```

直接跳转到第 N 页（1-indexed）：

```
http://localhost:8765/#N     # 例如 #21 = 第 21 页（三支柱总图）
```

## 快捷键

| 键 | 作用 |
|---|---|
| `←` / `↑` | 上一页 |
| `→` / `↓` / `空格` | 下一页 |
| `Home` / `End` | 首页 / 末页 |
| `M` | 打开 / 关闭侧边目录 |
| `F` | 切换全屏 |
| `T` | 钢笔模式（光标轨迹） |
| `D` | 画板模式（标注涂鸦） |
| `Esc` | 清画板 / 关菜单 / 退出钢笔 |

移动端：左右滑动切页。

## 停止服务

```bash
lsof -ti:8765 | xargs kill
```

## 目录结构

```
html-courseware/
├── index.html              # 入口页（加载 main.js + 所有 slides）
├── css/                    # 全局样式（字体、配色、玻璃态变量）
├── js/main.js              # SPA 路由、快捷键、菜单、工具栏
├── slides/                 # 26 个独立 slide（S001 ~ S030）
├── slide_structure.json    # slide 元数据（章节归属、布局类型）
└── README.md
```

每个 `slides/SNNN-*.html` 是自包含片段（自己的 `<style>` + `<script>`），通过 `main.js` 按 `slideFiles[]` 顺序 fetch 注入。

## 修改课件

- **改内容**：直接编辑 `slides/SNNN-*.html`，刷新浏览器即可（无构建步骤）
- **调顺序**：修改 `js/main.js` 里的 `slideFiles[]` 数组和 `slideTitles[]` 对应项
- **加新页**：在 `slides/` 新增 HTML 片段，追加到 `slideFiles[]` 与 `slideTitles[]`，同步更新 `slide_structure.json`

CSS 变量定义在 `css/main.css`（`--primary` / `--accent` / `--card-bg` / `--card-border` 等），所有 slide 共享这套变量，不要在 slide 内部硬编码色值。
