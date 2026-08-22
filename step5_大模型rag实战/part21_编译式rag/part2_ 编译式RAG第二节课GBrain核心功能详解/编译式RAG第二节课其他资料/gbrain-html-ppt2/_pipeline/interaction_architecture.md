## Interaction Architecture
生成时间：2026-06-22
课程：GBrain：从笔记到会思考的大脑（编译式 RAG 的生产级实现）

> **状态：评估完成 · VOE 已拍板 · 已序列化**（2026-06-22）。全 24 页四轴评估完成。两个重交互页关键形态经用户 VOE 拍板锁定：
> - **C2(S008)**：分类型分批语义停顿（按 4 种关系类型 founded/works_at/invested_in/advises 分批飞边、每类停顿可讲解）+ ▶/⏸/⏭ 三按钮单步控制（动画页 ≥5 stage 必备）→ `🔴🔴` / interactive-eng。
> - **B2(S005)**：原地揭示（点大脑左/右半，本页原地展开该能力简介卡，不跳转）→ `🔴` / slide-writer。S005 为 🔴 不进 🔴🔴 列表，重交互(interactive-eng)清单维持 `["S008","S015"]`。
> slide_structure.json 已按 TEAM-CONTRACT 序列化并通过 validate_structure.py（Step 6）。

### 经验签收（Pre-flight）
- v1.5 审美协议 8 项 methodology + 4 项 pattern 已载入；本课件 P06 钢蓝深色 → 主题路由命中 `dark-scifi-grid`（weights / llm-intro-script 双锚点）。
- 锚点样本已读：`hermes-aesthetic-anchor/aesthetic_decisions.yaml`（AD-01~14 强制项 + opacity_dim_active / triple_pillar_unequal）；`s017-vector-simulator/ia_decision.yaml`（散点+SVG连线+state机 🔴🔴 决策范本，C2/E3 直接参照）。
- 固化经验模板复用：**逐步触发→危机弹窗**（不直接用，但 C2 的"逐条飞边+计数器同步+角标恒亮"是其同构变体：把抽象的"零 LLM 建图"变成可感知的视觉事件）；**散点定位图：标签常驻+hover亮化**（S012 embedding 语义空间示意页参照）。
- diversity_constraint：C2 图谱织网 + 逐条飞边的 typed 知识图谱自生长，非 9 样本任一现成 pattern（s017 是散点检索、s025 是生命周期蛇形，均不同），满足"至少 1 slide 完全不同"。
- 组件库命中：CL04(数据可视化/柱状图·滑块) → E3；CL05(流程图/路径追踪/决策树) → E2/H3；CL12(滑块/开关) → E3/A2；CL08(脉冲/聚光灯) → C2 角标。下游溯源标记 `←CL`。
- 反模式注入：`gsap_from_on_display_none`（C2/E3 hookFn 用 fromTo+paused+setTimeout）；`align_items_center_inherited`（所有自定义布局 slide 必须覆盖 main.css）；`missing_fm_defense_on_complex_interactive`（C2/E3 FM 顶部注释强制）。

---

### Lesson Thesis
- **核心命题**：让学员从"以为 RAG 都是切 chunk + 向量黑箱索引"到"理解 GBrain = 编译式 RAG 的两大能力（建图 Connect + 读想 Read&Think），知识既连得起来又想得明白，并掌握一把判断的尺拆任何 RAG/记忆系统"。
- **必须可见的机制**（不可视化就无法真正理解）：
  1. **C2 建图 self-wiring**：图怎么从孤立节点自己长出来，关系是人写的不是机器猜的，零 LLM（全课件第一记忆锚点，必须真实逐条飞边动画）。
  2. **E3 RRF 平权**：为什么不能直接加分（量纲不可比），名次平权 1/(k+rank)（滑块调名次实时看分）。
  3. **F1 search vs think**：同一句问题，search 给页面列表 vs think 给成文答案+citation。
  4. **F2 gap 空白分析**：think 诚实告诉你不知道什么，三信号。
