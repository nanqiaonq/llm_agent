/**
 * GBrain 课件 — 重交互 slideHooks 注册壳
 * 由 html-courseware-interactive-eng 填充
 *
 * 键名格式：'slides/SXX-filename.html'（完整路径，与 main.js slideFiles 一致）
 * 值格式：function() { ...; return function cleanup() { ... }; }
 *
 * 本文件：24 页占位 hook，return cleanup 形态
 * 重交互页（🔴🔴）：S008 动态建图 / S015 RRF 滑块沙盒
 *
 * 批次 Phase-3a 填充（slide-writer）：
 *   S002 toggle-dual-path-highlight
 *   S005 brain-dual-capability-reveal
 *   S016 search-think-toggle
 *
 * 批次 Phase-3b 填充（interactive-eng）：
 *   S008 graph-self-wiring-grow  🔴🔴
 *   S015 rrf-rank-slider-sandbox 🔴🔴
 */

window.slideHooks = window.slideHooks || {};

/* ─── S001 GBrain 封面 (🟢 静态) ─── */
window.slideHooks['slides/S001-gbrain-cover.html'] = function () {
  return function cleanup() {};
};

/* ─────────────────────────────────────────────────────────────────────────
   S002 编译式 RAG 是什么 (🔴 toggle-dual-path-highlight)
   FM 清单:
   FM-1 全部骨架 CSS 默认可见；GSAP 只用于 opacity dim/highlight 过渡
   FM-2 fromTo + paused:true，setTimeout(120ms) 待 slide active 后 play
   FM-3 cleanup: kill GSAP tweens + removeEventListener(named fn ref)
   ───────────────────────────────────────────────────────────────────────── */
