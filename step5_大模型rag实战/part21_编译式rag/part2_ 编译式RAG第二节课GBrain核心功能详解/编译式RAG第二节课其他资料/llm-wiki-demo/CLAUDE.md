# LLM Wiki Schema（规则层 · 人类撰写）

## 页面命名约定
- 所有页平铺在 wiki/ 下，文件名用小写连字符 slug，如 compile-vs-interpret.md
- 每页头部带 frontmatter：title / type / sources / updated
- type 字段标注页面类型：concept（概念）/ system（系统）/ debate（争议）

## 链接语法
- 页面之间用 `[[slug]]` 双方括号互链，如 `[[compiled-rag]]`

## 两个特殊文件
- wiki/index.md：内容目录，按 type 分区列出所有页 + 一行摘要 + 链接（查询入口）
- wiki/log.md：append-only 日志，每条以 "## [YYYY-MM-DD] ingest | 标题" 开头

## 三个操作
- Ingest：读 raw/ 新原料，按本 schema 在 wiki/ 编译互链页，更新 index/log。raw/ 只读不改。
- Query：只读 wiki/，从 index.md 导航定位相关页，给带引用的回答。不重读 raw/。
- Lint：检查断链、孤儿页、过期内容，报告问题。