- **目标学员误解 Top 3**：
  1. "RAG 都是切 chunk + 向量黑箱索引" → A2 打破（编译式 RAG 先编译成可读 wiki）。
  2. "知识图谱都得 LLM 抽实体推关系" → C2/C4 打破（self-wiring 解析显式 wikilink，零 LLM）。
  3. "benchmark 数字越高越好、可横向比" → H1 打破（两 benchmark 不在一个坐标系，严禁混引）。
- **成功判据**：学员能 (a) 区分编译式 vs 传统向量 RAG；(b) 解释 self-wiring 零 LLM 建图原理；(c) 说清 search 给页面 / think 给答案的差别；(d) 看懂 benchmark 口径差异、判断成本值不值。

### 教学目标锚定（course 级 · M1）
- **核心目标**（唯一）：学员学完能用"一把判断的尺"拆开任何 RAG/记忆系统的**存储 / 检索 / 综合**三层，判断 benchmark 诚不诚实、成本值不值。
  - `target_slide_ids`：S002(A2 起点·尺的第一次出现) / S006(B3 源真相⊥编译产物·尺的核心刻度) / S024(I1 尺完整成形)
  - **首个承载 slide = S002，位于第 2 页（前 40% = 前 9~10 页内）**，满足前置铁律。
  - `verify`：给学员一个陌生 RAG/记忆系统描述，能拆出它的存储/检索/综合三层、指出其 benchmark 口径是否可比、判断成本结构是否合理。
- **子目标**：
  1. 区分编译式 RAG（编译成可读 wiki）vs 传统向量 RAG（机器黑箱索引）→ S002
  2. 解释 self-wiring 零 LLM 把 wikilink 织成 typed 图谱 → S008
  3. 说清 search 给页面 vs think 给答案+citation+gap → S016 / S017
  4. 看懂两 benchmark 口径差异、严禁混引 → S021

---

### 逐页交互决策