window.slideHooks['slides/S002-compiled-rag-what.html'] = function () {
  var panelTraditional = document.getElementById('s002-panel-traditional');
  var panelCompiled    = document.getElementById('s002-panel-compiled');
  var btnTraditional   = document.getElementById('s002-btn-traditional');
  var btnCompiled      = document.getElementById('s002-btn-compiled');
  var keyStep          = document.getElementById('s002-key-step');

  if (!panelTraditional || !panelCompiled) return function cleanup() {};

  var tweens = [];
  var currentMode = 'traditional';

  /* 入场动画：两栏淡入 (fromTo paused) */
  var tlEntrance = gsap.timeline({ paused: true });
  tlEntrance.fromTo(
    [panelTraditional, panelCompiled],
    { opacity: 0, y: 14 },
    { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' }
  );

  /* 初始高亮状态：traditional 亮起 */
  function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    /* 更新 tab 按钮 */
    if (btnTraditional) btnTraditional.classList.toggle('active', mode === 'traditional');
    if (btnCompiled)    btnCompiled.classList.toggle('active',    mode === 'compiled');

    /* 清掉上一批 tweens */
    tweens.forEach(function (t) { t.kill(); });
    tweens = [];

    if (mode === 'compiled') {
      /* traditional → dim */
      tweens.push(
        gsap.to(panelTraditional, { opacity: 0.32, duration: 0.3, ease: 'power2.out' })
      );
      /* compiled → 亮 */
      tweens.push(
        gsap.to(panelCompiled, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      );
      panelCompiled.classList.add('s002-highlight');
      panelTraditional.classList.remove('s002-highlight');
      panelTraditional.classList.add('s002-dim');

      /* 关键步骤 accent 高亮 */
      if (keyStep) {
        tweens.push(
          gsap.fromTo(keyStep, { boxShadow: '0 0 0 rgba(232,168,73,0)' },
            { boxShadow: '0 0 20px rgba(232,168,73,0.35)', duration: 0.5, ease: 'power2.out' })
        );
        keyStep.classList.add('s002-key-active');
      }
    } else {
      /* compiled → dim */
      tweens.push(
        gsap.to(panelCompiled, { opacity: 0.32, duration: 0.3, ease: 'power2.out' })
      );
      /* traditional → 亮 */
      tweens.push(
        gsap.to(panelTraditional, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      );
      panelTraditional.classList.add('s002-highlight');
      panelCompiled.classList.remove('s002-highlight');
      panelCompiled.classList.add('s002-dim');

      /* 移除关键步骤高亮 */
      if (keyStep) {
        tweens.push(
          gsap.to(keyStep, { boxShadow: '0 0 0 rgba(232,168,73,0)', duration: 0.3 })
        );
        keyStep.classList.remove('s002-key-active');
      }
    }
  }

  /* named fn refs for removeEventListener */
  function onClickTraditional() { setMode('traditional'); }
  function onClickCompiled()    { setMode('compiled'); }

  if (btnTraditional) btnTraditional.addEventListener('click', onClickTraditional);
  if (btnCompiled)    btnCompiled.addEventListener('click', onClickCompiled);

  /* 入场动画 — slide active 后 120ms 触发 */
  setTimeout(function () {
    tlEntrance.play();
    /* 入场后自动切到 compiled 展示 payoff（v1.5 首屏完整态规则10） */
    setTimeout(function () { setMode('compiled'); }, 600);
  }, 120);

  return function cleanup() {
    gsap.killTweensOf(tlEntrance);
    tweens.forEach(function (t) { gsap.killTweensOf(t); t.kill(); });
    tlEntrance.kill();
    if (btnTraditional) btnTraditional.removeEventListener('click', onClickTraditional);
    if (btnCompiled)    btnCompiled.removeEventListener('click', onClickCompiled);
    /* 重置状态 */
    if (panelTraditional) { gsap.set(panelTraditional, { opacity: 1 }); }
    if (panelCompiled)    { gsap.set(panelCompiled, { opacity: 1 }); }
    if (keyStep)          { keyStep.classList.remove('s002-key-active'); }
  };
};

/* ─── S003 三层 + 三操作骨架 (🟡 layered-pyramid-reveal) ─── */
window.slideHooks['slides/S003-three-layer-three-op.html'] = function () {
  return function cleanup() {};
};

/* ─────────────────────────────────────────────────────────────────────────
   S003B GBrain 从哪来 (🟡 origin-genealogy-timeline)
   交互：点节点卡 → toggle 展开详情；入场逐节点点亮由 main.js animate-ready 驱动
   cleanup：removeEventListener(named fn ref) + 移除展开态
   ───────────────────────────────────────────────────────────────────────── */
window.slideHooks['slides/S003B-gbrain-origin.html'] = function () {
  var nodes = Array.prototype.slice.call(document.querySelectorAll('.s003b-node'));
  if (!nodes.length) return function cleanup() {};

  var handlers = [];
  nodes.forEach(function (node) {
    function onClick() { node.classList.toggle('s003b-expanded'); }
    node.addEventListener('click', onClick);
    handlers.push({ node: node, fn: onClick });
  });

  return function cleanup() {
    handlers.forEach(function (h) {
      h.node.removeEventListener('click', h.fn);
      h.node.classList.remove('s003b-expanded');
    });
  };
};

/* ─── S004 GBrain 是什么 + 三层架构 (🟡 layered-arch-support) ─── */
window.slideHooks['slides/S004-gbrain-three-layer-arch.html'] = function () {
  return function cleanup() {};
};

/* ─────────────────────────────────────────────────────────────────────────
   S005 两大核心能力总览 (🔴 brain-dual-capability-reveal · VOE 拍板)
   FM 清单:
   FM-1 大脑两半初始都亮(完整大脑)，CSS 默认可见
   FM-2 简介卡初始 display:none + opacity:0；点击先 display:flex 再 GSAP fromTo opacity/y
   FM-3 两半互不干扰——点一半另一卡维持状态不收起
   FM-4 cleanup: removeEventListener(named fn ref) + kill tweens + reset cards
   FM-5 严禁"只用了一半/另一半"措辞
   ───────────────────────────────────────────────────────────────────────── */
window.slideHooks['slides/S005-two-capabilities-overview.html'] = function () {
  var leftHalf         = document.getElementById('s005-left-half');
  var rightHalf        = document.getElementById('s005-right-half');
  var cardLeft         = document.getElementById('s005-card-left');
  var cardRight        = document.getElementById('s005-card-right');
  var placeholderLeft  = document.getElementById('s005-left-placeholder');
  var placeholderRight = document.getElementById('s005-right-placeholder');

  if (!leftHalf || !rightHalf) return function cleanup() {};

  var tweens = [];

  function revealCard(card, placeholder) {
    if (!card) return;
    /* 已揭示则跳过 */
    if (card.classList.contains('s005-revealed')) return;

    /* 隐藏占位符 */
    if (placeholder) placeholder.style.display = 'none';

    /* 先加 revealed 让 display:flex 生效，再 GSAP 从 opacity:0 动画到 opacity:1 */
    card.classList.add('s005-revealed');
    tweens.push(
      gsap.fromTo(card,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }
      )
    );
  }

  function onClickLeft()         { revealCard(cardLeft, placeholderLeft); }
  function onClickRight()        { revealCard(cardRight, placeholderRight); }
  function onClickPlaceholder(e) {
    var target = e.currentTarget.dataset.target;
    if (target === 'left')  revealCard(cardLeft, placeholderLeft);
    if (target === 'right') revealCard(cardRight, placeholderRight);
  }

  if (leftHalf)  leftHalf.addEventListener('click', onClickLeft);
  if (rightHalf) rightHalf.addEventListener('click', onClickRight);
  if (placeholderLeft)  placeholderLeft.addEventListener('click', onClickPlaceholder);
  if (placeholderRight) placeholderRight.addEventListener('click', onClickPlaceholder);

  /* 半脑 SVG hover 用 CSS 处理（已在 HTML style 定义），无需 JS */

  return function cleanup() {
    tweens.forEach(function (t) { t.kill(); });
    if (leftHalf)          leftHalf.removeEventListener('click', onClickLeft);
    if (rightHalf)         rightHalf.removeEventListener('click', onClickRight);
    if (placeholderLeft)   placeholderLeft.removeEventListener('click', onClickPlaceholder);
    if (placeholderRight)  placeholderRight.removeEventListener('click', onClickPlaceholder);
    /* 重置卡片 */
    if (cardLeft)  {
      cardLeft.classList.remove('s005-revealed');
      gsap.set(cardLeft, { opacity: 0 });
    }
    if (cardRight) {
      cardRight.classList.remove('s005-revealed');
      gsap.set(cardRight, { opacity: 0 });
    }
    if (placeholderLeft)  placeholderLeft.style.display = '';
    if (placeholderRight) placeholderRight.style.display = '';
  };
};

/* ─────────────────────────────────────────────────────────────────────────
   S006 两根轴 + 核心论断 (🟡 cause-effect-compile-hub · 方案C重构)
   交互：点中央 compile 枢纽 → 脉冲演示「改 source → 重编译 → brain 重建」
   入场逐元素点亮由 main.js animate-ready 机制驱动
   cleanup：removeEventListener(named fn ref) + 清 timer + 移除脉冲 class
   ───────────────────────────────────────────────────────────────────────── */
window.slideHooks['slides/S006-two-axes-core-thesis.html'] = function () {
  var hub        = document.getElementById('s006-hub');
  var arrow      = document.getElementById('s006-hub-arrow');
  var sourceCard = document.getElementById('s006-card-source');
  var brainCard  = document.getElementById('s006-card-brain');
  if (!hub || !arrow || !sourceCard || !brainCard) return function cleanup() {};

  var timers = [];
  var running = false;

  function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
  }

  function resetClasses() {
    sourceCard.classList.remove('s006-pulse');
    arrow.classList.remove('s006-flowing');
    brainCard.classList.remove('s006-rebuilding');
  }

  function playPulse() {
    if (running) return;       /* 脉冲进行中忽略重复点击 */
    running = true;
    resetClasses();
    void arrow.offsetWidth;    /* 强制 reflow 让 animation 可重播 */

    sourceCard.classList.add('s006-pulse');          /* source 高亮：改了源 */
    arrow.classList.add('s006-flowing');             /* 流光：编译流向 */
    timers.push(setTimeout(function () {
      brainCard.classList.add('s006-rebuilding');    /* brain 重建脉冲 */
    }, 480));
    timers.push(setTimeout(function () {
      resetClasses();
      running = false;
    }, 1500));
  }

  hub.addEventListener('click', playPulse);

  return function cleanup() {
    clearTimers();
    resetClasses();
    running = false;
    hub.removeEventListener('click', playPulse);
  };
};

