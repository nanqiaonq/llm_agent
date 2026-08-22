# HTML 课件改稿方案：从“传统 RAG 痛点”改为“机器索引 vs 可读 wiki”

> 目标目录：`/Users/mac/大模型资料/编译式RAG/compiled-rag-llm-wiki-html`
> 目标：让 HTML 课件与新版 Markdown 正课口径一致。
> 核心改动：不要再把第二章讲成“传统 RAG 的两个缺陷，编译式 RAG 来解决”；改成“传统 RAG 与编译式 RAG 都依赖中间产物，区别是机器索引 vs 可读 wiki”。

---

## 1. 全局口径

旧口径：

```text
传统 RAG 的痛点 = 答案抖动 + 索引滞后
编译式 RAG = 解决这些痛点
```

新口径：

```text
传统 RAG 和编译式 RAG 都有中间产物，也都需要在源材料变化后更新中间产物。
传统 RAG 的中间产物是 chunks / embeddings / vector index。
编译式 RAG 的中间产物是 markdown wiki / index.md / log.md。
区别不在“谁自动同步”，而在“中间产物能否被人读、审、改、追踪”。
```

禁止继续使用的主线：

```text
传统 RAG 两个结构性缺陷
缺陷一：答案抖动
缺陷二：文档改了还答旧值
两个缺陷，同一个根因
传统 RAG 病灶
编译式治好了这两个问题
```

允许保留但必须改口径的内容：

- 答案抖动：可以作为 query-time 临时综合的常见代价，但不要说成编译式彻底解决。
- 索引滞后：可以作为传统 RAG 的索引快照演示，但必须说明编译式 wiki 未重新 ingest 也会答旧值。
- Query 不读 raw：可以保留，但必须加前提“wiki 已由最新 raw 重新 ingest”。

---

## 2. 元数据文件必须先改

### 2.1 `slide_structure.json`

当前章节：

```json
{ "chapter_id": "C2", "title": "传统 RAG 的痛点", "slide_ids": ["S003", "S004", "S005"] }
```

建议改为：

```json
{ "chapter_id": "C2", "title": "机器索引 vs 可读 wiki", "slide_ids": ["S003", "S004", "S005"] }
```

建议同步修改 slide title：

```json
{
  "id": "S003",
  "title": "传统 RAG：机器索引中间产物"
}
```

```json
{
  "id": "S004",
  "title": "中间产物滞后：不更新就会答旧值"
}
```

```json
{
  "id": "S005",
  "title": "真正分野：索引黑箱 vs wiki 可治理"
}
```

如果 `S006b` / `S006c` 已被实际加载到 `index.html`，也要同步检查标题。

### 2.2 `courseware-brief.md`

当前：

```markdown
B 痛点：P3 答案抖动【🟡】 / P4 索引滞后【🟡】 / P5 共同根因（引出"消化一次反复用"）
```

建议改为：

```markdown
B 范式对比：P3 传统 RAG 的机器索引 / P4 中间产物不更新就会答旧值 / P5 索引黑箱 vs wiki 可治理
```

当前灵魂交互描述：

```markdown
P6 解释vs编译双轨模拟器（点"提问"看上轨每次重跑且抖、下轨秒回且稳）
```

建议改为：

```markdown
P6 机器索引 vs 可读 wiki 双轨模拟器（点"提问"看上轨围绕机器索引召回片段并临时综合，下轨读取已编译 wiki 产物；强调二者都有中间产物，区别是机器索引 vs 可读 wiki）
```

当前核心目标：

```markdown
编译式 RAG（LLM Wiki）把知识从「一次性消费」变成「复利资产」
```

可保留，但建议补一句：

```markdown
这里的“复利资产”指知识结构与跨源合成沉淀，不等于单次 query token 更低，也不等于 raw 更新后自动同步。
```

---

## 3. 页面逐项修改

### 3.1 `slides/T2-pain-intro.html`

当前标题：

```html
<h2 class="trans-title">传统 RAG 的痛点</h2>
<p class="trans-sub">先看到问题，再谈方案</p>
```