| page_id | title | teaching_role | interaction_strength | chosen_pattern | soul_line | payoff | visual_hero | four_axis_score | justification | anti_pattern_check |
|---------|-------|--------------|---------------------|----------------|-----------|--------|-------------|-----------------|---------------|-------------------|
| S001 | GBrain：从笔记到会思考的大脑 | hook | 🟢 | T-COVER | 这不是又一个 RAG，它给你答案不是页面 | 钩子句"它不只给你页面，而是给你答案"立住 | 主标题+钩子句 | EP:3 MV:1 IC:3 OL:3=10 | 封面无需交互，视觉聚焦课程身份即可，加交互反而干扰 | true |
| S002 | 编译式 RAG 是什么 | mechanism | 🔴 | toggle-dual-path-highlight | RAG 分两种：黑箱机器索引 vs 可读可审计 wiki | 点击切到编译式链路，"查询直接读产物"这一步亮起 | 两条并置查询链路 | EP:3 MV:2 IC:2 OL:3=10 | toggle 切换让两条链路在"索引产物可读不可读"的分叉点逐段高亮可见；静态并列两栏看不出"同一查询走两条路"的因果分叉 | true |
| S003 | 三层 + 三操作骨架 | mechanism | 🟡 | layered-pyramid-reveal | raw 只读·wiki 是产物·CLAUDE.md 是规则，三操作循环驱动 | 三层金字塔逐层点亮 + Ingest/Query/Lint 循环箭头转起来 | 三层金字塔 | EP:2 MV:2 IC:3 OL:3=10 | 逐层揭示让"原料/产物/规则"的层级依赖可见；三操作循环箭头展示驱动关系，比静态堆叠更易理解层间关系 | true |
| S004 | GBrain 是什么 + 三层架构 | mechanism | 🟡 | layered-arch-support | Storage/Graph/Retrieval 三层协同托起顶层 think | 三层支撑柱点亮后，顶层 think 灯亮起"被托起" | 三层支撑+think 顶冠 | EP:2 MV:2 IC:3 OL:3=10 | 逐层揭示让"三层协同支撑 think"的承托结构可见；静态图难传达"think 站在三层之上"的依赖方向 | true |
| S005 | 两大核心能力总览 | mechanism | 🔴 | brain-dual-capability-reveal | GBrain 一个完整大脑，建图与读想两边都是它的本事 | 一个完整大脑两边都亮：左半连接发光、右半思考流出；点半脑原地展开该能力简介卡 | 完整点亮的大脑 | EP:2 MV:2 IC:2 OL:2=8 | 大脑双半点亮 + 点半脑原地揭示该能力 3 要点简介卡（不跳转），让"两大能力平等完整、非一半"的纲领立住；VOE 拍板原地揭示形态，toggle 双态揭示 slide-writer 可做，不跳转避免 SPA 路由耦合 | true |
| S006 | 两根轴 + 核心论断 | mechanism | 🟡 | orthogonal-axes-analogy | brain⊥source 两根轴：git markdown 是源真相，数据库是编译产物 | "源码 vs 可执行文件"类比卡翻出，两轴正交关系亮起 | 两轴正交图 | EP:3 MV:1 IC:3 OL:3=10 | 正交两轴图让"数据库⊥source、互不混淆"的核心论断可见；这是"判断的尺"的第一刻度，类比卡降门槛 | true |
| S007 | 建图的起点：你怎么声明关系 | mechanism | 🟡 | markdown-wikilink-highlight | 关系是你在 markdown 里显式写的，不是机器猜的 | `[[companies/nexaflow]]` + "founder of" 在重画的 markdown 里高亮跳出 | 高亮的 wikilink+语义动词 | EP:3 MV:2 IC:3 OL:3=11 | 高亮 wikilink+语义动词让"关系是人显式写的"可见，为 C2 建图作认知铺垫；HTML 重画 markdown（不嵌真实代码，遵铁律） | true |
| S008 | 动态建图演示：看图自己长出来 | mechanism | 🔴🔴 | graph-self-wiring-grow | 关系你写·零 LLM 零成本·改一行 markdown 图就跟着变 | 6 孤立节点 → 16 条四色 typed 边按 4 类型分批逐条飞出 → 边数 0→16 柱状图同步 → 角标恒亮"LLM 0 次·$0.00" | 自生长的 typed 知识图谱 | EP:3 MV:3 IC:1 OL:2=9 | 只有逐条飞边动画能让"图自己长出来、零 LLM"可见——静态终态图无法展示"边从无到有"的确定性过程（避反模式：机制页只展示结果）；VOE 拍板分类型分批语义停顿（每类关系一停顿可讲解，避反模式 stage 机械均分）+ ▶/⏸/⏭ 单步控制 | true |
| S009 | 零 LLM 的确定性与可追溯 | mechanism | 🟡 | edge-to-source-trace | 每条边都能溯源到你写的那一行，重跑图一模一样 | 点一条边 → 对应 markdown 源行高亮跳亮（溯源闭环） | 边↔源行的高亮连线 | EP:3 MV:2 IC:2 OL:3=10 | 点边→高亮源行的联动让"确定性+可追溯"可见，是 C2 的机制拆解；正则规则四类型用 HTML 重画（不嵌代码） | true |
| S010 | self-wiring vs GraphRAG | example | 🟡 | comparison-matrix-dual-input | 两种为不同输入设计、非优劣：解析显式链接 vs LLM 抽实体 | 《圣诞颂歌》纯散文喂进去 → GBrain 建 0 边（设计使然，反例震一下） | 对比矩阵+两种输入 | EP:2 MV:1 IC:3 OL:3=9 | 这是"已理解两边做判断"的对比页（brief 许可左右对比），矩阵让"确定可审计 vs 非确定需 LLM"的适用边界可见；0 边反例打破"图谱必须靠 LLM"误解 | true |
| S011 | 源真相 vs 编译产物双轨 | mechanism | 🟡 | dual-track-one-way-compile | 改 markdown 数据库不自动更新，必须重编译（物化视图直觉） | git 左轨改了一行 → 单向编译箭头未触发 → DB 右轨原地不动（"改左不自动追右"） | 双轨+单向编译箭头 | EP:3 MV:2 IC:3 OL:3=11 | 单向箭头动画让"改左不自动追右"的物化视图直觉可见；静态双轨图无法传达"单向、需手动重编译"的方向性 | true |
| S012 | 两引擎一契约 + embedding 是什么 | mechanism | 🟡 | engine-contract-semantic-space | 一套契约换引擎不换代码；embedding=文本变语义坐标 | PGLite/Postgres 引擎对照 + 语义空间散点"方向近=语义近"点亮 | 引擎对照+语义坐标散点 | EP:2 MV:2 IC:3 OL:3=10 | 引擎对照卡 + 语义空间散点示意（标签常驻+hover亮化，复用固化模板）让"一契约换引擎"和"embedding 语义坐标"两概念可见；非重模拟，示意级即可 | true |
| S013 | 为什么要混合检索 | mechanism | 🟡 | venn-blindspot-overlap | BM25 只认字面、向量抓语义，两路盲区互补 | 两盲区圆交集亮起：字面漏的同义词被向量接住 | 双盲区韦恩图 | EP:3 MV:2 IC:3 OL:3=11 | 韦恩图交集让"两路盲区互补"可见；静态文字难传达"各自漏什么、交集补什么"的互补关系 | true |
| S014 | 三路合流 HNSW+BM25+RRF | mechanism | 🟡 | parallel-merge-flow | 一个查询分两路并行跑，再汇入 RRF 出统一排名 | 查询点分叉两路（HNSW/BM25）并行流动 → 汇入 RRF 节点 → 吐统一排名 | 分流→汇合流程图 | EP:3 MV:2 IC:3 OL:3=11 | 路径追踪动画让"分两路并行→汇合"的数据流可见（CL05 路径追踪）；为 E3 RRF 机制作铺垫，静态流程图缺"并行→汇合"的时序 | true |
| S015 | RRF 为什么不能直接加分 | mechanism | 🔴🔴 | rrf-rank-slider-sandbox | 两路量纲不可比，RRF 只看名次让两路平权 | 拖滑块改名次 → "直接加分"被 BM25(2.9) 主导 vs "RRF 分"两路平权，实时对照 | 双算法分数实时对照面板 | EP:3 MV:3 IC:1 OL:2=9 | 参数沙盒：滑块拖动让两种算法分数同步变化，把"量纲不可比→直接加被主导 / RRF 名次平权"的因果链做成可操作的实时演示——静态公式学员看不懂为什么不能直接加（CL04 数据可视化 + CL12 滑块） | true |
| S016 | search 给页面 vs think 给答案 | mechanism | 🔴 | search-think-toggle | search 甩你 5 页要你自己读，think 替你读完综合成带引用答案 | 同句问题切到 think：成文答案逐句成形 + citation 标记亮起 | 成文答案+citation（think 态） | EP:3 MV:2 IC:2 OL:3=10 | toggle 切换让"给页面 vs 给答案"的本质差别可见——这是 GBrain 高峰卖点；citation 静态高亮标记呈现引用来源，toggle 双态面板 slide-writer 可做（参照 hermes svg-timeline-toggle），不需重 state 机 | true |
| S017 | 空白分析 gap：最该先看的 | mechanism | 🟡 | gap-three-signal-cards | think 诚实告诉你它还不知道什么：先看 gap 再看正文 | 三信号卡（过期/无引用论断/自相矛盾）暖金警示亮起 + 各配"你该做什么" | 三信号警示卡 | EP:2 MV:1 IC:3 OL:3=9 | 三信号卡片 + "你该做什么"是 GBrain 差异化亮点；核心是三类信号的内容呈现与优先级（暖金 accent 警示），非机制因果链，常驻三卡足够，无需重 state（brief 🔴 高估，降为 🟡） | true |
| S018 | find_trajectory：时序复利 | example | 🟡 | timeline-converge | 一次问出指标怎么变/团队什么样/承诺了什么，省去分别查再对齐 | 三条时间线汇聚成一个对齐好的答案 | 时间轴汇聚图 | EP:2 MV:2 IC:3 OL:3=10 | 时间轴汇聚动画让"一次多维问、省去手动对齐时间线"的复利可见；静态列表难传达"汇聚成一个答案"的时序整合 | true |
| S019 | 51 skills vs 约90 MCP tools | mechanism | 🟡 | two-layer-call-arrow | 两个维度不是一个数：skills 是指令层 WHAT，tools 是执行层 HOW | skills 调用箭头射向 tools 层，"指令层调执行层"关系点亮 | 两层对照+调用箭头 | EP:2 MV:1 IC:3 OL:3=9 | 两层对照+调用箭头让"skills(WHAT)调 tools(HOW)、不是同一个数"可见，破"两个数字可比"误解；判断对比类，对照合法 | true |
| S020 | schema 包 + Minions 梦循环 | mechanism | 🟡 | schema-graph-night-loop | schema 让大脑认识知识类型，Minions 夜间自动维护 | schema 类型图谱亮起 + 夜间维护循环（去重/修引用/检测矛盾）转起来 | 类型图谱+夜间循环 | EP:2 MV:2 IC:3 OL:3=10 | 类型图谱 + 夜间维护循环动画让"schema 认知类型 + 自动维护"两机制可见；循环箭头传达"夜间持续运转"的时序 | true |
| S021 | 两个 benchmark 严禁混引 | mechanism | 🟡 | dual-bar-donotmix-hover | LongMemEval R@5 97.6% 与 BrainBench P@5 49.1% 不在一个坐标系 | 两根异纹理柱中间一道红色 DO NOT MIX 横杠，hover 各看口径 | 两根异纹理柱+红线 | EP:2 MV:1 IC:3 OL:3=9 | 两异纹理柱 + DO NOT MIX 红线（暖金/红 accent）让"两 benchmark 不可比"的判断可见，hover 揭示口径细节；判断页对比合法（brief 许可），破"数字越高越好"误解 | true |
| S022 | 成本贵 ≠ 质量差 | mechanism | 🟡 | dual-axis-independent | 约21× token 是 think 多跳综合换来的质量，不是用高成本换低成本 | 成本轴与质量轴两条独立维度并立，21× 不落在"质量更差"那侧 | 双独立维度坐标 | EP:3 MV:1 IC:3 OL:3=10 | 两独立维度坐标让"成本与质量是正交两轴、贵不等于差"可见；单轴权衡图会误导成"成本换质量"的零和直觉 | true |
| S023 | 三维权衡：一把判断的尺 | mechanism | 🟡 | radar-or-decision-tree | 检索质量 / 查询成本 / 适用场景，三维一起看才知道值不值 | 三维雷达（或决策树）展开，"稳定知识+需深综合才划算"的甜区高亮 | 三维雷达/决策树 | EP:3 MV:1 IC:3 OL:3=10 | 三维雷达让"质量/成本/场景三维同看"的判断框架可见，把全课件的"尺"收成一张图（CL05 决策树备选）；单维比较无法表达三维权衡 | true |
| S024 | 从笔记到会思考的大脑 | summary | 🟡 | panorama-ruler-recap | 你带走的是一把判断的尺：拆存储/检索/综合、看 benchmark 诚不诚实、判断成本值不值 | 两大能力全景回顾汇成一把"尺"的隐喻收束 | 全景回顾+尺隐喻 | EP:2 MV:1 IC:3 OL:3=9 | 全景回顾让两大能力 + 一把尺的课程主线收束可见；尺隐喻是 brief 既定教学隐喻（title_discipline 许可）；不提"补全"（遵铁律） | true |