/* ─── S007 建图的起点 (🟡 markdown-wikilink-highlight) ─── */
window.slideHooks['slides/S007-declare-relationship.html'] = function () {
  return function cleanup() {};
};

/* ─────────────────────────────────────────────────────────────────────────
   S008 动态建图演示 (🔴🔴 graph-self-wiring-grow)
   FM 清单:
   FM-1 fromTo+paused+120ms timer — 防 display:none 时序 bug（s017 L1）
   FM-2 timeline.call 在 stage 时间点同步计数+tweenTo onComplete 强制同步
   FM-3 selectedNode 单一真值源 — 每次 click 先 reset 所有 class 再施加新态；
         cleanup 中 killTweensOf(tl)+tl.kill+清 SVG opacity+移除所有 listener+重置计数
   ───────────────────────────────────────────────────────────────────────── */
window.slideHooks['slides/S008-dynamic-graph-grow.html'] = function () {
  /* FM 清单: FM-1 fromTo+paused+120ms / FM-2 timeline.call 同步+tweenTo onComplete / FM-3 selectedNode 真值源+全量 cleanup */

  var slide = document.querySelector('.slide');
  if (!slide) return function noop() {};

  /* ── DOM 工具 ── */
  function getEl(id) { return document.getElementById(id); }
  function getEls(ids) { return ids.map(getEl).filter(Boolean); }

  /* ── 边元素 ── */
  var foundedEdges  = getEls(['s008-e01','s008-e02']);
  var worksEdges    = getEls(['s008-e03','s008-e04','s008-e05','s008-e06']);
  var investedEdges = getEls(['s008-e07','s008-e08','s008-e09','s008-e10','s008-e11','s008-e12','s008-e13','s008-e14','s008-e15']);
  var advisesEdges  = getEls(['s008-e16']);
  var allEdges      = foundedEdges.concat(worksEdges, investedEdges, advisesEdges);

  /* ── 边标签 ── */
  var foundedLabels  = getEls(['s008-el01','s008-el02']);
  var worksLabels    = getEls(['s008-el03','s008-el04','s008-el05','s008-el06']);
  var investedLabels = getEls(['s008-el07','s008-el08','s008-el09','s008-el10','s008-el11','s008-el12','s008-el13','s008-el14','s008-el15']);
  var advisesLabels  = getEls(['s008-el16']);
  var allLabels      = foundedLabels.concat(worksLabels, investedLabels, advisesLabels);

  /* ── 节点 ── */
  var nodeEls = getEls(['s008-n-alice','s008-n-bob','s008-n-carol','s008-n-nexaflow','s008-n-sparkfield','s008-n-alphaventures']);
  var svgEl   = getEl('s008-svg');

  /* ── 控制 UI ── */
  var btnReplay = getEl('s008-btn-replay');
  var btnPause  = getEl('s008-btn-pause');
  var btnStep   = getEl('s008-btn-step');
  var btnDelete = getEl('s008-btn-delete');
  var traceTip  = getEl('s008-trace-tip');

  var dots     = getEls(['s008-d0','s008-d1','s008-d2','s008-d3','s008-d4']);
  var stageInd = getEl('s008-stage-ind');

  var edgeCountEl = getEl('s008-edge-count');
  var barFounded  = getEl('s008-bar-founded');
  var barWorks    = getEl('s008-bar-works');
  var barInvested = getEl('s008-bar-invested');
  var barAdvises  = getEl('s008-bar-advises');
  var cntFounded  = getEl('s008-cnt-founded');
  var cntWorks    = getEl('s008-cnt-works');
  var cntInvested = getEl('s008-cnt-invested');
  var cntAdvises  = getEl('s008-cnt-advises');

  /* ── 状态 ── */
  var tl = null;
  var entranceTimer = null;  /* ←FM-1 timer ref 用于 cleanup */
  var currentStageIdx = 0;
  var selectedNode = null;   /* ←FM-3 单一真值源 */
  var wikiLinkDeleted = false;
  var hitAreas = [];

  /* ── 数据常量 ── */
  /* timeline 每个 stage 的结束时间（秒）
     Stage 0: 0~0.6   节点入场 (6个×{stagger:0.04,dur:0.4})
     Stage 1: 0.6~2.15 founded (2边+2label×{stagger:0.35,dur:0.5})
     Stage 2: 2.2~4.0  works_at (4边+4label×{stagger:0.2,dur:0.4})
     Stage 3: 4.0~7.8  invested_in (9边+9label×{stagger:0.2,dur:0.4})
     Stage 4: 7.8~8.5  advises (1边+1label×{dur:0.6})            */
  var stageEnds = [0.6, 2.2, 4.0, 7.8, 8.5];

  var STAGE_NAMES = [
    'stage 1/5 · 6 孤立节点',
    'stage 2/5 · founded 关系（2 条）',
    'stage 3/5 · works_at 关系（4 条）',
    'stage 4/5 · invested_in 关系（9 条）',
    'stage 5/5 · advises 关系（1 条）',
  ];

  var STAGE_COUNTS = [
    { founded:0, works:0, invested:0, advises:0, total:0 },
    { founded:2, works:0, invested:0, advises:0, total:2 },
    { founded:2, works:4, invested:0, advises:0, total:6 },
    { founded:2, works:4, invested:9, advises:0, total:15 },
    { founded:2, works:4, invested:9, advises:1, total:16 },
  ];

  var EDGE_TRACE = {
    's008-e01': 'alice-chen.md:10 → "the founder of [[companies/nexaflow]]" → FOUNDED_RE',
    's008-e02': 'nexaflow.md frontmatter → key_people: alice-chen → founded',
    's008-e03': 'carol-wu.md → "works at [[companies/nexaflow]]" → WORKS_AT_RE',
    's008-e04': 'bob-morgan.md → "works at [[companies/alphaventures]]" → WORKS_AT_RE',
    's008-e05': 'nexaflow.md frontmatter → employees: carol-wu',
    's008-e06': 'alphaventures.md frontmatter → key_people: bob-morgan',
    's008-e07': 'bob-morgan.md → "invested in [[companies/nexaflow]]" → INVESTED_RE',
    's008-e08': 'bob-morgan.md → "invested in [[companies/sparkfield]]" → INVESTED_RE',
    's008-e09': 'alphaventures.md → "invested in [[companies/nexaflow]]" → INVESTED_RE',
    's008-e10': 'alphaventures.md → "invested in [[companies/sparkfield]]" → INVESTED_RE',
    's008-e11': 'sparkfield.md ⚠ false positive — INVESTED_RE 上下文溢出，实为 advises',
    's008-e12': 'sparkfield.md frontmatter → investors: bob-morgan',
    's008-e13': 'nexaflow.md frontmatter → investors: alphaventures',
    's008-e14': 'nexaflow.md frontmatter → investors: bob-morgan',
    's008-e15': 'sparkfield.md frontmatter → investors: alphaventures',
    's008-e16': 'alice-chen.md → "advisor to [[companies/sparkfield]]" → ADVISES_RE',
  };

  var NODE_EDGES = {
    's008-n-alice':         ['s008-e01','s008-e02','s008-e11','s008-e16'],
    's008-n-bob':           ['s008-e04','s008-e06','s008-e07','s008-e08','s008-e12','s008-e14'],
    's008-n-carol':         ['s008-e03','s008-e05'],
    's008-n-nexaflow':      ['s008-e01','s008-e02','s008-e03','s008-e05','s008-e07','s008-e09','s008-e13','s008-e14'],
    's008-n-sparkfield':    ['s008-e08','s008-e10','s008-e11','s008-e12','s008-e15','s008-e16'],
    's008-n-alphaventures': ['s008-e04','s008-e06','s008-e09','s008-e10','s008-e13','s008-e15'],
  };

  /* ── UI 更新 ── */
  function setStage(idx) {
    currentStageIdx = idx;
    dots.forEach(function(d, i) { d.classList.toggle('active', i <= idx); });
    if (stageInd) stageInd.textContent = STAGE_NAMES[idx] || STAGE_NAMES[STAGE_NAMES.length-1];
  }

  function applyCount(snap) {
    if (!snap) return;
    if (edgeCountEl) edgeCountEl.textContent = snap.total;
    if (barFounded)  barFounded.style.width  = Math.round(snap.founded  / 2 * 100) + '%';
    if (barWorks)    barWorks.style.width    = Math.round(snap.works    / 4 * 100) + '%';
    if (barInvested) barInvested.style.width = Math.round(snap.invested / 9 * 100) + '%';
    if (barAdvises)  barAdvises.style.width  = Math.round(snap.advises  / 1 * 100) + '%';
    if (cntFounded)  cntFounded.textContent  = snap.founded;
    if (cntWorks)    cntWorks.textContent    = snap.works;
    if (cntInvested) cntInvested.textContent = snap.invested;
    if (cntAdvises)  cntAdvises.textContent  = snap.advises;
  }

  function resetCountUI() { applyCount(STAGE_COUNTS[0]); }

  /* ── 构建 Timeline ── */
  function buildTimeline() {
    if (tl) { gsap.killTweensOf(tl); tl.kill(); }  /* ←FM-3 先 killTweensOf(陷阱⑧) */
    tl = gsap.timeline({ paused: true });  /* ←FM-1 paused:true */

    /* Stage 0: 节点轻微入场（骨架内容，fromTo 起始 opacity 0.75 非 0，防陷阱⑦） */
    tl.fromTo(nodeEls,
      { opacity: 0.75, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out', transformOrigin: 'center center' }
    );
    tl.call(function() { setStage(0); applyCount(STAGE_COUNTS[0]); }, [], 0.01);

    /* Stage 1: founded (2条边 + 2条label) */
    tl.fromTo(foundedEdges.concat(foundedLabels),
      { opacity: 0 },
      { opacity: 1, duration: 0.5, stagger: 0.35, ease: 'power2.out' },
      0.6
    );
    tl.call(function() { setStage(1); }, [], 0.61);
    tl.call(function() { applyCount(STAGE_COUNTS[1]); }, [], 2.15);

    /* Stage 2: works_at (4条边 + 4条label) */
    tl.fromTo(worksEdges.concat(worksLabels),
      { opacity: 0 },
      { opacity: 1, duration: 0.4, stagger: 0.2, ease: 'power2.out' },
      2.2
    );
    tl.call(function() { setStage(2); }, [], 2.21);
    tl.call(function() { applyCount(STAGE_COUNTS[2]); }, [], 4.0);

    /* Stage 3: invested_in (9条边 + 9条label) */
    tl.fromTo(investedEdges.concat(investedLabels),
      { opacity: 0 },
      { opacity: 1, duration: 0.4, stagger: 0.2, ease: 'power2.out' },
      4.0
    );
    tl.call(function() { setStage(3); }, [], 4.01);
    tl.call(function() { applyCount(STAGE_COUNTS[3]); }, [], 7.8);

    /* Stage 4: advises (1条边 + 1条label) */
    tl.fromTo(advisesEdges.concat(advisesLabels),
      { opacity: 0 },
      { opacity: 1, duration: 0.6, ease: 'power2.out' },
      7.8
    );
    tl.call(function() { setStage(4); }, [], 7.81);
    tl.call(function() { applyCount(STAGE_COUNTS[4]); }, [], 8.4);

    return tl;
  }

  /* ── 三按钮实现 ── */
  function buildAndPlay() {
    /* ←FM-3 重置 wikiLink 状态 */
    wikiLinkDeleted = false;
    if (btnDelete) {
      btnDelete.textContent = '🗑 删一条 wikilink';
      btnDelete.style.color = 'var(--s008-accent)';
    }
    /* 重置节点/边 class */
    selectedNode = null;
    nodeEls.forEach(function(n) { n.classList.remove('s008-node-active'); });
    allEdges.forEach(function(e) { e.classList.remove('s008-edge-dim','s008-edge-highlight'); });

    buildTimeline();
    setStage(0);
    resetCountUI();
    tl.play();
    if (btnPause) btnPause.textContent = '⏸ 暂停';
  }

  function stepNext() {
    if (!tl) return;
    if (currentStageIdx >= stageEnds.length - 1) {
      buildAndPlay();
      return;
    }
    var nextIdx = currentStageIdx + 1;
    var target  = stageEnds[nextIdx] - 0.05;
    tl.tweenTo(target, {
      ease: 'none',
      onComplete: function() {
        if (!tl) return;  /* ←FM-2 防切页后 null 错误 */
        tl.pause();
        setStage(nextIdx);
        applyCount(STAGE_COUNTS[nextIdx]);
        if (btnPause) btnPause.textContent = '▶ 继续';
      }
    });
  }

  /* ── 事件处理（具名函数）── */
  function handleReplay() { buildAndPlay(); }

  function handlePause() {
    if (!tl) return;
    if (tl.paused()) {
      tl.play();
      if (btnPause) btnPause.textContent = '⏸ 暂停';
    } else {
      tl.pause();
      if (btnPause) btnPause.textContent = '▶ 继续';
    }
  }

  function handleStep() { stepNext(); }

  function handleDelete() {
    var e16  = getEl('s008-e16');
    var el16 = getEl('s008-el16');
    if (wikiLinkDeleted) {
      wikiLinkDeleted = false;
      if (e16)  gsap.to(e16,  { opacity: 1, duration: 0.4 });
      if (el16) gsap.to(el16, { opacity: 1, duration: 0.4 });
      if (btnDelete) {
        btnDelete.textContent = '🗑 删一条 wikilink';
        btnDelete.style.color = 'var(--s008-accent)';
      }
      if (currentStageIdx >= 4) applyCount(STAGE_COUNTS[4]);
    } else {
      wikiLinkDeleted = true;
      if (e16)  gsap.to(e16,  { opacity: 0, duration: 0.4 });
      if (el16) gsap.to(el16, { opacity: 0, duration: 0.4 });
      if (btnDelete) {
        btnDelete.textContent = '↩ 恢复 wikilink';
        btnDelete.style.color = 'var(--s008-primary)';
      }
      if (currentStageIdx >= 4) {
        applyCount({ founded:2, works:4, invested:9, advises:0, total:15 });
      }
    }
  }

  /* 节点 click 委托（SVG 上） */
  function handleSvgClick(e) {
    var target = e.target;
    var nodeGroup = null;
    while (target && target !== svgEl) {
      if (target.classList && target.classList.contains('s008-node-group')) {
        nodeGroup = target;
        break;
      }
      target = target.parentElement;
    }

    if (!nodeGroup) {
      /* 点空白 → 取消选中 ←FM-3 reset */
      if (selectedNode) {
        selectedNode = null;
        nodeEls.forEach(function(n) { n.classList.remove('s008-node-active'); });
        allEdges.forEach(function(edge) { edge.classList.remove('s008-edge-dim','s008-edge-highlight'); });
      }
      return;
    }

    var nodeId = nodeGroup.id;
    if (selectedNode === nodeId) {
      /* 再次点击取消 ←FM-3 */
      selectedNode = null;
      nodeEls.forEach(function(n) { n.classList.remove('s008-node-active'); });
      allEdges.forEach(function(edge) { edge.classList.remove('s008-edge-dim','s008-edge-highlight'); });
    } else {
      selectedNode = nodeId;  /* ←FM-3 单一真值源 */
      nodeEls.forEach(function(n) { n.classList.toggle('s008-node-active', n.id === nodeId); });
      var relatedIds = NODE_EDGES[nodeId] || [];
      allEdges.forEach(function(edge) {
        var isRel = relatedIds.indexOf(edge.id) !== -1;
        edge.classList.toggle('s008-edge-highlight', isRel);
        edge.classList.toggle('s008-edge-dim', !isRel);
      });
    }
  }

  /* 边 hover → traceTip（SVG mousemove 委托） */
  function handleSvgMousemove(e) {
    if (!traceTip) return;
    var target = e.target;
    if (target && target.tagName === 'line' && EDGE_TRACE[target.id]) {
      var op = parseFloat(window.getComputedStyle(target).opacity);
      if (op > 0.1) {
        traceTip.textContent = EDGE_TRACE[target.id];
        traceTip.style.left = (e.clientX + 14) + 'px';
        traceTip.style.top  = (e.clientY - 36) + 'px';
        traceTip.classList.add('visible');
        return;
      }
    }
    traceTip.classList.remove('visible');
  }

  function handleSvgMouseleave() {
    if (traceTip) traceTip.classList.remove('visible');
  }

  /* ── 动态创建 hitArea（增大边的 hover 触发区域）── */
  function createHitAreas() {
    if (!svgEl) return;
    allEdges.forEach(function(edge) {
      if (!edge) return;
      var hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hit.setAttribute('x1', edge.getAttribute('x1'));
      hit.setAttribute('y1', edge.getAttribute('y1'));
      hit.setAttribute('x2', edge.getAttribute('x2'));
      hit.setAttribute('y2', edge.getAttribute('y2'));
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '14');
      hit.setAttribute('pointer-events', 'stroke');
      hit.dataset.edgeId = edge.id;
      edge.parentNode.insertBefore(hit, edge.nextSibling);
      hitAreas.push(hit);
    });
  }

  function removeHitAreas() {
    hitAreas.forEach(function(h) { if (h.parentNode) h.parentNode.removeChild(h); });
    hitAreas = [];
  }

  /* ── 绑定事件 ── */
  if (btnReplay) btnReplay.addEventListener('click', handleReplay);
  if (btnPause)  btnPause.addEventListener('click', handlePause);
  if (btnStep)   btnStep.addEventListener('click', handleStep);
  if (btnDelete) btnDelete.addEventListener('click', handleDelete);
  if (svgEl) {
    svgEl.addEventListener('click', handleSvgClick);
    svgEl.addEventListener('mousemove', handleSvgMousemove);
    svgEl.addEventListener('mouseleave', handleSvgMouseleave);
  }

  /* ── 初始化 ── */
  createHitAreas();
  setStage(0);
  resetCountUI();
  buildTimeline();

  /* ←FM-1 延迟播放：等 slide 从 display:none 变可见后再启动 */
  entranceTimer = setTimeout(function() {
    if (tl) tl.play();
    if (btnPause) btnPause.textContent = '⏸ 暂停';
  }, 120);

  /* ── cleanup ── */
  return function cleanup() {
    clearTimeout(entranceTimer);  /* ←FM-1 */
    if (tl) {
      gsap.killTweensOf(tl);  /* ←FM-3 先 killTweensOf 再 kill（陷阱⑧）*/
      tl.kill();
      tl = null;
    }
    gsap.killTweensOf(allEdges.concat(allLabels));
    gsap.killTweensOf(nodeEls);
    /* 清除 GSAP inline style → 元素回 CSS 默认态（边 opacity:0，节点 opacity:1） */
    gsap.set(allEdges.concat(allLabels), { clearProps: 'opacity' });
    gsap.set(nodeEls, { clearProps: 'opacity,scale,transform' });
    /* 重置 class ←FM-3 */
    selectedNode = null;
    nodeEls.forEach(function(n) { n.classList.remove('s008-node-active'); });
    allEdges.forEach(function(e) { e.classList.remove('s008-edge-dim','s008-edge-highlight'); });
    /* 重置计数 */
    resetCountUI();
    setStage(0);
    /* 移除 hitAreas */
    removeHitAreas();
    /* 移除事件 */
    if (btnReplay) btnReplay.removeEventListener('click', handleReplay);
    if (btnPause)  btnPause.removeEventListener('click', handlePause);
    if (btnStep)   btnStep.removeEventListener('click', handleStep);
    if (btnDelete) btnDelete.removeEventListener('click', handleDelete);
    if (svgEl) {
      svgEl.removeEventListener('click', handleSvgClick);
      svgEl.removeEventListener('mousemove', handleSvgMousemove);
      svgEl.removeEventListener('mouseleave', handleSvgMouseleave);
    }
    /* 隐藏 tooltip */
    if (traceTip) traceTip.classList.remove('visible');
    wikiLinkDeleted = false;
    if (btnPause) btnPause.textContent = '⏸ 暂停';
  };
};

