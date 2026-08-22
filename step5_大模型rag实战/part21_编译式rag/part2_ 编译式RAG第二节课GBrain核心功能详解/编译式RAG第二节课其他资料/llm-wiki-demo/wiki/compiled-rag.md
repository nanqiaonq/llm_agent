---
title: 编译式 RAG
type: concept
sources:
  - karpathy-llm-wiki.md
updated: 2026-06-17
---

# 编译式 RAG

## 主张

编译式 RAG 的核心范式：**先把原始资料一次性编译成结构化 wiki，查询时直接读产物**。

> 一次编译、长期复用 → 查询成本被摊薄 → 长期更省。
> ——见 frontmatter sources（karpathy-llm-wiki.md）

传统 RAG（检索增强生成）走"运行时检索 + 上下文注入"路径：每次查询都重新切块、嵌入、相似度匹配、再喂给 LLM。而编译式 RAG 把这一步**前移到 ingest 阶段**：在建库时把语料烧成"人/机可读"的结构化页面（concept / system / debate 三类，frontmatter + `[[slug]]` 互链），查询时直接读产物页，不再做向量召回。

## 关键差异

| 维度 | 传统向量 RAG | 编译式 RAG |
|---|---|---|
| 重活发生时机 | 每次查询（运行时） | 一次 ingest（编译时） |
| 查询侧成本 | 切块 + 嵌入 + 相似度匹配 + LLM | 读 wiki 页 + 轻量 LLM |
| 产出形态 | 临时拼接的 prompt 上下文 | 持久化、可审计、可版本化的 wiki |
| 资产属性 | 不可复用 | 复利资产（一次投入、长期摊薄） |

## 与系统、争议的关系

- 工程落地见 [[gbrain]] —— 把"编译 + 互链 + 查询"封装成带 Storage / Graph / Retrieval 的生产系统
- 核心卖点（"摊薄更省"）遭到 [[compiled-rag-cost]] 的反方证伪：实测 20× token 反向证据

## 反向引用

- [[gbrain]] 把本概念落成可运行的系统
- [[compiled-rag-cost]] 用预注册实验质疑本概念的成本假设