> 字段值锁定：`interaction_strength` 纯 emoji；`anti_pattern_check` boolean。S005=🔴 / S008=🔴🔴 已由 VOE 拍板锁定。

---

### Pattern Selection Summary
**保留模式**：
- `toggle-dual-path-highlight`(A2)：范式对比的分叉点需切换可见，单 toggle 低负荷。
- `brain-dual-capability-reveal`(B2 🔴)：点半脑原地揭示该能力简介卡，纲领+轻交互，不跳转。
- `graph-self-wiring-grow`(C2 🔴🔴)：逐条飞边 typed 图自生长，全课件第一记忆锚点，唯一能让"零 LLM 建图过程"可见的形态；分类型分批 + ▶/⏸/⏭ 单步控制。
- `rrf-rank-slider-sandbox`(E3 🔴🔴)：参数沙盒，滑块拖名次实时看 RRF 平权，机制因果链可操作。
- `edge-to-source-trace`(C3)、`dual-track-one-way-compile`(D1)、`parallel-merge-flow`(E2)：均为"有方向/有时序"的轻量机制动画，slide-writer 可做。
- `search-think-toggle`(F1)：双态面板 toggle，承载 GBrain 高峰卖点。
- 判断对比类（C4/H1/G1/H2/H3）：均为"已理解两边做判断"，brief 许可左右/矩阵对比。