/* ─── S009 零 LLM 确定性与可追溯 (🟡 edge-to-source-trace) ─── */
window.slideHooks['slides/S009-zero-llm-deterministic.html'] = function () {
  return function cleanup() {};
};

/* ─── S010 self-wiring vs GraphRAG (🟡 comparison-matrix-dual-input) ─── */
window.slideHooks['slides/S010-selfwiring-vs-graphrag.html'] = function () {
  return function cleanup() {};
};

/* ─── S011 源真相 vs 编译产物双轨 (🟡 dual-track-one-way-compile) ─── */
window.slideHooks['slides/S011-source-vs-compiled-dual-track.html'] = function () {
  return function cleanup() {};
};

/* ─── S012 两引擎一契约 + embedding (🟡 engine-contract-semantic-space) ─── */
window.slideHooks['slides/S012-two-engines-one-contract.html'] = function () {
  return function cleanup() {};
};

/* ─── S013 为什么要混合检索 (🟡 venn-blindspot-overlap) ─── */
window.slideHooks['slides/S013-why-hybrid-retrieval.html'] = function () {
  return function cleanup() {};
};

/* ─── S014 三路合流 HNSW+BM25+RRF (🟡 parallel-merge-flow) ─── */
window.slideHooks['slides/S014-three-way-merge-flow.html'] = function () {
  return function cleanup() {};
};