建议改为：

```html
<h2 class="trans-title">机器索引 vs 可读 wiki</h2>
<p class="trans-sub">不是谁更先进，而是中间产物不同</p>
```

CSS 顶部注释也改：

```css
/* T2 章节过渡门牌 · 第二章 机器索引 vs 可读 wiki · 暖色 */
```

---

### 3.2 `slides/S003-answer-jitter.html`

当前页面主线：

```html
缺陷一：同一问题，两次答案不一样
三层随机性叠加——知识从不固化，每次查询都重新「解释」一遍，答案天然会抖。
```

建议不要继续用“缺陷一”主线。推荐重构为：

```html
<h2 class="s003-title">传统 RAG：把资料组织成机器索引</h2>
<p class="s003-subtitle">raw docs → chunks / embeddings / vector index → query-time retrieve</p>
```

页面内容建议改为三段管线：

```text
源文档
  → chunk + embedding
  → 向量索引
  → 查询时召回 top-k
  → LLM 临时综合
```

底部结论建议：

```html
传统 RAG 不是落后方案。它强在规模、速度和高频更新；代价是跨源合成多发生在查询期，中间产物不适合人类直接审计。
```

如果不想大改交互，可以保留“双答案”交互，但必须改标题和结论：

标题：

```html
<h2 class="s003-title">查询期临时综合：开放问题会出现侧重点漂移</h2>
```

底部结论：

```html
这不是传统 RAG 独有“病灶”，而是 query-time 检索 + 生成系统的常见代价。编译式可以减少召回/排序带来的结论漂移，但不能消除 LLM 生成层的措辞变化。
```

三层归因卡片可以保留，但文案要从“天然会抖/结构性缺陷”改成“查询期临时综合的常见代价”。

---

### 3.3 `slides/S004-stale-index.html`

这页交互可以保留，但必须改标题和结论。

当前标题：

```html
<h2 class="s004-title">缺陷二：文档改了，它还在答旧值</h2>
<p class="s004-subtitle">点价格数字亲手改它——索引快照不动，查询结果仍命中旧值</p>
```

建议改为：

```html
<h2 class="s004-title">中间产物滞后：索引不更新就会答旧值</h2>
<p class="s004-subtitle">源文档已变，但向量索引仍是旧快照；查询命中的是索引，不是当前源文件</p>
```

当前警示横条：

```html
源文档已更新——但索引仍是旧快照，查询命中旧值，不报任何错。
这是最危险的一类问题：它不会崩，它只是悄悄地错。
```

建议改为：

```html
源文档已更新——但中间产物没有更新，查询仍命中旧快照。传统 RAG 要重建/增量更新索引；编译式 RAG 也要重新 ingest wiki。
```

底部提示建议改为：

```html
点价格数字可直接编辑；索引和查询结果会保持旧值不变。注意：这不是传统 RAG 独有，编译式 wiki 未重新编译时也会读旧产物。
```

---

### 3.4 `slides/S005-common-root-cause.html`

这是冲突最严重的一页，建议整体重构。

当前：

```html
<h2 class="s005-title">根因：每次查询都从头消化、不积累</h2>
<p class="s005-hooksub">两个缺陷，同一个根因</p>
缺陷 ① 答案抖动
缺陷 ② 索引滞后
同一根因：每次从头消化、知识从不沉淀
```

建议新标题：

```html
<h2 class="s005-title">共同边界：源材料变了，中间产物都要更新</h2>
<p class="s005-hooksub">传统 RAG 更新索引，编译式 RAG 更新 wiki</p>
```

页面建议改为左右对照：

左栏：

```text
传统 RAG
source doc: 99 → 199
vector index 仍是 99
query 命中旧 chunk
必须 rebuild / incremental index
```

右栏：

```text
编译式 RAG
raw/: 20 → 50
wiki/ 仍是 20
query 读取旧 wiki
必须 re-ingest / compile
```

底部根因卡：

```html
共同点：二者都依赖中间产物，中间产物不更新就会使用旧内容。
真正差异：传统 RAG 的中间产物是机器索引；编译式 RAG 的中间产物是可读 wiki。
```

