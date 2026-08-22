---
title: GBrain
type: system
sources:
  - gbrain-implementation.md
updated: 2026-06-17
---

# GBrain

## 定位

GBrain 是 [[compiled-rag|编译式 RAG]] 的开源生产实现：把"一次性编译、人/机可读 wiki"这个**概念**落成带 Storage / Graph / Retrieval 三层的工程系统。

> 把概念落成带 Storage / Graph / Retrieval 的工程系统。
> ——见 frontmatter sources（gbrain-implementation.md）

## 架构三层

| 层 | 职责 |
|---|---|
| **Storage** | 持久化 wiki 页（frontmatter + 正文 + `[[slug]]` 链接） |
| **Graph** | 维护页面互链图（slug → 邻居），支撑 [[compiled-rag|概念]] / system / debate 之间的导航 |
| **Retrieval** | ingest 时建图，query 时按图遍历定位相关页，避免运行时切块与向量召回 |

## 闭环能力

- **ingest**：从 raw/ 读源 → 按 schema 编译成 wiki 页 → 更新 index.md 与 log.md
- **query**：从 index.md 导航定位 → 读产物页 → 给带引用的回答；**不重读 raw/**
- **lint**：检查断链、孤儿页、过期内容

## 零 LLM 建图

GBrain 支持**零 LLM 自动建图**——页面间的 `[[slug]]` 互链可以由规则/启发式生成，不强依赖 LLM 在 ingest 阶段对每条边做语义判断。这大幅降低了建库成本，也是它区别于"必须 LLM 介入才能建库"的同类系统的一个关键工程取舍。

## 与上下游的关系

- 上游概念：[[compiled-rag]]
- 成本争议（涉及查询侧实现）：[[compiled-rag-cost]]
