# Wiki 内容目录

> 按 type 分区列出所有页面。查询入口。

## concept（概念）

- [[compiled-rag]] —— 编译式 RAG：先编译后查询、产物即资产的范式，核心卖点是"一次投入、长期摊薄"

## system（系统）

- [[gbrain]] —— 编译式 RAG 的开源生产实现：Storage / Graph / Retrieval 三层 + 零 LLM 自动建图

## debate（争议）

- [[compiled-rag-cost]] —— 编译式查询 ≈ 165 万 token vs 向量 RAG ≈ 8 万 token，"摊薄省成本"卖点被预注册实验证伪

## 互链关系

```
compiled-rag     ←→  gbrain             （概念 ↔ 系统落地）
compiled-rag     ←→  compiled-rag-cost  （概念 ↔ 证伪争议）
gbrain           ←→  compiled-rag-cost  （系统实现 ↔ 成本质疑）
```