追问改为：

```html
所以问题不是“谁自动同步”，而是：我们想维护一个机器索引，还是一份可读、可 diff、可审计的 wiki？
```

---

### 3.5 `slides/S006-dual-track-simulator.html`

当前左路过度表达为：

```html
这类问题的每一个，都回原料从头重走
检索 → 拼 prompt → 临时归纳
用完即焚 · 什么都没沉淀下来
```

建议改为：

```html
<div class="s006-path-name">每个问题都从机器索引召回片段，再临时综合</div>
```

步骤改为：

```text
查索引 → 取 top-k chunks → 临时综合
```

`用完即焚 · 什么都没沉淀下来` 改为：

```html
答案不沉淀为可维护知识页
```

当前右路：

```html
这类问题换啥问法，都命中同一产物
编译产物 · wiki/ · 永久复用
```

建议改为：

```html
这类问题优先读取同一批 wiki 产物
```

```html
编译产物 · wiki/ · 可复用 · 需随 raw 更新而 re-ingest
```

底部提示改为：

```html
准备好后点「首次提问」——左路围绕索引临时组织答案，右路先生成可读 wiki 再复用
```

---

### 3.6 `slides/S006b-interpret-mechanism.html`

当前标题可能是：

```html
解释执行的内在过程：逐个 chunk 算相似度
```

建议改为：

```html
向量 RAG 的内在过程：从机器索引召回 top-k chunks
```

如果页面里有“无中间产物”“每次回原料从头读”等表述，必须改成：

```markdown
传统 RAG 有中间产物：chunk / embedding / vector index。查询时不是直接读当前源文件，而是围绕索引召回片段并临时综合。
```

---

### 3.7 `slides/S006c-compile-mechanism.html`

当前副标题：

```html
不向量化、不碰 raw——agent 像查书的目录一样，读 index.md 定位到相关页，再沿 [[链接]] 顺藤摸瓜读结论
```

建议改为：

```html
查询时不读 raw，而是读取当前 wiki——前提是 wiki 已由最新 raw 重新 ingest
```

当前底部：

```html
同一份已编译 wiki：每个问题都先读 index.md 目录定位、再沿 [[链接]] 扩展——不同问题进不同入口、走不同路径，但都不碰 raw
```

建议改为：

```html
同一份已编译 wiki：每个问题先读 index.md 再沿链接扩展。注意：Query 读的是当前 wiki，不是当前 raw；raw 更新后必须重新 ingest。
```

当前对比卡：

```html
解释执行：无目录，只能把问题向量化、去一堆碎 chunk 里算距离猜最近邻
```

建议改为：

```html
向量 RAG：有机器索引，查询时把问题向量化，召回 top-k chunks，再临时综合
```

---

### 3.8 `slides/S007-cost-compounding-curve.html`

这页需要搜索是否有“编译式更省成本/成本被均摊/查询更便宜”等暗示。

如果有，必须改为：

```html
复利资产指“知识结构复用”和“跨源合成沉淀”，不是单次 query token 更低。
```

建议加 caveat：

```html
复利不等于省 token；成本边界见后面的 20× 数据。
```

---

### 3.9 `slides/S009-three-layer-ownership.html`

当前底部或层说明可能有：

```html
raw/ 人类只读
编译：只读 raw → 只写 wiki
```

建议更精确：

```html
raw/ 是事实源头；Agent 在 Ingest 时只读不写。人类可以更新 raw，但更新后需要重新 Ingest。
```

`wiki/ LLM 可写` 保留。

中间箭头：

```html
ingest / re-ingest：读 raw → 更新 wiki
```

---

### 3.10 `slides/S010-compile-grows-wiki.html`

这页可以保留“编译过程长出 wiki”，但要加边界：

```html
wiki 是当前 raw 的编译产物；raw 更新后，需要再次 ingest 才会长出新版本。
```

如果有“永久复用”“之后不再关心 raw”等表达，改为：