/* ─────────────────────────────────────────────────────────────────────────
   S015 RRF 为什么不能直接加分 (🔴🔴 rrf-rank-slider-sandbox)
   FM 清单:
   FM-1 requestAnimationFrame 节流滑块 input — 防高频触发卡顿/闪烁
   FM-2 cleanup 中 cancelAnimationFrame + removeEventListener — 防双绑
   FM-3 clamp [1,10] + NaN → 0 兜底 — 防分母异常和 NaN 显示
   ───────────────────────────────────────────────────────────────────────── */
window.slideHooks['slides/S015-rrf-rank-slider.html'] = function () {
  /* FM 清单: FM-1 RAF 节流 / FM-2 cleanup cancel+remove / FM-3 clamp+NaN 兜底 */

  var slide = document.querySelector('.slide');
  if (!slide) return function noop() {};

  /* ── DOM ── */
  var sliderVec   = document.getElementById('s015-slider-vec');
  var sliderBm25  = document.getElementById('s015-slider-bm25');
  var vecRankVal  = document.getElementById('s015-vec-rank-val');
  var bm25RankVal = document.getElementById('s015-bm25-rank-val');

  var vecRawEl    = document.getElementById('s015-vec-raw');
  var bm25RawEl   = document.getElementById('s015-bm25-raw');

  var barVecDirect    = document.getElementById('s015-bar-vec-direct');
  var barBm25Direct   = document.getElementById('s015-bar-bm25-direct');
  var valVecDirect    = document.getElementById('s015-val-vec-direct');
  var valBm25Direct   = document.getElementById('s015-val-bm25-direct');
  var directTotal     = document.getElementById('s015-direct-total');
  var domWarn         = document.getElementById('s015-dom-warn');
  var bm25PctEl       = document.getElementById('s015-bm25-pct');

  var barVecRrf    = document.getElementById('s015-bar-vec-rrf');
  var barBm25Rrf   = document.getElementById('s015-bar-bm25-rrf');
  var valVecRrf    = document.getElementById('s015-val-vec-rrf');
  var valBm25Rrf   = document.getElementById('s015-val-bm25-rrf');
  var rrfTotal     = document.getElementById('s015-rrf-total');
  var vecPctRrfEl  = document.getElementById('s015-vec-pct-rrf');

  if (!sliderVec || !sliderBm25) return function noop() {};

  /* ── 状态 ── */
  var rafId = null;  /* ←FM-1 RAF id */
  var K     = 60;    /* RRF 平滑常数 */

  /* ── 计算 ── */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }  /* ←FM-3 */

  /* 模拟原始分（量纲不同·对齐 lesson 实测 BM25 2.9167 / 向量 1.0499，差约 2.9 倍）：
     向量原始分 cos_sim ∈[0,1]：名次 1 → 1.00，名次 10 → 0.28
     BM25 原始分 tsvector ∈[0,3]：名次 1 → 2.92，名次 10 → 0.90
     BM25 量纲约是向量的 2.9 倍 */
  function vecRaw(rank) {
    var r = clamp(rank, 1, 10);
    return Math.max(0, 1.00 - (r - 1) * 0.08);  /* 1.00 → 0.28 */
  }

  function bm25Raw(rank) {
    var r = clamp(rank, 1, 10);
    return Math.max(0, 2.92 - (r - 1) * 0.224); /* 2.92 → 0.90 */
  }

  function rrfScore(rank) {
    var r = clamp(rank, 1, 10);
    return 1 / (K + r);
  }

  function safeNum(n, dec) {
    if (!isFinite(n) || isNaN(n)) return '—';  /* ←FM-3 NaN 兜底 */
    return n.toFixed(dec !== undefined ? dec : 4);
  }

  /* ── UI 更新 ── */
  function updateUI() {
    var vRank = clamp(parseInt(sliderVec.value, 10), 1, 10);   /* ←FM-3 */
    var bRank = clamp(parseInt(sliderBm25.value, 10), 1, 10);

    if (vecRankVal)  vecRankVal.textContent  = vRank;
    if (bm25RankVal) bm25RankVal.textContent = bRank;

    /* 原始分 */
    var vRaw = vecRaw(vRank);
    var bRaw = bm25Raw(bRank);
    if (vecRawEl)  vecRawEl.textContent  = safeNum(vRaw, 3);
    if (bm25RawEl) bm25RawEl.textContent = safeNum(bRaw, 2);

    /* 直接加法 */
    var maxRaw    = 26.0 + 0.92;  /* 最大可能直接加法总分 */
    var directSum = vRaw + bRaw;
    var vPct      = directSum > 0 ? vRaw  / directSum * 100 : 50;
    var bPct      = directSum > 0 ? bRaw  / directSum * 100 : 50;

    if (barVecDirect)  barVecDirect.style.width  = Math.min(100, vRaw / maxRaw * 100).toFixed(1) + '%';
    if (barBm25Direct) barBm25Direct.style.width = Math.min(100, bRaw / maxRaw * 100).toFixed(1) + '%';
    if (valVecDirect)  valVecDirect.textContent  = safeNum(vRaw, 3);
    if (valBm25Direct) valBm25Direct.textContent = safeNum(bRaw, 2);
    if (directTotal)   directTotal.textContent   = safeNum(directSum, 2);
    if (bm25PctEl)     bm25PctEl.textContent     = safeNum(bPct, 1) + '%';

    /* RRF */
    var vRrf   = rrfScore(vRank);
    var bRrf   = rrfScore(bRank);
    var rrfSum = vRrf + bRrf;
    var vRrfPct = rrfSum > 0 ? vRrf / rrfSum * 100 : 50;
    var bRrfPct = rrfSum > 0 ? bRrf / rrfSum * 100 : 50;

    /* RRF bar：相对于最大可能（rank=1 两路都是 1/61）归一化 */
    var maxRrf = 1/(K+1);
    if (barVecRrf)  barVecRrf.style.width  = Math.min(100, vRrf / maxRrf * 100).toFixed(1) + '%';
    if (barBm25Rrf) barBm25Rrf.style.width = Math.min(100, bRrf / maxRrf * 100).toFixed(1) + '%';
    if (valVecRrf)  valVecRrf.textContent  = '1/' + (K + vRank) + ' = ' + safeNum(vRrf, 5);
    if (valBm25Rrf) valBm25Rrf.textContent = '1/' + (K + bRank) + ' = ' + safeNum(bRrf, 5);
    if (rrfTotal)   rrfTotal.textContent   = safeNum(rrfSum, 5);
    if (vecPctRrfEl) vecPctRrfEl.textContent = safeNum(vRrfPct, 1) + '%';

    /* 主导警告：BM25 占比 > 70% 时加 blink */
    if (domWarn) {
      var dominated = bPct > 70;
      domWarn.classList.toggle('s015-blink', dominated);
    }
  }

  /* ── RAF 节流（←FM-1）── */
  function scheduleUpdate() {
    if (rafId !== null) return;  /* 已有 pending RAF，跳过 */
    rafId = requestAnimationFrame(function() {
      rafId = null;
      updateUI();
    });
  }

  /* ── 事件绑定 ── */
  function handleVecInput()  { scheduleUpdate(); }
  function handleBm25Input() { scheduleUpdate(); }

  sliderVec.addEventListener('input',  handleVecInput);
  sliderBm25.addEventListener('input', handleBm25Input);

  /* ── 初始渲染 ── */
  updateUI();

  /* ── cleanup ── */
  return function cleanup() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);  /* ←FM-2 取消 pending RAF */
      rafId = null;
    }
    sliderVec.removeEventListener('input',  handleVecInput);   /* ←FM-2 解绑 */
    sliderBm25.removeEventListener('input', handleBm25Input);
  };
};

