/**
 * interactive.js — 编译式 RAG：LLM Wiki 原理 重交互 hooks 空壳
 *
 * html-courseware-interactive-eng 将填充此文件
 *
 * 键名格式：'slides/SXX-filename.html'（完整路径，与 main.js slideFiles 一致）
 * 值格式：function() { ...; return function cleanup() { ... }; }
 *
 * 已确认重交互页（interaction_level=🔴🔴）：
 *   S006-dual-track-simulator.html     — 5 态双轨模拟器
 *   S009-three-layer-ownership.html    — 三层架构所有权点选高亮
 *   S010-compile-grows-wiki.html       — 编译过程生长动画
 */
window.slideHooks = window.slideHooks || {};

/* ============================================================
 * S006 — 双轨模拟器（5 态状态机）
 * FM 清单:
 *   FM-1: 连点防御——点击后立即 disable 按钮，所有子步 timer 完成后才 re-enable
 *   FM-2: cleanup clearTimeout 所有 timer（上轨3+下轨1+结果显示1）+ gsap.killTweensOf
 *   FM-3: lastSummaryIdx 维护，相邻两轮归纳结果必不同
 * ============================================================ */
window.slideHooks['slides/S006-dual-track-simulator.html'] = function () {
  /* FM-1: querySelector 防 null */
  var slide = document.querySelector('.slide[data-slide="6"]');
  if (!slide) return function noop() {};

  // --- DOM refs ---
  var source        = slide.querySelector('#s006-source');
  var stepRetrieve  = slide.querySelector('#s006-step-retrieve');
  var stepPrompt    = slide.querySelector('#s006-step-prompt');
  var stepSummarize = slide.querySelector('#s006-step-summarize');
  var answer        = slide.querySelector('#s006-answer');
  var jitter        = slide.querySelector('#s006-jitter');
  var burnTag       = slide.querySelector('#s006-burn');
  var stage         = slide.querySelector('#s006-stage');
  var stagePh       = slide.querySelector('#s006-stage-ph');
  var compileStatus = slide.querySelector('#s006-compile-status');
  var tallyI        = slide.querySelector('#s006-tally-i');
  var tallyISteps   = slide.querySelector('#s006-tally-i-steps');
  var verdictI      = slide.querySelector('#s006-verdict-i');
  var tallyC        = slide.querySelector('#s006-tally-c');
  var tallyCHit     = slide.querySelector('#s006-tally-c-hit');
  var verdictC      = slide.querySelector('#s006-verdict-c');
  var askBtn        = slide.querySelector('#s006-ask-btn');
  var replayBtn     = slide.querySelector('#s006-replay-btn');
  var stageInd      = slide.querySelector('#s006-stage-ind');
  var fork          = slide.querySelector('#s006-fork');

  // --- 一类问题（换问法 / 相关追问，循环取）---
  var questionPool = [
    '编译式 RAG 真能省查询成本吗？',
    '它和在前面加个缓存有什么区别？',
    'raw 原始资料会被编译改写吗？',
    '换一个全新问法，它还命中吗？',
    '这套范式到底适合哪些场景？',
  ];
  var qIdx = -1;
  var FORK_HINT = '点「提问」，对同一批原料问一<b>类</b>问题（换问法 / 相关追问）——看 <b>解释执行</b> 与 <b>编译执行</b> 两条命运 ↓';

  // --- 解释执行答案池（每次抖动·相邻必不同 ←FM-3）---
  var summaryPool = [
    '编译式 RAG 把原始资料预先组织成可复用结构',
    'LLM Wiki 将三篇资料编译成一份互链 wiki',
    '查询直接命中已消化的 wiki 产物，不重读原料',
    '知识从一次性消费变成可复用的复利资产',
    '编译期做一次判断，之后每次查询复用结果',
  ];
  var lastIdx = -1;

  // --- 状态 ---
  var askCount = 0;
  var compiled = false;   // 是否已完成首次编译
  var busy = false;       // ←FM-1 防连点

  // --- Timers（FM-2 集中登记）---
  var timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function pickSummary() { // ←FM-3
    var idx;
    do { idx = Math.floor(Math.random() * summaryPool.length); }
    while (idx === lastIdx && summaryPool.length > 1);
    lastIdx = idx;
    return summaryPool[idx];
  }

  function resetLeft() {
    [stepRetrieve, stepPrompt, stepSummarize].forEach(function (el) { if (el) el.classList.remove('active'); });
    if (answer) answer.classList.remove('visible', 'burning');
    if (jitter) jitter.textContent = '';
    if (burnTag) burnTag.classList.remove('show');
  }

  function setStage(t) { if (stageInd) stageInd.textContent = t; }

  function updateTally() {
    if (tallyI) tallyI.textContent = askCount;
    if (tallyISteps) tallyISteps.textContent = askCount * 3;
    if (verdictI) verdictI.textContent = askCount >= 2 ? '✗ 每个问题都重走·零复用' : '⚠ 临时归纳·不沉淀';
    if (tallyC) tallyC.textContent = '1';
    if (tallyCHit) tallyCHit.textContent = askCount;
    if (verdictC) verdictC.textContent = askCount >= 2 ? '✓ 一次编译·全类复用' : '✓ 已沉淀·可复用';
  }

  function runAsk() { // ←FM-1 连点防御入口
    if (busy) return;
    busy = true;
    askCount++;
    if (askBtn) askBtn.disabled = true;
    resetLeft();
    if (source) source.classList.add('reading');

    // 本轮问题（同类·换问法/追问，循环取）——两路面对同一个问题实例
    qIdx = (qIdx + 1) % questionPool.length;
    if (fork) {
      fork.classList.add('asking');
      fork.innerHTML = '<span class="s006-q-tag">❓ 第 ' + askCount + ' 问</span>' + questionPool[qIdx];
    }

    // ——左路：从头重走三步——
    setStage('上轨 1/3 · 检索 raw —— 解释执行每次都回原料');
    if (stepRetrieve) stepRetrieve.classList.add('active');

    // ——右路：首次编译 / 之后秒回——
    if (!compiled) {
      if (stagePh) stagePh.style.display = 'none';
      if (stage) { stage.classList.remove('hit', 'done'); stage.classList.add('compiling'); }
      if (compileStatus) compileStatus.textContent = '首次编译（慢）：raw 碎片正在汇入……';
    } else {
      if (stage) { stage.classList.remove('compiling'); stage.classList.add('done', 'hit'); }
      if (compileStatus) compileStatus.textContent = '换个问法 → 仍命中同一产物 · 秒回 ⚡（读的是当前 wiki，raw 改了要重新 ingest）';
      later(function () { if (stage) stage.classList.remove('hit'); }, 750);
    }

    later(function () {
      if (stepPrompt) stepPrompt.classList.add('active');
      setStage('上轨 2/3 · 拼 prompt —— 组装上下文窗口');
    }, 900);

    later(function () {
      if (stepSummarize) stepSummarize.classList.add('active');
      setStage('上轨 3/3 · 临时归纳 —— 当场消化，质量不稳');
      // 右路首次：碎片凝聚成互链产物（灰碎片 → 绿互链）
      if (!compiled) {
        if (stage) { stage.classList.remove('compiling'); stage.classList.add('done'); }
        if (compileStatus) compileStatus.textContent = '编译完成 ✓ 产物已沉淀 · 可复用（raw 更新需 re-ingest）';
        compiled = true;
      }
    }, 1700);

    // 左路吐答案（每次不同）
    later(function () {
      var ans = pickSummary();
      if (answer) { answer.textContent = ans; answer.classList.add('visible'); }
      if (jitter) jitter.textContent = '第 ' + askCount + ' 轮 · 答案漂移';
      updateTally();
    }, 2400);

    // 左路答案清空（不沉淀·什么都没留）
    later(function () {
      if (answer) answer.classList.add('burning');
      if (burnTag) burnTag.classList.add('show');
    }, 3500);

    // 收尾：清理左路、解锁、留下"什么都没沉淀"的静态提示
    later(function () {
      resetLeft();
      if (source) source.classList.remove('reading');
      if (answer) { answer.textContent = '解释执行不沉淀——这类问题换个问法又得从头重走'; answer.classList.add('visible'); }
      busy = false;
      if (askBtn) { askBtn.disabled = false; askBtn.textContent = '换个问法再问'; }
      setStage('对比：左路 ' + askCount + ' 个问题重走 ' + askCount + ' 次 · 右路 1 份产物全覆盖');
    }, 4100);
  }

  function handleReplay() {
    clearTimers();
    askCount = 0;
    compiled = false;
    busy = false;
    lastIdx = -1;
    qIdx = -1;
    resetLeft();
    if (source) source.classList.remove('reading');
    if (fork) { fork.classList.remove('asking'); fork.innerHTML = FORK_HINT; }
    if (answer) answer.textContent = '点「提问」后，这里临时归纳出一个答案……';
    if (stage) stage.classList.remove('compiling', 'done', 'hit');
    if (stagePh) stagePh.style.display = '';
    if (compileStatus) compileStatus.textContent = '等待首次编译……';
    if (tallyI) tallyI.textContent = '0';
    if (tallyISteps) tallyISteps.textContent = '0';
    if (verdictI) verdictI.textContent = '— 待观察';
    if (tallyC) tallyC.textContent = '0';
    if (tallyCHit) tallyCHit.textContent = '0';
    if (verdictC) verdictC.textContent = '— 产物待生成';
    if (askBtn) { askBtn.disabled = false; askBtn.textContent = '首次提问'; }
    setStage('准备好后点「首次提问」——左路每个问题都重走、右路一次编译全类复用');
  }

  // 绑定事件（具名函数，便于 removeEventListener ←FM-1）
  if (askBtn) askBtn.addEventListener('click', runAsk);
  if (replayBtn) replayBtn.addEventListener('click', handleReplay);

  // cleanup ←FM-2
  return function cleanup() {
    clearTimers();
    if (askBtn) askBtn.removeEventListener('click', runAsk);
    if (replayBtn) replayBtn.removeEventListener('click', handleReplay);
  };
};


