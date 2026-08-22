# Ingest 日志（append-only）

## [2026-06-17] ingest | 编译式 RAG 三页组首次入库

**源文件**（raw/，只读）
- `karpathy-llm-wiki.md` —— 概念源头
- `gbrain-implementation.md` —— 工程实现
- `preregistered-critique.md` —— 预注册证伪

**新增页**（wiki/）
- `compiled-rag.md` · type=concept · sources=[karpathy-llm-wiki.md]
- `gbrain.md` · type=system · sources=[gbrain-implementation.md]
- `compiled-rag-cost.md` · type=debate · sources=[karpathy-llm-wiki.md + preregistered-critique.md]（概念源 + 证伪源）

**互链**
- `compiled-rag` ↔ `gbrain`
- `compiled-rag` ↔ `compiled-rag-cost`
- `gbrain` ↔ `compiled-rag-cost`

**索引更新**
- `wiki/index.md` 已按 type 三分区重写，补「互链关系」图

## [2026-06-17] ingest | 三页组引文规范化（schema 合规修复）

**触发**：核对 schema（"页面之间用 `[[slug]]` 互链"）后，发现首版三页正文存在以下违规点——
- `[[karpathy-llm-wiki]]` / `[[gbrain-implementation]]` / `[[preregistered-critique]]` 把 raw 文件名当 slug
- `[[concept]]` / `[[system]]` / `[[debate]]` 把 type 当 slug
- `[[index]]` / `[[log]]` 指向未建页

按 schema，raw 文件名只能出现在 frontmatter `sources`；正文中以 `[[slug]]` 形式出现的必须是 wiki 内已建页（当前只有 compiled-rag / gbrain / compiled-rag-cost 三页）。

**修复**（raw/ 全程未读未改）
- `compiled-rag.md`：移除 `[[karpathy-llm-wiki]]` 与 `[[concept]]/[[system]]/[[debate]]` 误用
- `gbrain.md`：移除 `[[gbrain-implementation]]`，将 `[[index]]` / `[[log]]` 改为普通文本（指 index.md / log.md）
- `compiled-rag-cost.md`：移除 `[[preregistered-critique]]`，反方改为普通文本引用，正方保留 `[[compiled-rag]]`
- 三页之间 `compiled-rag ↔ gbrain ↔ compiled-rag-cost` 互链完整闭合

**未变更**
- 三页 frontmatter（title / type / sources / updated）保持不变
- 主体内容（核心主张、三层架构、20× 证据、适用边界表）保持不变
- `index.md` 结构与互链图保持不变
- raw/ 三篇未读未改

## [2026-06-17] ingest | 三页组按 schema 重编译（核对无变更）

**触发**：按用户指令执行一次完整 ingest——重读 raw/ 三篇 → 与 wiki/ 三页逐项核对 schema 合规性

**核对项与结果**
- raw/ 三篇（karpathy-llm-wiki.md / gbrain-implementation.md / preregistered-critique.md）均未改
- 三页 frontmatter 完整：`title / type / sources / updated` 字段齐备
- type 分区与固定文件名一致：`compiled-rag.md=concept`、`gbrain.md=system`、`compiled-rag-cost.md=debate`
- 互链闭合：`compiled-rag ↔ gbrain`、`compiled-rag ↔ compiled-rag-cost`、`gbrain ↔ compiled-rag-cost` 三对完整，无断链
- 主张与证据对齐 raw 来源：165 万 vs 8 万 token（≈20× 反向证据）/ Storage·Graph·Retrieval 三层 / 一次编译长期摊薄

**未变更**
- raw/ 三篇（按 schema 只读不改）
- wiki/ 三页正文与 frontmatter（已合规，无须重写）
- wiki/index.md（按 type 三分区 + 互链图已完整）