/* ─────────────────────────────────────────────────────────────────────────
   S016 search 给页面 vs think 给答案 (🔴 search-think-toggle)
   FM 清单:
   FM-1 初始态 = search 面板完整可见(首屏完整态)
   FM-2 切 think 时：先 show panel，再 GSAP fromTo stagger sentences(opacity 0→1, y 8→0)
        再 fromTo citations(opacity 0→1, scale 0.8→1) + 追加 gap-section fromTo
   FM-3 sentences/citations/gap 初始 opacity:0(交互揭示元素，非静态骨架，允许)
   FM-4 cleanup: removeEventListener(named fn ref) + kill timeline + 恢复 search 态
   ───────────────────────────────────────────────────────────────────────── */
window.slideHooks['slides/S016-search-vs-think.html'] = function () {
  var searchPanel = document.getElementById('s016-search-panel');
  var thinkPanel  = document.getElementById('s016-think-panel');
  var btnSearch   = document.getElementById('s016-btn-search');
  var btnThink    = document.getElementById('s016-btn-think');
  var gapSection  = document.getElementById('s016-gap-section');

  if (!searchPanel || !thinkPanel) return function cleanup() {};

  var currentMode = 'search';
  var thinkTL = null;

  function buildThinkTimeline() {
    if (thinkTL) { thinkTL.kill(); }
    thinkTL = gsap.timeline({ paused: true });

    /* sentences 逐句出现 */
    var sentences = thinkPanel.querySelectorAll('.s016-sentence');
    thinkTL.fromTo(sentences,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, stagger: 0.18, duration: 0.42, ease: 'power2.out' }
    );

    /* citations 随句子出现 */
    var citations = thinkPanel.querySelectorAll('.s016-citation');
    thinkTL.fromTo(citations,
      { opacity: 0, scale: 0.75 },
      { opacity: 1, scale: 1, stagger: 0.08, duration: 0.3, ease: 'back.out(1.4)' },
      '-=0.6'
    );

    /* gap 区域最后出现 */
    if (gapSection) {
      thinkTL.fromTo(gapSection,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
        '-=0.1'
      );
    }

    /* citation 亮光效果 */
    thinkTL.call(function () {
      citations.forEach(function (c) { c.classList.add('s016-citation-lit'); });
    });

    return thinkTL;
  }

  function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    if (mode === 'think') {
      searchPanel.classList.add('s016-hidden');
      thinkPanel.classList.remove('s016-hidden');
      if (btnSearch) btnSearch.classList.remove('active');
      if (btnThink)  btnThink.classList.add('active');

      /* 重置 sentences/citations/gap opacity 为 0 再重播 */
      var sentences = thinkPanel.querySelectorAll('.s016-sentence');
      var citations = thinkPanel.querySelectorAll('.s016-citation');
      gsap.set(sentences, { opacity: 0, y: 8 });
      gsap.set(citations, { opacity: 0, scale: 0.75 });
      if (gapSection) gsap.set(gapSection, { opacity: 0, y: 6 });
      citations.forEach(function (c) { c.classList.remove('s016-citation-lit'); });

      buildThinkTimeline().play();
    } else {
      /* 切回 search */
      if (thinkTL) thinkTL.kill();
      thinkPanel.classList.add('s016-hidden');
      searchPanel.classList.remove('s016-hidden');
      if (btnThink)   btnThink.classList.remove('active');
      if (btnSearch)  btnSearch.classList.add('active');
    }
  }

  function onClickSearch() { setMode('search'); }
  function onClickThink()  { setMode('think'); }

  if (btnSearch) btnSearch.addEventListener('click', onClickSearch);
  if (btnThink)  btnThink.addEventListener('click', onClickThink);

  return function cleanup() {
    if (thinkTL) { gsap.killTweensOf(thinkTL); thinkTL.kill(); }
    if (btnSearch) btnSearch.removeEventListener('click', onClickSearch);
    if (btnThink)  btnThink.removeEventListener('click', onClickThink);
    /* 恢复 search 初始态 */
    if (searchPanel) searchPanel.classList.remove('s016-hidden');
    if (thinkPanel)  thinkPanel.classList.add('s016-hidden');
    if (btnSearch)   btnSearch.classList.add('active');
    if (btnThink)    btnThink.classList.remove('active');
  };
};