/* ============================================================
 * S006b — 解释执行：逐个 chunk 算相似度（embedding 匹配）
 * ============================================================ */
window.slideHooks['slides/S006b-interpret-mechanism.html'] = function () {
  var slide = document.querySelector('.slide[data-slide="601"]');
  if (!slide) return function noop() {};

  var qtag = slide.querySelector('#s6b-qtag');
  var qtext = slide.querySelector('#s6b-qtext');
  var vecQ = slide.querySelector('#s6b-vec-q');
  var bars = slide.querySelector('#s6b-bars');
  var recallText = slide.querySelector('#s6b-recall-text');
  var mQ = slide.querySelector('#s6b-m-q');
  var mCalc = slide.querySelector('#s6b-m-calc');
  var askBtn = slide.querySelector('#s6b-ask');
  var resetBtn = slide.querySelector('#s6b-reset');
  var stage = slide.querySelector('#s6b-stage');

  var CHUNKS = ['raw① 缓存定义段', 'raw① 只读纪律段', 'raw② 编译定义段', 'raw② 成本实验段', 'raw③ 20×对比段', 'raw③ 所有权段'];
  var DATA = [
    { q: '编译式 RAG 真省查询成本吗？', vec: 'q ⟨成本·向量⟩', scores: [0.38, 0.21, 0.55, 0.89, 0.86, 0.19] },
    { q: '它和在前面加个缓存有什么区别？', vec: 'q ⟨缓存·向量⟩', scores: [0.91, 0.33, 0.83, 0.40, 0.35, 0.44] },
    { q: 'raw 原始资料会被编译改写吗？', vec: 'q ⟨纪律·向量⟩', scores: [0.30, 0.90, 0.42, 0.22, 0.20, 0.85] },
  ];
  var TOPK = 3;

  var qIdx = -1, count = 0, busy = false, timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function render(d, animate) {
    var rows = CHUNKS.map(function (name, i) { return { name: name, score: d.scores[i] }; });
    rows.sort(function (a, b) { return b.score - a.score; });
    if (!bars) return;
    bars.innerHTML = rows.map(function (r, rank) {
      var isTop = rank < TOPK;
      var w = Math.round(r.score * 100);
      return '<div class="s6b-bar-row' + (isTop ? ' top' : '') + '">'
        + '<span class="s6b-bar-name">' + r.name + '</span>'
        + '<div class="s6b-bar-track"><div class="s6b-bar-fill" data-w="' + w + '" style="width:' + (animate ? 0 : w) + '%"></div></div>'
        + '<span class="s6b-bar-score">' + r.score.toFixed(2) + '</span>'
        + '<span class="s6b-bar-badge">召回</span></div>';
    }).join('');
    if (animate) {
      later(function () {
        var fills = bars.querySelectorAll('.s6b-bar-fill');
        Array.prototype.forEach.call(fills, function (f) { f.style.width = f.getAttribute('data-w') + '%'; });
      }, 60);
    }
  }

  function runQuestion() {
    if (busy) return;
    busy = true;
    if (askBtn) askBtn.disabled = true;
    qIdx = (qIdx + 1) % DATA.length;
    count++;
    var d = DATA[qIdx];
    if (qtag) qtag.textContent = '❓ 第 ' + count + ' 问';
    if (qtext) qtext.textContent = d.q;
    if (vecQ) vecQ.textContent = d.vec;
    if (stage) stage.textContent = '第 ' + count + ' 问：问题向量变 → 6 个 cos 全部重算 → top-3 重新排，上一问打分一点没用上';
    render(d, true);
    if (recallText) recallText.innerHTML = '相似度最高的 <b>top-3</b> 被召回 → 拼进 prompt → 交给 LLM 当场归纳（第 ' + count + ' 次，每问重来）';
    if (mQ) mQ.textContent = count;
    if (mCalc) mCalc.textContent = count * 6;
    later(function () {
      busy = false;
      if (askBtn) { askBtn.disabled = false; askBtn.textContent = '换个问题再算一次'; }
    }, 700);
  }

  function handleReset() {
    clearTimers();
    qIdx = -1; count = 0; busy = false;
    if (bars) bars.innerHTML = '<div class="s6b-bar-row"><span class="s6b-bar-name">等待计算……</span><div class="s6b-bar-track"><div class="s6b-bar-fill"></div></div><span class="s6b-bar-score">—</span><span class="s6b-bar-badge"></span></div>';
    if (qtag) qtag.textContent = '❓ 第 1 问';
    if (qtext) qtext.textContent = '点「算一次相似度」——看 embedding 检索内部怎么打分';
    if (vecQ) vecQ.textContent = 'q ⟨1536 维向量⟩';
    if (recallText) recallText.innerHTML = '相似度最高的 <b>top-3</b> 被召回 → 拼进 prompt → 交给 LLM 当场归纳（每问重来）';
    if (mQ) mQ.textContent = '0';
    if (mCalc) mCalc.textContent = '0';
    if (askBtn) { askBtn.disabled = false; askBtn.textContent = '算一次相似度'; }
    if (stage) stage.textContent = '同一批 chunk 向量预先建好；每换一个问题，问题向量变 → 6 个 cos 全部重算 → top-3 重新排，上一问的打分一点用不上';
  }

  if (askBtn) askBtn.addEventListener('click', runQuestion);
  if (resetBtn) resetBtn.addEventListener('click', handleReset);

  return function cleanup() {
    clearTimers();
    if (askBtn) askBtn.removeEventListener('click', runQuestion);
    if (resetBtn) resetBtn.removeEventListener('click', handleReset);
  };
};