```html
可复用，但不是自动同步；更新靠 re-ingest / Lint / log 治理。
```

---

### 3.11 `slides/S011-two-special-files.html`

这页基本可保留。

建议补充 `log.md` 文案：

```html
log.md 记录每次 ingest / re-ingest，让 wiki 是否更新过有迹可查。
```

---

### 3.12 `slides/S012-three-ops-readwrite.html`

当前 Query 描述：

```html
只读 wiki/，从 index.md 导航定位相关页，给出带引用的回答，不重读 raw/
```

建议补前提：

```html
前提：wiki 已由最新 raw ingest；raw 更新后必须重新 Ingest，Query 才能读到新事实。
```

当前 raw 层：

```html
事实源头，编译的输入。Ingest 只 Read 不 Write——放进去就不再改。
```

建议改为：

```html
事实源头，编译的输入。Agent Ingest 时只 Read 不 Write；人类可以更新 raw，但更新后需要重新 Ingest。
```

---

### 3.13 `slides/S013-21x-cost-tension.html`

这页基本正确，建议保留。

建议在红线结论中补一句：

```html
编译式既不是自动同步方案，也不是省 token 方案；它买的是稳定知识的可读合成与审计治理。
```

当前：

```html
编译式 RAG 的价值不在省钱——它省的是跨源合成的重复劳动，换来的是更高的合成质量与可审计性。
```

建议改为：

```html
编译式 RAG 的价值不在省钱，也不在自动同步——它买的是稳定知识的可读合成、审计治理与跨源结构复用。
```

---

### 3.14 `slides/S014-four-paradigm-selection.html`

当前向量 RAG 主要代价：

```html
答案抖动、索引滞后（第一章的两个缺陷）
```

必须改为：

```html
查询期临时综合、索引不可读、源变更后需重建/增量更新
```

当前编译式 RAG 主要代价：

```html
查询约 20× token、有规模天花板、关系推理弱
```

建议改为：

```html
查询约 20× token、raw 变更后需重新 ingest、有规模天花板、编译可能固化错误
```

当前向量 RAG 执行方式：

```html
解释执行——查询期临时检索片段、拼 prompt、当场归纳
```

建议改为：

```html
索引检索执行——查询期从机器索引召回片段，再临时综合
```

当前 GraphRAG 代价：

```html
大模型构图成本高、结果不确定、需图数据库基础设施
```

建议改为：

```html
大模型构图成本高、结果不确定；官方默认输出 Parquet 图结构产物，embeddings 写入配置的 vector store
```

红线里：

```html
一个用大模型从散文里抽实体（需图数据库等专用基础设施）
```

建议改为：

```html
一个用大模型从散文里抽实体，并生成图结构与向量存储相关产物
```

---

### 3.15 `slides/S015-mind-map-summary.html`

当前里程碑 ①：

```html
C1 · 痛点
知识不沉淀
答案抖动
索引滞后
每次从头消化原始资料，临时推断、用完即焚
```

建议改为：

```html
C1 · 分野
中间产物不同
机器索引
可读 wiki
传统 RAG 维护索引，编译式 RAG 维护 wiki；源材料变化后二者都要更新中间产物
```

当前卡片 1：

```html
解释执行的三个代价
知识不积累 · 答案抖动 · 跨文档关联只能临时推断
根因：每次查询都从头消化原始资料——这不是某个工具写得不好，是执行方式本身的结构性代价。
```

建议改为：

```html
两种中间产物
机器索引 · 可读 wiki · 都需更新
传统 RAG 强在规模、速度和高频更新；编译式强在稳定知识的可读合成与审计治理。
```

当前卡片 2：

```html
先把原料编译成互链 wiki，查询只读产物、不重读原料
代价从查询期转移到编译期；首次付出的编译成本被每次查询均摊——知识成为复利资产。
```

建议改为：

```html
先把稳定知识编译成互链 wiki，查询读取当前 wiki 产物
raw 更新后要重新 ingest。复利资产指知识结构复用，不等于 query token 更低。
```

结语条建议改为：