/* ─── S017 空白分析 gap 三信号 (🟡 gap-three-signal-cards) ─── */
window.slideHooks['slides/S017-gap-three-signals.html'] = function () {
  return function cleanup() {};
};

/* ─── S018 find_trajectory 时序复利 (🔴 unified-axis-aligned-lanes) ───
   时刻列 hover/点击 → 跨三泳道竖切片高亮 + 因果洞察更新；默认选中 2022 Q2 因果簇 */
window.slideHooks['slides/S018-find-trajectory-temporal.html'] = function () {
  var root = document.getElementById('S018');
  if (!root) return function cleanup() {};

  var bands = [].slice.call(root.querySelectorAll('.s18-band'));
  var nodes = [].slice.call(root.querySelectorAll('.s18-node'));
  var tags  = [].slice.call(root.querySelectorAll('.s18-node-tag'));
  var box   = root.querySelector('.s18-insight');
  var tsEl  = root.querySelector('.s18-insight-ts');
  var txtEl = root.querySelector('.s18-insight-text');

  var DATA = [
    { ts: '2021 Q3', causal: false, txt: '起点基线：种子轮 · 3 人团队 · MAU 2k——后面所有变化的起跑线' },
    { ts: '2022 Q1', causal: false, txt: 'Carol Wu 加入担任 CTO → 工程团队从 3 人快速扩张到 8 人' },
    { ts: '2022 Q2', causal: true,  txt: 'A 轮融资落地，同一时刻 MAU 从 2k 加速到 8k——融资与指标在同一列对齐，因果一眼显现' },
    { ts: '2022 Q4', causal: false, txt: '乘势设定新目标 MAU 20k——一条线读完一年演变轨迹' }
  ];

  function setActive(i) {
    bands.forEach(function (b, bi) { b.classList.toggle('active', bi === i); });
    nodes.forEach(function (n) { n.classList.toggle('col-on', +n.dataset.col === i); });
    tags.forEach(function (t) { t.classList.toggle('col-on', +t.dataset.col === i); });
    var d = DATA[i];
    if (tsEl)  tsEl.textContent  = d.ts;
    if (txtEl) txtEl.textContent = d.txt;
    if (box)   box.classList.toggle('causal', d.causal);
  }

  var handlers = [];
  bands.forEach(function (b, bi) {
    var enter = function () { setActive(bi); };
    b.addEventListener('mouseenter', enter);
    b.addEventListener('click', enter);
    handlers.push([b, enter]);
  });

  setActive(2); /* 默认高亮 2022 Q2 因果簇 */

  return function cleanup() {
    handlers.forEach(function (p) {
      p[0].removeEventListener('mouseenter', p[1]);
      p[0].removeEventListener('click', p[1]);
    });
  };
};