/* ============================================================
 * S006c — 编译执行：读 index.md 目录导航命中
 * ============================================================ */
window.slideHooks['slides/S006c-compile-mechanism.html'] = function () {
  var slide = document.querySelector('.slide[data-slide="602"]');
  if (!slide) return function noop() {};

  var qtag = slide.querySelector('#s6c-qtag');
  var qtext = slide.querySelector('#s6c-qtext');
  var idxItems = { concept: slide.querySelector('#idx-concept'), impl: slide.querySelector('#idx-impl'), falsify: slide.querySelector('#idx-falsify') };
  var nodes = { concept: slide.querySelector('#node-concept'), impl: slide.querySelector('#node-impl'), falsify: slide.querySelector('#node-falsify') };
  var links = { 'link-ci': slide.querySelector('#link-ci'), 'link-if': slide.querySelector('#link-if'), 'link-cf': slide.querySelector('#link-cf') };
  var step1 = slide.querySelector('#s6c-step-1');
  var step2 = slide.querySelector('#s6c-step-2');
  var step3 = slide.querySelector('#s6c-step-3');
  var result = slide.querySelector('#s6c-result');
  var resultText = slide.querySelector('#s6c-result-text');
  var askBtn = slide.querySelector('#s6c-ask');
  var resetBtn = slide.querySelector('#s6c-reset');
  var stage = slide.querySelector('#s6c-stage');

  var PNAME = { concept: '概念基础.md', impl: '实现模式.md', falsify: '证伪实验.md' };
  var DATA = [
    { q: '编译式 RAG 真省查询成本吗？', entry: 'falsify', ext: 'impl', link: 'link-if',
      concl: '读 <b>证伪实验.md</b>（沿链接带出 <b>实现模式.md</b>）里已对齐的「约 20× 成本」结论' },
    { q: '它和在前面加个缓存有什么区别？', entry: 'concept', ext: 'impl', link: 'link-ci',
      concl: '读 <b>概念基础.md</b>（沿链接带出 <b>实现模式.md</b>）里「缓存按问题存 vs 编译组织知识」定义' },
    { q: 'raw 原始资料会被编译改写吗？', entry: 'concept', ext: null, link: null,
      concl: '读 <b>概念基础.md</b> 里「raw 只读不可变」纪律结论（一页即得，无需扩展）' },
    { q: '这套范式适合哪些场景？', entry: 'falsify', ext: 'impl', link: 'link-if',
      concl: '读 <b>证伪实验.md</b>（沿链接带出 <b>实现模式.md</b>）里的选型边界结论' },
  ];

  var qIdx = -1, busy = false, timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function clearAll() {
    Object.keys(idxItems).forEach(function (k) { if (idxItems[k]) idxItems[k].classList.remove('hit'); });
    Object.keys(nodes).forEach(function (k) { if (nodes[k]) nodes[k].classList.remove('hit', 'ext', 'dimnode'); });
    Object.keys(links).forEach(function (k) { if (links[k]) links[k].classList.remove('active'); });
    [step1, step2, step3].forEach(function (s) { if (s) s.classList.remove('active'); });
  }

  function runQuery() {
    if (busy) return;
    busy = true;
    if (askBtn) askBtn.disabled = true;
    qIdx = (qIdx + 1) % DATA.length;
    var d = DATA[qIdx];
    clearAll();
    if (result) result.classList.remove('show');
    if (qtag) qtag.textContent = '❓ 第 ' + (qIdx + 1) + ' 查';
    if (qtext) qtext.textContent = d.q;

    Object.keys(nodes).forEach(function (k) { if (nodes[k] && k !== d.entry && k !== d.ext) nodes[k].classList.add('dimnode'); });

    // ① 读 index.md 定位
    if (step1) step1.classList.add('active');
    if (idxItems[d.entry]) idxItems[d.entry].classList.add('hit');
    if (stage) stage.textContent = '① 读 index.md 目录，定位到「' + PNAME[d.entry] + '」——不向量化、读当前 wiki（非 raw）';

    // ② 命中入口节点 + 沿链接扩展
    later(function () {
      if (nodes[d.entry]) nodes[d.entry].classList.add('hit');
      if (step1) step1.classList.remove('active');
      if (d.ext) {
        if (step2) step2.classList.add('active');
        if (d.link && links[d.link]) links[d.link].classList.add('active');
        if (nodes[d.ext]) nodes[d.ext].classList.add('ext');
        if (stage) stage.textContent = '② 沿 [[链接]] 从「' + PNAME[d.entry] + '」扩展到「' + PNAME[d.ext] + '」';
      } else {
        if (stage) stage.textContent = '本问一页即得：「' + PNAME[d.entry] + '」直接命中，无需沿链接扩展';
      }
    }, 750);

    // ③ 读结论
    later(function () {
      if (step2) step2.classList.remove('active');
      if (step3) step3.classList.add('active');
      if (resultText) resultText.innerHTML = d.concl;
      if (result) result.classList.add('show');
      if (stage) stage.textContent = '③ 读已提炼结论——不重新检索、不重新归纳，整条路径都在已编译 wiki 上';
      busy = false;
      if (askBtn) { askBtn.disabled = false; askBtn.textContent = '查询下一个问题'; }
    }, 1450);
  }

  function handleReset() {
    clearTimers();
    qIdx = -1; busy = false;
    clearAll();
    if (result) result.classList.remove('show');
    if (resultText) resultText.innerHTML = '—';
    if (qtag) qtag.textContent = '❓ 待提问';
    if (qtext) qtext.textContent = '点「查询下一个」——看 agent 怎么沿目录和链接命中';
    if (askBtn) { askBtn.disabled = false; askBtn.textContent = '查询下一个问题'; }
    if (stage) stage.textContent = '同一份已编译 wiki：每个问题都先读 index.md 目录定位、再沿 [[链接]] 扩展——不同问题进不同入口、走不同路径，读的都是当前 wiki，不是当前 raw';
  }

  if (askBtn) askBtn.addEventListener('click', runQuery);
  if (resetBtn) resetBtn.addEventListener('click', handleReset);

  return function cleanup() {
    clearTimers();
    if (askBtn) askBtn.removeEventListener('click', runQuery);
    if (resetBtn) resetBtn.removeEventListener('click', handleReset);
  };
};