```html
判断“我的场景该维护机器索引，还是可读 wiki”比学会怎么搭它同样重要。
```

---

## 4. `index.html` 和加载清单

需要检查 `index.html` 是否硬编码章节名或 slide title。

运行：

```bash
rg -n "传统 RAG 的痛点|答案抖动|索引滞后|两个缺陷|缺陷一|缺陷二|痛点|解释执行的三个代价" /Users/mac/大模型资料/编译式RAG/compiled-rag-llm-wiki-html/index.html
```

如果命中菜单、目录、进度条标题，必须同步改。

另请确认 `index.html` 实际加载哪些 slides。目录里存在 `S006b`、`S006c`，但 `slide_structure.json` 只列了 15 页。若这两个页面实际被加载，也必须同步修改；若未加载，至少要避免后续恢复生成时旧文案再次进入主流程。

---

## 5. 推荐的新 15 页内容结构

不要求增减页数，可以在原页面基础上换文案：

```text
S001 封面：保留
S002 你大概率见过的别扭：改成“RAG 有机器索引，为什么还想要 wiki？”
T2 章节页：机器索引 vs 可读 wiki
S003 传统 RAG：资料如何变成机器索引
S004 中间产物滞后：索引不更新就会答旧值
S005 共同边界：传统 RAG 更新索引，编译式更新 wiki
T3 章节页：核心隐喻：编译 vs 解释
S006 双轨模拟器：机器索引临时综合 vs 可读 wiki 复用
S006b 向量索引检索内部
S006c 编译执行内部：当前 wiki / re-ingest 前提
S007 复利资产：知识结构复用，不等于省 token
S008 DSPy 辨析：保留
S009 三层架构：raw 文案改为“Agent 不写 raw；人类可更新 raw，更新后需 re-ingest”
S010 编译生长 wiki：保留，加“raw 更新后需重新 ingest”
S011 index/log：保留，加 log 记录 re-ingest
S012 三操作：补 Query 前提
S013 20× 成本：保留，补“不自动同步”
S014 四范式选型：改表格代价
S015 总结：改“痛点”为“中间产物分野”
```

注意：如果最终仍保持 15 页，`S006b/S006c` 可能是隐藏/补充页；请以 `index.html` 实际加载清单为准。

---

## 6. 全文搜索与验收命令

修改后运行：

```bash
rg -n "传统 RAG 的痛点|答案抖动|索引滞后|两个缺陷|缺陷一|缺陷二|两个痛点|痛点|病灶|治成|永久复用|秒回且稳|不碰 raw|不重读 raw|用完即焚" /Users/mac/大模型资料/编译式RAG/compiled-rag-llm-wiki-html
```

这些词不是绝对不能出现，但出现时必须满足新口径：

- “答案抖动”只能作为 query-time 临时综合的常见代价，不作为编译式要彻底解决的传统 RAG 独有缺陷。
- “索引滞后”只能作为传统 RAG 的索引快照演示，同时要说明编译式 wiki 未 re-ingest 也会旧。
- “不碰 raw / 不重读 raw”必须带前提：当前 wiki 已经由最新 raw ingest。
- “永久复用 / 秒回且稳 / 用完即焚”建议删除或改弱。

---

## 7. 最终验收标准

HTML 课件改完后，应满足：

1. 不再出现章节名 `传统 RAG 的痛点`。
2. 不再用 `缺陷一 / 缺陷二` 作为主标题。
3. 不再说 `两个缺陷，同一个根因`。
4. 不再把 `索引滞后` 说成传统 RAG 独有问题。
5. 明确说清：传统 RAG 和编译式 RAG 都需要更新中间产物。
6. 明确说清：区别是 `机器索引` vs `可读 wiki`。
7. S006 / S006c 不再暗示编译式天然读到最新 raw。
8. S012 明确 Query 只读 wiki 的前提是 wiki 已由最新 raw ingest。
9. S014 选型表同步新口径。
10. S015 总结同步新口径。
11. `courseware-brief.md`、`slide_structure.json`、`index.html` 也同步，否则后续 resume / 再生成会把旧标题带回来。