**拒绝模式**：
- ❌ 新机制页用左右静态卡对比（违反"新机制独立展示"）：C2 建图、C3 溯源、E2 合流均用独立展示/流程/图谱织网，非左右对比。
- ❌ C2 只摆终态结果图（违反"机制页只展示结果不展示过程"）：必须逐条飞边展示从 0→16 的过程。
- ❌ C2 飞边步数机械均分（违反"stage 机械均分→语义化"）：VOE 拍板按 4 关系类型语义分批，每类一停顿可讲解。
- ❌ F2 升重交互 state 机（违反"实现成本 High ≤20% + 认知负荷"）：三信号是内容呈现非因果链，降 🟡 常驻卡。
- ❌ B2 做真章节跳转（VOE 否决 SPA 路由耦合）：拍板原地揭示，不跳转。
- ❌ 通信/图谱页纯文字面板（违反 host 纪律"图谱页必须真实连线动画"）：C2/C3/E2 均有真实 SVG 连线，无纯文字面板。

### 🔴🔴 重交互页列表（路由给 interactive-eng）
```json
["S008", "S015"]
```
> S005(B2) 经 VOE 拍板为"原地揭示"(🔴) → 不进 🔴🔴 列表，路由 slide-writer。列表定稿。

### 🔴🔴 失败模式预防清单