/* ============================================================
 * S009 — 三层架构所有权点选高亮
 * FM 清单:
 *   FM-1: currentFocus 维护，点同层→回 IDLE，点新层→切换（toggle 语义）
 *   FM-2: 箭头标注走 CSS grid 独立轨道（HTML 中已实现），非 absolute
 *   FM-3: cleanup 中 gsap.set 强制还原三层 opacity/filter，禁靠 CSS transition 自然回弹
 * ============================================================ */
window.slideHooks['slides/S009-three-layer-ownership.html'] = function () {
  /* FM-1: querySelector 防 null */
  var slide = document.querySelector('.slide[data-slide="9"]');
  if (!slide) return function noop() {};

  var layerRaw    = slide.querySelector('#s009-raw');
  var layerWiki   = slide.querySelector('#s009-wiki');
  var layerClaude = slide.querySelector('#s009-claude');
  var detailPanel = slide.querySelector('#s009-detail');
  var idleEl      = slide.querySelector('#s009-idle');
  var contentEl   = slide.querySelector('#s009-detail-content');
  var dIcon       = slide.querySelector('#s009-d-icon');
  var dName       = slide.querySelector('#s009-d-name');
  var dRows       = slide.querySelector('#s009-d-rows');
  var dPrinciple  = slide.querySelector('#s009-d-principle');

  var currentFocus = null; // ←FM-1 null | 'raw' | 'wiki' | 'claude'

  // 层数据配置
  var layerData = {
    raw: {
      icon: '🔒',
      name: 'raw/',
      nameClass: 'raw-color',
      rows: [
        { key: '所有者', val: '人类团队（工程师 / 研究者）' },
        { key: '权限', val: '🔒 只读 — 编译过程只读取，从不修改' },
        { key: '内容', val: '原始资料：会议纪要、论文摘录、实验数据……' },
        { key: '职责', val: '事实源头，保证原料的原始性与可追溯性' },
      ],
      principle: '不可变原则：编译前后 raw 的 checksum 不变（编译从不改 raw）；人类要更新就改 raw 再重新 ingest——这是编译链可信赖的地基。',
      principleClass: 'raw-bg',
    },
    wiki: {
      icon: '✏',
      name: 'wiki/',
      nameClass: 'wiki-color',
      rows: [
        { key: '所有者', val: 'LLM（由 ingest 操作驱动写入）' },
        { key: '权限', val: '✏ 可写 — ingest 生成，Query 只读，Lint 只校验' },
        { key: '内容', val: '编译产物：互链 wiki 页面，含 [[链接]] 结构' },
        { key: '职责', val: '查询时的直接命中目标；编译时从空目录生长' },
      ],
      principle: '所有权清晰：人类不直接编辑 wiki/，只通过修改 raw/ 或 CLAUDE.md 间接影响产物。',
      principleClass: 'wiki-bg',
    },
    claude: {
      icon: '📐',
      name: 'CLAUDE.md',
      nameClass: 'claude-color',
      rows: [
        { key: '所有者', val: '人类团队（架构师 / 知识管理者）' },
        { key: '权限', val: '📐 立规矩 — 约束编译行为，不直接参与检索' },
        { key: '内容', val: '编译规则：wiki 结构规范、命名约定、合并策略……' },
        { key: '职责', val: '是"编译配置"，告诉 LLM 用什么方式处理 raw/' },
      ],
      principle: '规则与内容分离：CLAUDE.md 管"怎么编译"，raw/ 提供"编译什么"——职责不重叠。',
      principleClass: 'claude-bg',
    },
  };

  function setAllLayers(mode, focusKey) {
    // mode: 'idle' | 'focus'
    var layers = [
      { el: layerRaw,    key: 'raw' },
      { el: layerWiki,   key: 'wiki' },
      { el: layerClaude, key: 'claude' },
    ];
    layers.forEach(function (item) {
      if (!item.el) return;
      item.el.classList.remove('dim', 'active');
      if (mode === 'focus') {
        if (item.key === focusKey) {
          item.el.classList.add('active');
          gsap.to(item.el, { opacity: 1, filter: 'grayscale(0%)', duration: 0.4 });
        } else {
          item.el.classList.add('dim');
          gsap.to(item.el, { opacity: 0.45, filter: 'grayscale(55%)', duration: 0.4 }); // AD-10
        }
      } else {
        // IDLE: 全亮
        gsap.to(item.el, { opacity: 1, filter: 'grayscale(0%)', duration: 0.4 });
      }
    });
  }

  function showDetail(key) {
    var data = layerData[key];
    if (!data || !contentEl) return;

    if (dIcon) dIcon.textContent = data.icon;
    if (dName) { dName.textContent = data.name; dName.className = 's009-detail-name ' + data.nameClass; }
    if (dRows) {
      dRows.innerHTML = data.rows.map(function (r) {
        return '<div class="s009-detail-row"><div class="s009-detail-key">' + r.key + '</div><div class="s009-detail-val">' + r.val + '</div></div>';
      }).join('');
    }
    if (dPrinciple) {
      dPrinciple.textContent = data.principle;
      dPrinciple.className = 's009-detail-principle ' + data.principleClass;
    }

    if (idleEl) idleEl.style.display = 'none';
    contentEl.style.display = 'flex';

    // 面板 focus 边框
    if (detailPanel) {
      detailPanel.classList.remove('raw-focus', 'wiki-focus', 'claude-focus');
      detailPanel.classList.add(key + '-focus');
    }
  }

  function showIdle() {
    if (idleEl) idleEl.style.display = '';
    if (contentEl) contentEl.style.display = 'none';
    if (detailPanel) detailPanel.classList.remove('raw-focus', 'wiki-focus', 'claude-focus');
  }

  function handleLayerClick(key) {
    if (currentFocus === key) {
      // ←FM-1 点同层 → 回 IDLE
      currentFocus = null;
      setAllLayers('idle', null);
      showIdle();
    } else {
      currentFocus = key;
      setAllLayers('focus', key);
      showDetail(key);
    }
  }

  function handleRawClick()    { handleLayerClick('raw'); }
  function handleWikiClick()   { handleLayerClick('wiki'); }
  function handleClaudeClick() { handleLayerClick('claude'); }

  // 键盘支持（Enter/Space）
  function handleRawKey(e)    { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLayerClick('raw'); } }
  function handleWikiKey(e)   { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLayerClick('wiki'); } }
  function handleClaudeKey(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLayerClick('claude'); } }

  if (layerRaw)    { layerRaw.addEventListener('click', handleRawClick);    layerRaw.addEventListener('keydown', handleRawKey); }
  if (layerWiki)   { layerWiki.addEventListener('click', handleWikiClick);  layerWiki.addEventListener('keydown', handleWikiKey); }
  if (layerClaude) { layerClaude.addEventListener('click', handleClaudeClick); layerClaude.addEventListener('keydown', handleClaudeKey); }

  // cleanup ←FM-3
  return function cleanup() {
    // 强制还原三层 opacity/filter，禁靠 CSS transition 自然回弹 ←FM-3
    var layers = [layerRaw, layerWiki, layerClaude];
    layers.forEach(function (el) {
      if (!el) return;
      gsap.killTweensOf(el); // ←FM-3
      gsap.set(el, { opacity: 1, filter: 'grayscale(0%)' }); // ←FM-3 强制还原
      el.classList.remove('dim', 'active');
    });
    gsap.killTweensOf(slide.querySelectorAll('*'));

    if (layerRaw)    { layerRaw.removeEventListener('click', handleRawClick);    layerRaw.removeEventListener('keydown', handleRawKey); }
    if (layerWiki)   { layerWiki.removeEventListener('click', handleWikiClick);  layerWiki.removeEventListener('keydown', handleWikiKey); }
    if (layerClaude) { layerClaude.removeEventListener('click', handleClaudeClick); layerClaude.removeEventListener('keydown', handleClaudeKey); }

    currentFocus = null;
    showIdle();
  };
};