/* ─── S019 51 skills vs 约90 MCP tools (🟡 two-layer-call-arrow) ─── */
window.slideHooks['slides/S019-skills-vs-tools.html'] = function () {
  return function cleanup() {};
};

/* ─── S020 schema 包 + Minions 梦循环 (🟡 schema-graph-night-loop) ─── */
window.slideHooks['slides/S020-schema-minions-loop.html'] = function () {
  return function cleanup() {};
};

/* ─── S021 两个 benchmark 严禁混引 (🟡 dual-bar-donotmix-hover) ─── */
window.slideHooks['slides/S021-two-benchmarks-no-mix.html'] = function () {
  return function cleanup() {};
};

/* ─── S022 成本贵 ≠ 质量差 (🟡 dual-axis-independent) ─── */
window.slideHooks['slides/S022-cost-not-equal-quality.html'] = function () {
  return function cleanup() {};
};

/* ─── S023 三维权衡：一把判断的尺 (🟡 radar-or-decision-tree) ─── */
window.slideHooks['slides/S023-three-dimension-tradeoff.html'] = function () {
  return function cleanup() {};
};

/* ─── S024 从笔记到会思考的大脑 (🟡 panorama-ruler-recap) ─── */
window.slideHooks['slides/S024-notes-to-thinking-brain.html'] = function () {
  return function cleanup() {};
};