#### S008 失败模式（FM）— graph-self-wiring-grow 自生长图谱
- FM-1：逐条飞边用 `gsap.from()` 在 display:none 初始态丢失起点 → 防御：`fromTo()` + `paused:true` + setTimeout(120ms) 待 slide active 再播（参照 s017 L1）。
- FM-2：▶/⏸/⏭ 单步控制与分批自动播共用同一 timeline，暂停后点⏭跳批导致 timeline 进度与边计数器失同步 → 防御：timeline label 锚每个类型批次起点，⏭ `tl.seek(nextLabel)` 后强制同步计数器/柱状图到该批次快照值。
- FM-3："删一条 wikilink→对应边消失"与"点节点→亮其所有边"两个增强交互共享 edge 选中态，连点导致状态错位 → 防御：单一 `selectedEdgeId` 真值源，每次交互先 reset 所有边 class 再施加当前态；cleanup 中 `timeline.kill()` + 清空 SVG `<g>` + 重置计数器为 0。

#### S015 失败模式（FM）— rrf-rank-slider-sandbox 参数沙盒
- FM-1：滑块 `input` 事件高频触发，每次重算两套分数 + 重绘 canvas 导致卡顿/闪烁 → 防御：`requestAnimationFrame` 节流重绘，分数计算与 DOM 写分离。
- FM-2：motion_level 切换或重置时 Chart.js/canvas 实例未销毁，重建叠加双 canvas → 防御：cleanup 中 `chart.destroy()` + 解绑滑块 listener。
- FM-3：滑块拖到极端名次（rank=0 或超界）导致 1/(k+rank) 分母异常或 NaN 显示 → 防御：clamp 滑块值到 [1, maxRank]，k 取常量保护，NaN 兜底显示占位。

### motion_level 约束应用
- 当前 motion_level：**high**（不触发 low 降级）。
- high 模式下仍按 designer motion_rationale 分级：概念页（S003/S004/S006/S013/S019/S022 等）克制收敛轻动效，亮点页（S008/S015/S005）放开高密度动效，避免极简钢蓝理性气质被过度动效冲淡。
- 受影响降级页面：无（high 档无强制降级）。

---

### VOE 拍板记录（2026-06-22）
- **决策 1（C2/S008）**：动态建图 state 粒度 / 飞边步数 / 增强交互 → 拍板「**分类型分批语义停顿 + ▶/⏸/⏭ 单步控制**」。按 4 种关系类型分批飞边，每类停顿可讲解；三按钮单步控制满足动画页 ≥5 stage 铁律。`🔴🔴` / interactive-eng。
- **决策 2（B2/S005）**：两大能力大脑导航形态 → 拍板「**原地揭示**」。点大脑左/右半，本页原地展开该能力简介卡，不跳转。`🔴` / slide-writer，不进 🔴🔴 列表。