/* ============================================================
 * S010 — 编译生长 wiki（溯源连线版 · 5 语义阶段）
 * ============================================================ */
window.slideHooks['slides/S010-compile-grows-wiki.html'] = function () {
  var slide = document.querySelector('.slide[data-slide="10"]');
  if (!slide) return function noop() {};

  var SVGNS = 'http://www.w3.org/2000/svg';
  var body = slide.querySelector('#s010-body');
  var svg = slide.querySelector('#s010-lines');
  var narration = slide.querySelector('#s010-narration');
  var dotsWrap = slide.querySelector('#s010-dots');
  var playBtn = slide.querySelector('#s010-play');
  var pauseBtn = slide.querySelector('#s010-pause');
  var stepBtn = slide.querySelector('#s010-step');
  var replayBtn = slide.querySelector('#s010-replay');

  var WIKI_IDS = ['wiki-concept', 'wiki-impl', 'wiki-falsify', 'wiki-cross', 'wiki-index'];
  var RAW_IDS = ['raw-r01', 'raw-r02', 'raw-r03'];

  var INIT_NARR = '点「▶ 播放编译」——raw 三篇原料，wiki 还是空目录，看「编译」一步步把原料长成互链 wiki';
  var STAGES = [
    { id: 'wiki-concept', from: ['raw-r01'], cross: false,
      narr: '<b>直接编译</b>：raw/01 概念源 → 概念基础页，并标注「来源 raw/01」——每页可溯源' },
    { id: 'wiki-impl', from: ['raw-r02'], cross: false,
      narr: '<b>直接编译</b>：raw/02 工程实现 → 实现模式页' },
    { id: 'wiki-falsify', from: ['raw-r03'], cross: false,
      narr: '<b>直接编译</b>：raw/03 证伪实验 → 实验证伪页' },
    { id: 'wiki-cross', from: ['raw-r01', 'raw-r03'], cross: true, isCross: true,
      narr: '<b class="cross-hl">跨源综合（编译的精华）</b>：把 raw/01 概念源与 raw/03 证伪源的<b class="cross-hl">矛盾对齐</b>，两条线汇成一页——这才是编译区别于「切块入库」的地方' },
    { id: 'wiki-index', from: [], index: true, cross: false,
      narr: '生成 <b>index.md 综合索引</b> 串起所有页 ✓ 编译完成：wiki 从空长出 5 页、raw 🔒 一字未动——输入不变、知识层从无到有，这就是「编译」的物证' },
  ];

  var stageIndex = 0;
  var playing = false;
  var timer = null;
  var ro = null;

  function mkPath(d, color, width, dash, opacity) {
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', width);
    p.setAttribute('stroke-linecap', 'round');
    if (dash) p.setAttribute('stroke-dasharray', dash);
    p.setAttribute('opacity', opacity);
    return p;
  }

  function drawSource(fEl, tEl, bodyRect, cross) {
    var fr = fEl.getBoundingClientRect(), tr = tEl.getBoundingClientRect();
    var x1 = fr.right - bodyRect.left, y1 = fr.top - bodyRect.top + fr.height / 2;
    var x2 = tr.left - bodyRect.left, y2 = tr.top - bodyRect.top + tr.height / 2;
    var dx = (x2 - x1) * 0.45;
    var d = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
    svg.appendChild(mkPath(d, cross ? '#B9A892' : '#6E8C88', cross ? 2.6 : 2, null, cross ? 0.95 : 0.7));
  }

  function drawWikiLink(fEl, tEl, bodyRect) {
    var fr = fEl.getBoundingClientRect(), tr = tEl.getBoundingClientRect();
    var x1 = fr.left - bodyRect.left, y1 = fr.top - bodyRect.top + fr.height / 2;
    var x2 = tr.left - bodyRect.left, y2 = tr.top - bodyRect.top + tr.height / 2;
    var cx = Math.min(x1, x2) - 22;
    var d = 'M ' + x1 + ' ' + y1 + ' Q ' + cx + ' ' + ((y1 + y2) / 2) + ', ' + x2 + ' ' + y2;
    svg.appendChild(mkPath(d, '#6E8C88', 1.3, '4 3', 0.5));
  }

  function redraw() {
    if (!svg || !body) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var bodyRect = body.getBoundingClientRect();
    for (var i = 0; i < stageIndex; i++) {
      var st = STAGES[i];
      var toEl = slide.querySelector('#' + st.id);
      if (!toEl) continue;
      if (st.index) {
        ['wiki-concept', 'wiki-impl', 'wiki-falsify', 'wiki-cross'].forEach(function (tid) {
          var tEl = slide.querySelector('#' + tid);
          if (tEl) drawWikiLink(toEl, tEl, bodyRect);
        });
      } else {
        st.from.forEach(function (fid) {
          var fEl = slide.querySelector('#' + fid);
          if (fEl) drawSource(fEl, toEl, bodyRect, st.cross);
        });
      }
    }
  }

  function updateDots(n) {
    if (!dotsWrap) return;
    var dots = dotsWrap.querySelectorAll('.s010-dot');
    Array.prototype.forEach.call(dots, function (d, i) {
      if (i < n) d.classList.add('active'); else d.classList.remove('active');
    });
  }

  function updateButtons() {
    if (playBtn) {
      playBtn.disabled = playing;
      playBtn.textContent = stageIndex >= STAGES.length ? '▶ 重新播放' : (stageIndex > 0 ? '▶ 继续' : '▶ 播放编译');
    }
  }

  function advance(n) {
    stageIndex = n;
    WIKI_IDS.forEach(function (id, i) {
      var el = slide.querySelector('#' + id);
      if (!el) return;
      if (i < n) el.classList.add('grown'); else el.classList.remove('grown', 'pulse');
    });
    if (n >= 4) { var c = slide.querySelector('#wiki-cross'); if (c) c.classList.add('pulse'); }
    RAW_IDS.forEach(function (id) {
      var el = slide.querySelector('#' + id);
      if (el) { if (n >= STAGES.length) el.classList.add('locked-glow'); else el.classList.remove('locked-glow'); }
    });
    if (narration) narration.innerHTML = (n === 0) ? INIT_NARR : STAGES[n - 1].narr;
    updateDots(n);
    updateButtons();
    redraw();
  }

  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function play() {
    if (stageIndex >= STAGES.length) advance(0);
    playing = true;
    updateButtons();
    function next() {
      if (!playing) return;
      if (stageIndex >= STAGES.length) { playing = false; updateButtons(); return; }
      advance(stageIndex + 1);
      if (stageIndex < STAGES.length) timer = setTimeout(next, 1700);
      else { playing = false; updateButtons(); }
    }
    advance(stageIndex + 1);
    if (stageIndex < STAGES.length) timer = setTimeout(next, 1700);
    else { playing = false; updateButtons(); }
  }

  function pause() { playing = false; clearTimer(); updateButtons(); }
  function step() { pause(); if (stageIndex < STAGES.length) advance(stageIndex + 1); }
  function replay() { pause(); advance(0); }

  // 构建 dots
  if (dotsWrap) {
    dotsWrap.innerHTML = '';
    for (var i = 0; i < STAGES.length; i++) {
      var d = document.createElement('span');
      d.className = 's010-dot' + (i === 3 ? ' cross-dot' : '');
      dotsWrap.appendChild(d);
    }
  }

  if (playBtn) playBtn.addEventListener('click', play);
  if (pauseBtn) pauseBtn.addEventListener('click', pause);
  if (stepBtn) stepBtn.addEventListener('click', step);
  if (replayBtn) replayBtn.addEventListener('click', replay);

  // 初始化 + 连线三重重画
  advance(0);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  if (window.ResizeObserver && body) { ro = new ResizeObserver(redraw); ro.observe(body); }
  setTimeout(redraw, 120);

  return function cleanup() {
    clearTimer();
    playing = false;
    if (ro) { ro.disconnect(); ro = null; }
    if (playBtn) playBtn.removeEventListener('click', play);
    if (pauseBtn) pauseBtn.removeEventListener('click', pause);
    if (stepBtn) stepBtn.removeEventListener('click', step);
    if (replayBtn) replayBtn.removeEventListener('click', replay);
  };
};
