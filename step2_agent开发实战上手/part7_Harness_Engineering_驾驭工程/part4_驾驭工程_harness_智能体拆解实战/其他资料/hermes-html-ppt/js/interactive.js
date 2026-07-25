/**
 * html-courseware-interactive-eng 将填充此文件
 * 键名格式：'slides/SXX-filename.html'（完整路径）
 * 值格式：function() { ...; return function cleanup() { ... }; }
 *
 * 注册页面（6 个高交互页）：
 *   slides/S07-memory-architecture.html  (🔴🔴 三柱架构 + 时序 + 详情联动)
 *   slides/S17-decision-timing.html                (🔴🔴 stagger sequence)
 *   slides/S18-fork-4-constraints.html             (🔴 4-tab navigator)
 *
 * 强制规范（来源：interaction_architecture.md §FM 清单）：
 *   - 所有 setTimeout / setInterval 必须 push 到 timerIds[]，cleanup 一次性 clearTimeout
 *   - 所有 addEventListener 必须在 cleanup 中 removeEventListener
 *   - 禁止内联 IIFE；禁止 window.onload 替代 slideHooks
 *   - 每个 🔴🔴 / 🔴 页至少含 3 处 // ←FM1/FM2/FM3 注释（quality-guard 验证）
 */
window.slideHooks = window.slideHooks || {};

/* =====================================================
   S06 · 冷记忆三段式架构图（🔴🔴 step-reveal）
   状态机：idle → layer1_lit → layer2_lit → layer3_lit → layer4_lit
   揭示后不收回（IA.reveal-no-collapse）
   ===================================================== */
window.slideHooks['slides/S18-fork-4-constraints.html'] = function () {
  var slide = document.querySelector('.slide');
  if (!slide) return;  // ←FM-2: querySelector 防 null

  var tabs   = Array.prototype.slice.call(slide.querySelectorAll('[role="tab"]'));
  var panels = Array.prototype.slice.call(slide.querySelectorAll('[role="tabpanel"]'));
  var tablist = slide.querySelector('[role="tablist"]');

  if (!tabs.length || !panels.length || !tablist) return;  // ←FM-2: DOM 不完整时安全退出

  var state = { activeIndex: 0 };
  var timerIds = [];  // ←FM-NEW: 演示动画定时器统一收集

  // ── 切换到指定 tab ─────────────────────────────────────────────────
  function activateTab(newIndex) {  // ←FM-1: 具名函数固定逻辑，便于复用与 removeEventListener
    var prev = state.activeIndex;
    if (newIndex === prev) return;

    // 停用旧 tab
    tabs[prev].setAttribute('aria-selected', 'false');
    tabs[prev].setAttribute('tabindex', '-1');
    tabs[prev].classList.remove('active');
    panels[prev].style.display = 'none';  // ←FM-2: display 切换不重写 DOM，直接操作 style

    // 激活新 tab
    tabs[newIndex].setAttribute('aria-selected', 'true');
    tabs[newIndex].setAttribute('tabindex', '0');
    tabs[newIndex].classList.add('active');
    panels[newIndex].style.display = 'block';
    tabs[newIndex].focus();

    state.activeIndex = newIndex;
  }

  // ── 确保初始状态正确（tab-0 激活，其余 none）─────────────────────
  tabs.forEach(function (tab, i) {
    tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    tab.setAttribute('tabindex', i === 0 ? '0' : '-1');
    if (i === 0) tab.classList.add('active');
    else tab.classList.remove('active');
    panels[i].style.display = i === 0 ? 'block' : 'none';
  });

  // ── click 切换 ────────────────────────────────────────────────────
  function handleClick(e) {
    var btn = e.target.closest('[role="tab"]');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-tab-index'), 10);
    if (!isNaN(idx)) activateTab(idx);
  }
  tablist.addEventListener('click', handleClick);  // ←FM-1: 事件委托绑在 tablist

  // ── 键盘 ArrowLeft / ArrowRight 循环切换 ─────────────────────────
  function handleKeydown(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    var len = tabs.length;
    var next = e.key === 'ArrowRight'
      ? (state.activeIndex + 1) % len
      : (state.activeIndex + len - 1) % len;
    activateTab(next);
  }
  tablist.addEventListener('keydown', handleKeydown);

  // ── ←FM-NEW1: tab2 toolset 视觉化静态渲染（47 cells + 2 cells）
  function renderToolsetViz() {
    var beforeGrid = slide.querySelector('#s14-tools-grid-before');
    var afterGrid  = slide.querySelector('#s14-tools-grid-after');
    if (!beforeGrid || !afterGrid) return;  // ←FM-2: 容器不存在直接返回
    // 防重复填充（hookFn 可能被多次触发）
    if (beforeGrid.children.length === 0) {
      for (var i = 0; i < 47; i++) {
        var cell = document.createElement('div');
        cell.className = 's14-tool-cell';
        beforeGrid.appendChild(cell);
      }
    }
    if (afterGrid.children.length === 0) {
      ['memory', 'skills'].forEach(function (label) {
        var cell = document.createElement('div');
        cell.className = 's14-tool-cell s14-tool-cell--green';
        cell.title = label;
        afterGrid.appendChild(cell);
      });
    }
  }

  // ── ←FM-NEW2: tab3 漏写演示（火焰扩散 + 5s 自动重置）
  var leakBtn = slide.querySelector('[data-mode="leak"]');
  var safeBtn = slide.querySelector('[data-mode="safe"]');
  var canvas  = slide.querySelector('#s14-recursion-canvas');
  var warning = slide.querySelector('#s14-recursion-warning');

  function clearCanvas() {
    if (canvas) canvas.innerHTML = '';
    if (warning) warning.classList.remove('visible');
    timerIds.forEach(function (id) { clearTimeout(id); });
    timerIds = [];
  }

  // 在 canvas 中央生成单一 fork 节点（gen0）
  function spawnRoot() {
    if (!canvas) return null;
    var node = document.createElement('div');
    node.className = 's14-fork-node s14-fork-node--gen0';
    node.style.left = '50%';
    node.style.top  = '50%';
    canvas.appendChild(node);
    // 下一帧切 spawned，触发 transition fade-in
    timerIds.push(setTimeout(function () { node.classList.add('spawned'); }, 30));
    return node;
  }

  // 在水平条带上等距分布 count 个 fork 节点（gen 决定颜色 / 火焰）
  function spawnGeneration(count, gen, yPct) {
    if (!canvas) return;
    for (var i = 0; i < count; i++) {
      var node = document.createElement('div');
      node.className = 's14-fork-node s14-fork-node--gen' + gen;
      var xPct = ((i + 0.5) / count) * 100;
      node.style.left = xPct + '%';
      node.style.top  = yPct + '%';
      canvas.appendChild(node);
    }
    // 触发 spawned class（统一一帧后切，制造同代同时入场）
    timerIds.push(setTimeout(function () {
      canvas.querySelectorAll('.s14-fork-node--gen' + gen).forEach(function (n) {
        n.classList.add('spawned');
      });
    }, 30));
  }

  function leakHandler() {
    clearCanvas();
    // t=0:    根节点（主 agent fork 出的 review_agent）
    spawnRoot();
    // t=500:  2 个 gen1（review_agent 自己 nudge 出 2 个子）
    timerIds.push(setTimeout(function () { spawnGeneration(2, 1, 32); }, 500));
    // t=1000: 4 个 gen2
    timerIds.push(setTimeout(function () { spawnGeneration(4, 2, 18); }, 1000));
    // t=1500: 8 个 gen3（火焰脉冲）+ 警示出现
    timerIds.push(setTimeout(function () {
      spawnGeneration(8, 3, 8);
      if (warning) warning.classList.add('visible');
    }, 1500));
    // t=5000: 自动重置，给学员留 ~3.5s 震撼
    timerIds.push(setTimeout(function () { clearCanvas(); }, 5000));
  }

  function safeHandler() {
    clearCanvas();
    // 单一 fork 节点保留在中央（不裂变）
    spawnRoot();
  }

  function setupRecursionDemo() {
    if (leakBtn) leakBtn.addEventListener('click', leakHandler);
    if (safeBtn) safeBtn.addEventListener('click', safeHandler);
  }

  renderToolsetViz();
  setupRecursionDemo();

  // ── cleanup ──────────────────────────────────────────────────────
  return function cleanup() {  // ←FM-3: cleanup removeEventListener 防事件泄漏
    tablist.removeEventListener('click', handleClick);
    tablist.removeEventListener('keydown', handleKeydown);
    // ←FM-NEW3: 解绑 demo 按钮 + 清演示状态
    if (leakBtn) leakBtn.removeEventListener('click', leakHandler);
    if (safeBtn) safeBtn.removeEventListener('click', safeHandler);
    timerIds.forEach(function (id) { clearTimeout(id); });
    timerIds = [];
    if (canvas) canvas.innerHTML = '';
    if (warning) warning.classList.remove('visible');
    // 重置到第一个 tab
    tabs.forEach(function (tab, i) {
      tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      tab.setAttribute('tabindex', i === 0 ? '0' : '-1');
      if (i === 0) tab.classList.add('active');
      else tab.classList.remove('active');
      panels[i].style.display = i === 0 ? 'block' : 'none';
    });
    state = {};
  };
};

/* =====================================================================
   S05 · Hermes vs OpenClaw · 同源不同路
   Pattern: Dual slogan toggle-pair + 5-dim collapsible comparison
   State machine:
     System-1 (双卡 hover):
       IDLE          { activeCard: null }
       LEFT_ACTIVE   { activeCard: 'openclaw' }  mouseenter 左卡
       RIGHT_ACTIVE  { activeCard: 'hermes'   }  mouseenter 右卡
       ANY → IDLE    mouseleave 双卡区域兜底全清
     System-2 (5 维行 expand):
       expandedRows: Set<number> — 多行可同时展开，click toggle
   FM refs:
     FM-1: 主容器 null 时 return noop 防 cleanup undefined
     FM-2: mouseenter 先全清再 add active（防互斥错位两卡残影）
     FM-3: expandedRows Set 管理 toggle，防 classList.toggle 状态错位
   ===================================================================== */
window.slideHooks['slides/S05-hermes-vs-openclaw.html'] = function () {
  // 1. 获取主容器（data-slide-id="S05" 作为唯一标识）
  var slide = document.querySelector('[data-slide-id="S05"]');
  if (!slide) return function noop() {};  // ←FM-1: noop 防早退 undefined

  // 2. 局部状态（闭包隔离，不污染全局）
  var timerIds = [];
  var state = {
    activeCard: null,          // 'openclaw' | 'hermes' | null
    expandedRows: new Set()    // ←FM-3: Set 管理多行展开状态
  };

  // 3. DOM 引用
  var cardLeft   = slide.querySelector('#s05-card-left');
  var cardRight  = slide.querySelector('#s05-card-right');
  var cardsGrid  = slide.querySelector('#s05-cards-grid');
  var divider    = slide.querySelector('#s05-divider');
  var rows       = slide.querySelectorAll('.s05-row');
  var summaryEl  = slide.querySelector('#s05-summary');
  var hookEl     = slide.querySelector('#s05-hook');
  var titleEl    = slide.querySelector('#s05-title');

  // 4. 入场动画（GSAP fromTo，禁用 from()）
  var tl = gsap.timeline({ paused: true });

  // t=0ms: 标题 fade-in (400ms)
  tl.fromTo(titleEl,
    { opacity: 0, y: -15 },
    { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out' }
  );

  // t=400ms: 左卡 slide-in-left + 右卡 slide-in-right 同时 (600ms)
  tl.fromTo(cardLeft,
    { opacity: 0, x: -40 },
    { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' },
    '+=0'
  );
  tl.fromTo(cardRight,
    { opacity: 0, x: 40 },
    { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' },
    '<'    // 与左卡同时
  );

  // t=1000ms: 分隔线 grow vertical (400ms)
  tl.fromTo(divider,
    { scaleY: 0, opacity: 0 },
    { scaleY: 1, opacity: 1, duration: 0.4, ease: 'power1.out', transformOrigin: 'top center' }
  );

  // t=1400ms: 5 维行 stagger 入场（每 130ms）
  tl.fromTo(rows,
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 0.32, stagger: 0.13, ease: 'power1.out' }
  );

  // t=2200ms: 底部总结 fade-in (500ms)
  tl.fromTo(summaryEl,
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power1.out' }
  );

  // t=2700ms: 钩子 fade-in 后开始 pulse
  tl.fromTo(hookEl,
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out',
      onComplete: function () {
        if (hookEl) hookEl.classList.add('pulse-active');
      }
    }
  );

  // 延迟 120ms 播放（等 slide 从 display:none 变为可见）
  var entranceTimer = setTimeout(function () { tl.play(); }, 120);
  timerIds.push(entranceTimer);

  // ── System-1: 双卡 互斥 hover ──

  // 全清函数：mouseenter 时先调用，防互斥错位 ←FM-2
  function clearAllCardActive() {
    if (cardLeft)  cardLeft.classList.remove('cyan-active');
    if (cardRight) cardRight.classList.remove('amber-active');
    state.activeCard = null;
  }

  // 左卡 mouseenter
  function handleLeftEnter() {
    clearAllCardActive();                      // ←FM-2: 先全清
    if (cardLeft) {
      cardLeft.classList.add('cyan-active');
      state.activeCard = 'openclaw';
    }
  }

  // 右卡 mouseenter
  function handleRightEnter() {
    clearAllCardActive();                      // ←FM-2: 先全清
    if (cardRight) {
      cardRight.classList.add('amber-active');
      state.activeCard = 'hermes';
    }
  }

  // 双卡区域 mouseleave：兜底全清 ←FM-2
  function handleCardsLeave(e) {
    if (cardsGrid && !cardsGrid.contains(e.relatedTarget)) {
      clearAllCardActive();
    }
  }

  // 绑定双卡 hover 事件
  if (cardLeft)  cardLeft.addEventListener('mouseenter', handleLeftEnter);
  if (cardRight) cardRight.addEventListener('mouseenter', handleRightEnter);
  if (cardsGrid) cardsGrid.addEventListener('mouseleave', handleCardsLeave);

  // ── System-2: 5 维行 click-to-expand ──

  // toggle 单行展开/收起 ←FM-3: Set 管理状态
  function toggleRow(idx, rowEl) {
    if (state.expandedRows.has(idx)) {
      state.expandedRows.delete(idx);          // ←FM-3
      rowEl.classList.remove('expanded');
      rowEl.setAttribute('aria-expanded', 'false');
    } else {
      state.expandedRows.add(idx);             // ←FM-3
      rowEl.classList.add('expanded');
      rowEl.setAttribute('aria-expanded', 'true');
    }
  }

  // 为每行绑定 click + keydown
  var rowClickHandlers = [];
  var rowKeyHandlers   = [];

  rows.forEach(function (rowEl, idx) {
    var clickHandler = function () { toggleRow(idx, rowEl); };
    var keyHandler   = function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRow(idx, rowEl);
      }
    };
    rowClickHandlers.push(clickHandler);
    rowKeyHandlers.push(keyHandler);
    rowEl.addEventListener('click',   clickHandler);
    rowEl.addEventListener('keydown', keyHandler);
  });

  // 5. cleanup（必须 return function）
  return function cleanup() {
    // 清所有定时器 ←FM-1: 防入场 timer 跨 slide 泄漏
    timerIds.forEach(function (id) { clearTimeout(id); });
    timerIds.length = 0;

    // 杀 GSAP timeline ←FM-1: tl.kill() 防内存泄漏
    if (tl) { tl.kill(); tl = null; }
    gsap.killTweensOf(slide.querySelectorAll('*'));

    // 移除双卡 hover 监听
    if (cardLeft)  cardLeft.removeEventListener('mouseenter', handleLeftEnter);
    if (cardRight) cardRight.removeEventListener('mouseenter', handleRightEnter);
    if (cardsGrid) cardsGrid.removeEventListener('mouseleave', handleCardsLeave);

    // 移除 5 维行 click/keydown 监听
    rows.forEach(function (rowEl, idx) {
      rowEl.removeEventListener('click',   rowClickHandlers[idx]);
      rowEl.removeEventListener('keydown', rowKeyHandlers[idx]);
    });

    // 清除视觉残影
    clearAllCardActive();
    rows.forEach(function (rowEl) {
      rowEl.classList.remove('expanded');
      rowEl.setAttribute('aria-expanded', 'false');
    });

    // 停止钩子 pulse
    if (hookEl) hookEl.classList.remove('pulse-active');

    // 重置状态
    state.expandedRows.clear();
    state.activeCard = null;
  };
};

/* =====================================================================
   S04 · Hermes Agent 灵魂页（🔴🔴 stars growth curve + chips + timeline）
   Pattern: Stars growth curve as hero + 6 feature chips orbit + 8 version timeline
   State machine:
     phase: 'entering' | 'idle'
     activeChip: null | 0-5
     activeVersion: null | 'v0.1.0' ... 'v0.8.0'
   FM refs:
     FM-1: noop cleanup 防早退（DOM 缺失时返回 function noop(){}）
     FM-2: getTotalLength 包 requestAnimationFrame（防 0 返回）
     FM-3: timerIds 统一数组，cleanup 一次清 clearTimeout
   ===================================================================== */
window.slideHooks['slides/S04-hermes-agent-overview.html'] = function () {
  // ── 1. DOM 防守 ──
  var slide = document.querySelector('[data-slide-id="S04"]');
  if (!slide) return function noop() {};  // ←FM-1: noop cleanup 防早退 undefined

  // ── 2. 数据常量 ──
  var STARS_DATA = {
    days:    [0, 10, 20, 30, 40, 50, 60],
    openclaw:[0, 5000, 25000, 90000, 180000, 250000, 346000],
    hermes:  [0, 5000, 18000, 38000, 60000, 90000, 137000],
    gstack:  [0, 22000, 35000, 48000, 56000, 62000, 67600]
  };

  var CHIP_DETAILS = [
    { name: '47 工具', text: '20 个独立 Toolset 模块覆盖代码执行、文件操作、网络请求、系统控制等全场景，工具链开箱即用。' },
    { name: '14+ 平台', text: 'Telegram / Slack / 飞书 / 钉钉 / Discord / WhatsApp 等 14+ 即时通讯平台原生集成，统一网关层转发。' },
    { name: '4 层记忆', text: 'MEMORY（全局持久化）+ USER（用户级）+ SQLite FTS5（全文检索）+ 8 Provider 扩展层（Mem0 / Zep 等）。' },
    { name: '技能自生成', text: 'Nudge 计数器 → 阈值判定 → fork skill → prompt 驱动生成 → 落盘持久化。任务执行 10-20 次后效率提升 2-3 倍。' },
    { name: 'GEPA 进化', text: 'ICLR 2026 Oral。跨 6 个基准任务平均超越 GRPO 6%，核心机制：经验感知策略优化（Experience-Guided Policy Adaptation）。' },
    { name: '国产模型原生', text: 'DeepSeek / Kimi / MiniMax / 智谱 GLM 原生 API 适配，无需 OpenAI 兼容层，全系列模型开箱可用。' }
  ];

  var VERSION_DATA = {
    'v0.1.0': { date: '2026-02-25', code: '首次发布',  feature: '基础架构，多 Agent 协调框架正式建立。' },
    'v0.2.0': { date: '2026-03-12', code: '—',         feature: '多平台网关、MCP 客户端、70+ 技能。平台接入能力全面激活。' },
    'v0.3.0': { date: '2026-03-17', code: '流式与插件', feature: '实时 token 流式输出、插件架构。对话体验质的飞跃。' },
    'v0.4.0': { date: '2026-03-23', code: '—',         feature: 'OpenAI 兼容 API、安全加固。对接现有工具链零改造。' },
    'v0.5.0': { date: '2026-03-28', code: '—',         feature: '157 PRs 全面迭代。社区爆发，质量大幅提升。' },
    'v0.6.0': { date: '2026-03-30', code: '—',         feature: 'MCP Server 模式。Hermes 可作为 MCP 服务端被任意客户端调用。' },
    'v0.7.0': { date: '2026-04-03', code: '韧性版',    feature: '可插拔记忆、凭证池轮换。生产级稳定性提升。' },
    'v0.8.0': { date: '2026-04-08', code: '智能版',    feature: '后台任务通知、模型热切换、MCP OAuth 2.1。企业级能力全面就绪。' }
  };

  // ── 3. 局部状态 ──
  var timerIds = [];  // ←FM-3: 统一 timer 数组
  var state = {
    phase: 'entering',
    activeChip: null,
    activeVersion: null
  };
  var tl = null;  // GSAP timeline（入场用）

  // ── 4. DOM 引用 ──
  var headline    = slide.querySelector('.s04-headline');
  var tagline     = slide.querySelector('.s04-tagline');
  var githubBar   = slide.querySelector('.s04-github-bar');
  var chartWrap   = slide.querySelector('.s04-chart-wrap');
  var chips       = slide.querySelectorAll('.s04-chip');
  var chipPanel   = document.getElementById('s04-chip-panel');
  var panelTitle  = document.getElementById('s04-panel-title');
  var panelText   = document.getElementById('s04-panel-text');
  var vnodes      = slide.querySelectorAll('.s04-vnode');
  var timelineTitle = slide.querySelector('.s04-timeline-title');
  var callout     = document.getElementById('s04-callout');
  var svgEl       = document.getElementById('s04-stars-svg');
  var svgTooltip  = document.getElementById('s04-svg-tooltip');
  var ttTitle     = document.getElementById('s04-tt-title');
  var ttOc        = document.getElementById('s04-tt-oc');
  var ttHm        = document.getElementById('s04-tt-hm');
  var ttGs        = document.getElementById('s04-tt-gs');
  var hoverVline  = document.getElementById('s04-hover-vline');
  var modalOverlay = document.getElementById('s04-modal-overlay');
  var versionModal = document.getElementById('s04-version-modal');
  var modalVer    = document.getElementById('s04-modal-ver');
  var modalCode   = document.getElementById('s04-modal-code');
  var modalDate   = document.getElementById('s04-modal-date');
  var modalFeature = document.getElementById('s04-modal-feature');
  var modalClose  = document.getElementById('s04-modal-close');

  // SVG 曲线路径元素
  var pathOpenclaw = document.getElementById('curve-openclaw');
  var pathHermes   = document.getElementById('curve-hermes');
  var pathGstack   = document.getElementById('curve-gstack');
  var svgPaths = [pathOpenclaw, pathHermes, pathGstack];

  // ── 5. 工具函数 ──
  function formatStars(v) {
    if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K';
    return String(v);
  }

  // ── 6. 描线动画（rAF 包 getTotalLength 防 0 返回）──
  function animatePath(pathEl) {
    if (!pathEl) return;
    requestAnimationFrame(function () {  // ←FM-2: rAF 确保 slide visible
      var len = pathEl.getTotalLength();
      if (!len || len < 1) len = 800;  // ←FM-2: 防 getTotalLength 返回 0，fallback 800
      pathEl.style.strokeDasharray = len;
      pathEl.style.strokeDashoffset = len;
      requestAnimationFrame(function () {  // 二次 rAF 触发 CSS transition
        pathEl.style.transition = 'stroke-dashoffset 1.6s ease-out';
        pathEl.style.strokeDashoffset = '0';
      });
    });
  }

  // ── 7. 立即显示所有终态（键盘跳过） ──
  function showAllImmediate() {
    timerIds.forEach(clearTimeout);  // ←FM-3
    timerIds = [];
    state.phase = 'idle';

    if (tl) { tl.kill(); tl = null; }

    [headline, tagline, githubBar, chartWrap, timelineTitle, callout].forEach(function (el) {
      if (el) el.style.opacity = '1';
    });
    chips.forEach(function (chip) { chip.style.opacity = '1'; });
    vnodes.forEach(function (vn) {
      vn.style.opacity = '1';
      vn.classList.add('lit');
    });
    svgPaths.forEach(function (p) {
      if (!p) return;
      requestAnimationFrame(function () {  // ←FM-2
        var len = p.getTotalLength();
        if (!len || len < 1) len = 800;
        p.style.transition = 'none';
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = '0';
      });
    });
    if (callout) callout.classList.add('pulse-active');
  }

  // ── 8. 入场动画序列 ──
  function startEntrance() {
    tl = gsap.timeline({ paused: true });
    tl.fromTo(
      [headline, tagline].filter(Boolean),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.15, ease: 'power1.out' }
    ).fromTo(
      githubBar || [],
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out' },
      '+=0.05'
    );
    tl.play();

    // 图表区 + 曲线描线（t=600ms）
    timerIds.push(setTimeout(function () {  // ←FM-3
      if (chartWrap) chartWrap.style.opacity = '1';
      animatePath(pathOpenclaw);
      animatePath(pathHermes);
      animatePath(pathGstack);
    }, 600));

    // 6 chip stagger（t=2200ms）
    timerIds.push(setTimeout(function () {  // ←FM-3
      chips.forEach(function (chip, i) {
        timerIds.push(setTimeout(function () {
          chip.style.opacity = '1';
        }, i * 150));
      });
    }, 2200));

    // 时间线标题（t=3100ms）
    timerIds.push(setTimeout(function () {  // ←FM-3
      if (timelineTitle) timelineTitle.style.opacity = '1';
    }, 3100));

    // 8 版本节点 stagger（t=3200ms）
    timerIds.push(setTimeout(function () {  // ←FM-3
      vnodes.forEach(function (vn, i) {
        timerIds.push(setTimeout(function () {
          vn.style.opacity = '1';
          timerIds.push(setTimeout(function () {
            vn.classList.add('lit');
          }, 80));
        }, i * 200));
      });
    }, 3200));

    // callout pulse（t=4900ms）
    timerIds.push(setTimeout(function () {  // ←FM-3
      if (callout) {
        callout.style.opacity = '1';
        callout.classList.add('pulse-active');
      }
      state.phase = 'idle';
    }, 4900));
  }

  // ── 9. chip 交互 ──
  function showChipPanel(chip) {
    var idx = parseInt(chip.getAttribute('data-chip-index'), 10);
    if (isNaN(idx) || !CHIP_DETAILS[idx]) return;
    state.activeChip = idx;
    chips.forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    if (panelTitle) panelTitle.textContent = CHIP_DETAILS[idx].name;
    if (panelText)  panelText.textContent  = CHIP_DETAILS[idx].text;
    if (chipPanel) {
      var rect = chip.getBoundingClientRect();
      var panelW = 260;
      var left = rect.left + rect.width / 2 - panelW / 2;
      left = Math.min(left, window.innerWidth - panelW - 16);
      left = Math.max(left, 16);
      var topBelow = rect.bottom + 8;
      var topAbove = rect.top - 8 - 120;
      var top = (topBelow + 120 < window.innerHeight) ? topBelow : topAbove;
      chipPanel.style.left = left + 'px';
      chipPanel.style.top  = top  + 'px';
      chipPanel.classList.add('visible');
    }
  }

  function hideChipPanel() {
    state.activeChip = null;
    chips.forEach(function (c) { c.classList.remove('active'); });
    if (chipPanel) chipPanel.classList.remove('visible');
  }

  function handleChipEnter(e) { showChipPanel(e.currentTarget); }
  function handleChipLeave()  { hideChipPanel(); }
  function handleChipFocus(e) { showChipPanel(e.currentTarget); }
  function handleChipBlur()   { hideChipPanel(); }

  // ── 10. SVG dots hover tooltip ──
  var dataDots = slide.querySelectorAll('.s04-data-dot');
  var xPositions = [40, 160, 280, 400, 520, 640, 760];

  function handleDotEnter(e) {
    var dot = e.currentTarget;
    var dotI = parseInt(dot.getAttribute('data-i'), 10);
    if (isNaN(dotI)) return;
    if (hoverVline) {
      hoverVline.setAttribute('x1', xPositions[dotI]);
      hoverVline.setAttribute('x2', xPositions[dotI]);
      hoverVline.classList.add('visible');
    }
    if (ttTitle) ttTitle.textContent = 'Day ' + STARS_DATA.days[dotI];
    if (ttOc)    ttOc.textContent    = formatStars(STARS_DATA.openclaw[dotI]);
    if (ttHm)    ttHm.textContent    = formatStars(STARS_DATA.hermes[dotI]);
    if (ttGs)    ttGs.textContent    = formatStars(STARS_DATA.gstack[dotI]);
    if (svgTooltip) {
      var mx = e.clientX || 0;
      var my = e.clientY || 0;
      var ttLeft = mx + 12;
      var ttTop  = my - 20;
      if (ttLeft + 170 > window.innerWidth) ttLeft = mx - 175;
      svgTooltip.style.left = ttLeft + 'px';
      svgTooltip.style.top  = ttTop  + 'px';
      svgTooltip.classList.add('visible');
    }
  }

  function handleDotLeave() {
    if (hoverVline) hoverVline.classList.remove('visible');
    if (svgTooltip) svgTooltip.classList.remove('visible');
  }

  // ── 11. 版本 modal ──
  function openVersionModal(vKey) {
    var vd = VERSION_DATA[vKey];
    if (!vd) return;
    state.activeVersion = vKey;
    if (modalVer)     modalVer.textContent     = vKey;
    if (modalCode)    modalCode.textContent     = vd.code !== '—' ? '· ' + vd.code : '';
    if (modalDate)    modalDate.textContent     = vd.date;
    if (modalFeature) modalFeature.textContent  = vd.feature;
    if (modalOverlay) modalOverlay.classList.add('visible');
    if (versionModal) {
      versionModal.classList.add('visible');
      versionModal.focus();
    }
  }

  function closeVersionModal() {
    state.activeVersion = null;
    if (modalOverlay) modalOverlay.classList.remove('visible');
    if (versionModal) versionModal.classList.remove('visible');
  }

  function handleVnodeClick(e) {
    var vKey = e.currentTarget.getAttribute('data-v');
    if (!vKey) return;
    if (state.activeVersion === vKey) {
      closeVersionModal();
    } else {
      openVersionModal(vKey);
    }
  }
  function handleVnodeKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleVnodeClick(e);
    }
  }
  function handleModalClose()   { closeVersionModal(); }
  function handleOverlayClick() { closeVersionModal(); }

  function handleDocKeydown(e) {
    if (e.key === 'Escape' && state.activeVersion) {
      closeVersionModal();
    }
    if ((e.key === 'Enter' || e.key === ' ') && state.phase === 'entering') {
      e.preventDefault();
      showAllImmediate();
    }
  }

  // ── 12. 事件绑定 ──
  chips.forEach(function (chip) {
    chip.addEventListener('mouseenter', handleChipEnter);
    chip.addEventListener('mouseleave', handleChipLeave);
    chip.addEventListener('focus',      handleChipFocus);
    chip.addEventListener('blur',       handleChipBlur);
  });
  dataDots.forEach(function (dot) {
    dot.addEventListener('mouseenter', handleDotEnter);
    dot.addEventListener('mouseleave', handleDotLeave);
  });
  vnodes.forEach(function (vn) {
    vn.addEventListener('click',   handleVnodeClick);
    vn.addEventListener('keydown', handleVnodeKeydown);
  });
  if (modalClose)   modalClose.addEventListener('click',  handleModalClose);
  if (modalOverlay) modalOverlay.addEventListener('click', handleOverlayClick);
  document.addEventListener('keydown', handleDocKeydown);

  // ── 13. 启动入场序列（延迟 120ms 等 slide 变可见）──
  timerIds.push(setTimeout(startEntrance, 120));  // ←FM-3

  // ── 14. cleanup ──
  return function cleanup() {
    timerIds.forEach(clearTimeout);  // ←FM-3: 清所有 timer
    timerIds = [];

    if (tl) { tl.kill(); tl = null; }
    if (slide) { gsap.killTweensOf(slide.querySelectorAll('*')); }

    // 重置 SVG path 描线 ←FM-2
    svgPaths.forEach(function (p) {
      if (!p) return;
      p.style.transition = 'none';
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '';
    });

    hideChipPanel();
    closeVersionModal();
    if (svgTooltip)  svgTooltip.classList.remove('visible');
    if (hoverVline)  hoverVline.classList.remove('visible');

    chips.forEach(function (chip) {
      chip.removeEventListener('mouseenter', handleChipEnter);
      chip.removeEventListener('mouseleave', handleChipLeave);
      chip.removeEventListener('focus',      handleChipFocus);
      chip.removeEventListener('blur',       handleChipBlur);
    });
    dataDots.forEach(function (dot) {
      dot.removeEventListener('mouseenter', handleDotEnter);
      dot.removeEventListener('mouseleave', handleDotLeave);
    });
    vnodes.forEach(function (vn) {
      vn.removeEventListener('click',   handleVnodeClick);
      vn.removeEventListener('keydown', handleVnodeKeydown);
    });
    if (modalClose)   modalClose.removeEventListener('click',  handleModalClose);
    if (modalOverlay) modalOverlay.removeEventListener('click', handleOverlayClick);
    document.removeEventListener('keydown', handleDocKeydown);

    if (callout) callout.classList.remove('pulse-active');
    state = {};
  };
};

/* =====================================================================
   S07 · Hermes 记忆系统 · 热/冷分离三段式架构（🔴🔴 三柱 + 时序 + 详情联动）
   Pattern: 静态架构柱 + 横向时序条 + 点击组件 → detail panel + 时序节点 pulse
   State machine:
     activeComponent: null | 'memory-md' | 'user-md' | 'sqlite' | 'fts5' |
                      'llm-summary' | 'honcho' | 'ext-others'
     时序节点 pulse 由 activeComponent 数据驱动
   FM refs:
     FM-1: 主容器 null 时 return noop
     FM-2: 切组件先全清旧 active 类，防互斥错位
     FM-3: 时序节点 pulse 用 forEach 全清而非依赖 selector，防 cleanup 漏类
   ===================================================================== */
window.slideHooks['slides/S07-memory-architecture.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S07"]');
  if (!slide) return function noop() {};  // ←FM-1

  // 1. 组件元数据（含详情 + 参与的时序节点 + 所属段）
  var COMPONENTS = {
    'memory-md': {
      title: 'MEMORY.md',
      segment: 'hot',
      summary: 'Agent 自维护的"长期事实"快照 — 每次对话开始时由 Prompt Builder 自动拼入系统提示词头部，常驻 prompt 不参与冷检索。Nudge 机制在 turn 结束后审查是否发现新稳定事实，按需写回。',
      meta: { '所在层': '段 1 · 热双层', '更新时机': 'Nudge 后台 review (turn 后)', '加载时机': '每次对话默认注入', '生效形式': '系统提示词头部明文' },
      tnodes: [1, 6]
    },
    'user-md': {
      title: 'USER.md',
      segment: 'hot',
      summary: '用户画像文件 — 与 MEMORY.md 同样在每次对话默认注入系统提示词。但自动填充依赖外部 Honcho Provider，默认关闭，所以默认状态下 USER.md 是空的或人工维护。',
      meta: { '所在层': '段 1 · 热双层', '默认状态': '空（人工维护）', '自动填充依赖': 'Honcho Provider opt-in', '加载时机': '每次对话默认注入' },
      tnodes: [1]
    },
    'sqlite': {
      title: 'SQLite',
      segment: 'cold',
      summary: 'messages 真表 14 字段 — 持久化所有 turn 的消息内容、role、tool_name、tool_calls、timestamp 等结构化字段。是冷记忆三件套的存储基座，FTS5 影子索引通过 rowid 桥反向 JOIN 回此真表取完整字段。',
      meta: { '所在层': '段 2 · 冷三件套', '源码': 'hermes_state.py:103-156', '字段数': '14（id/session_id/role/content/tool_name/tool_calls/...）', '触发': 'session_search 命中后 JOIN' },
      tnodes: [3, 4]
    },
    'fts5': {
      title: 'FTS5 × 2',
      segment: 'cold',
      summary: '双索引虚拟表 — messages_fts (unicode61 tokenizer，对英文/拉丁语友好) + messages_fts_trigram (3 字符滑窗，对中文友好)。通过 6 个 trigger 自动同步 messages 真表，应用层只写真表。三档分支：英文走 unicode61 / 中文 3+ 字走 trigram / 短中文 LIKE 兜底。',
      meta: { '所在层': '段 2 · 冷三件套', '源码 schema': 'hermes_state.py:103-156', '源码 sanitize': 'hermes_state.py:1586-1842', '关键防线': '_sanitize_fts5_query 防注入' },
      tnodes: [3, 4]
    },
    'llm-summary': {
      title: 'LLM 摘要',
      segment: 'cold',
      summary: '召回后二次归纳 — 与 DeepAgents 默认 summarization middleware 不同：DeepAgents 是当前 session 内 context 压缩（防爆 token），Hermes 是跨 session 检索命中后对召回结果做 5 元素结构化归纳。',
      meta: { '所在层': '段 2 · 冷三件套', '源码': 'session_search_tool.py', '输出': '5 元素结构化摘要', '差异点': 'vs DeepAgents = 召回后归纳 ≠ 当前 session 压缩' },
      tnodes: [4]
    },
    'honcho': {
      title: 'Honcho Provider',
      segment: 'ext',
      summary: '8 种外部 Memory Provider 中最常用的一种 — 主要负责自动从对话历史中提取用户画像填充到 USER.md。默认 opt-in，需要在 config.yaml 显式启用。开启后段 1 USER.md 才会从"空"变成"自动维护"。',
      meta: { '所在层': '段 3 · 扩展层', '默认状态': 'opt-in (关闭)', '主要作用': '自动填充 USER.md 用户画像', '启用方式': 'config.yaml 声明 provider: honcho' },
      tnodes: [1]
    },
    'ext-others': {
      title: 'Mem0 / Zep / Holographic / ...',
      segment: 'ext',
      summary: '段 3 扩展层的其余 7 种 Memory Provider — 包含 Mem0、Zep、Holographic、Letta、Mem-X、GraphMem、VectorMem 等。全部 opt-in，不在默认链路。每种 Provider 解决特定场景（向量召回 / 图谱关联 / 全息记忆等）。',
      meta: { '所在层': '段 3 · 扩展层', '默认状态': '全部 opt-in (关闭)', '约束': '不在默认链路', '启用代价': '需理解各 Provider 的语义模型 + 配置成本' }
    }
  };

  // 2. DOM 引用
  var titleEl    = slide.querySelector('#s07-title');
  var subtitleEl = slide.querySelector('.s07-subtitle');
  var pillars    = slide.querySelectorAll('.s07-pillar');
  var components = slide.querySelectorAll('.s07-component');
  var timelineWrap = slide.querySelector('#s07-timeline-wrap');
  var tnodes     = slide.querySelectorAll('.s07-tnode');
  var detailEl   = slide.querySelector('#s07-detail');

  // 3. 入场动画
  var tl = gsap.timeline({ paused: true });
  tl.fromTo(titleEl, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out' });
  tl.fromTo(subtitleEl, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' }, '-=0.1');
  tl.fromTo(pillars, { opacity: 0, y: 14 }, { opacity: function (i, el) { return el.classList.contains('s07-pillar--ext') ? 0.62 : 1; }, y: 0, duration: 0.45, stagger: 0.13, ease: 'power2.out' });
  tl.fromTo(timelineWrap, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out' });
  tl.fromTo(detailEl, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, '-=0.1');

  var entranceTimer = setTimeout(function () { tl.play(); }, 120);

  // 4. 详情面板渲染
  var SEG_LABEL = { hot: '段 1 · 热记忆', cold: '段 2 · 冷记忆', ext: '段 3 · 扩展层' };
  var SEG_TAGCSS = {
    hot:  'background: rgba(125, 211, 192, 0.18); color: #7dd3c0;',
    cold: 'background: rgba(212, 165, 116, 0.18); color: #d4a574;',
    ext:  'background: rgba(140, 140, 140, 0.18); color: #8b8b8b;'
  };

  function renderDetail(compKey) {
    var data = COMPONENTS[compKey];
    if (!data) {
      detailEl.innerHTML = '<div class="s07-detail-empty">点击上方任一架构柱内组件查看：作用 · 源码定位 · 关键字段 · 参与的运行时节点</div>';
      detailEl.classList.remove('has-active--hot', 'has-active--cold', 'has-active--ext');
      return;
    }

    var metaHtml = Object.keys(data.meta).map(function (k) {
      return '<span class="s07-detail-meta-item">' +
        '<span class="s07-detail-meta-label">' + k + ':</span>' +
        '<span class="s07-detail-meta-val">' + data.meta[k] + '</span>' +
        '</span>';
    }).join('');

    detailEl.innerHTML =
      '<div class="s07-detail-header">' +
        '<span class="s07-detail-title">' + data.title + '</span>' +
        '<span class="s07-detail-segment" style="' + SEG_TAGCSS[data.segment] + '">' + SEG_LABEL[data.segment] + '</span>' +
      '</div>' +
      '<div class="s07-detail-summary">' + data.summary + '</div>' +
      '<div class="s07-detail-meta">' + metaHtml + '</div>';

    detailEl.classList.remove('has-active--hot', 'has-active--cold', 'has-active--ext');
    detailEl.classList.add('has-active--' + data.segment);
  }

  // 5. 时序节点 pulse 联动
  function clearTnodePulse() {
    tnodes.forEach(function (n) { n.classList.remove('pulse-active'); });    // ←FM-3
  }

  function activateTnodes(idxArr) {
    clearTnodePulse();
    if (!idxArr || !idxArr.length) return;
    idxArr.forEach(function (idx) {
      var n = slide.querySelector('.s07-tnode[data-tnode="' + idx + '"]');
      if (n) n.classList.add('pulse-active');
    });
  }

  // 6. 组件点击 / 键盘交互
  function setActiveComponent(compKey, srcEl) {
    components.forEach(function (c) { c.classList.remove('active'); });   // ←FM-2
    if (srcEl) srcEl.classList.add('active');
    renderDetail(compKey);
    var tnodesArr = (COMPONENTS[compKey] && COMPONENTS[compKey].tnodes) || [];
    activateTnodes(tnodesArr);
  }

  var compClickHandlers = [];
  var compKeyHandlers   = [];

  components.forEach(function (compEl) {
    var key = compEl.getAttribute('data-component');
    var clickH = function () { setActiveComponent(key, compEl); };
    var keyH = function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActiveComponent(key, compEl);
      }
    };
    compClickHandlers.push(clickH);
    compKeyHandlers.push(keyH);
    compEl.addEventListener('click', clickH);
    compEl.addEventListener('keydown', keyH);
  });

  // 7. cleanup
  return function cleanup() {
    clearTimeout(entranceTimer);
    if (tl) { tl.kill(); tl = null; }
    gsap.killTweensOf(slide.querySelectorAll('*'));

    components.forEach(function (compEl, idx) {
      compEl.removeEventListener('click', compClickHandlers[idx]);
      compEl.removeEventListener('keydown', compKeyHandlers[idx]);
      compEl.classList.remove('active');
    });
    clearTnodePulse();
    detailEl.classList.remove('has-active--hot', 'has-active--cold', 'has-active--ext');
    if (detailEl) {
      detailEl.innerHTML = '<div class="s07-detail-empty">点击上方任一架构柱内组件查看：作用 · 源码定位 · 关键字段 · 参与的运行时节点</div>';
    }
  };
};

/* ─────────────────────────────────────────────────────────
   S08 · 热记忆双层 · Agent 启动时怎么"知道"
   🔴🔴 Particle flow + Prompt Builder 6-source assembly
   FM 清单：
     FM-1: noop cleanup 防 DOM 缺失早退（`if (!slide) return function noop(){}`）
     FM-2: 所有 setTimeout push 到 state.timers，cleanup 一次性 clearTimeout
     FM-3: 粒子用 SVG circle 元素（非 div），便于动画路径
   状态机：idle → title_in → files_in → prompt_shell_in →
            builder_in → particles_flying → assemble_done → pulse → complete
───────────────────────────────────────────────────────── */
window.slideHooks['slides/S08-hot-memory-load.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S08"]');
  if (!slide) return function noop() {};  // ←FM-1: noop cleanup 防 DOM 缺失早退

  /* ── prefers-reduced-motion 检查：立即显示终态 ── */
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    slide.querySelectorAll(
      '.s08-header, .s08-file-card, .s08-builder-card, ' +
      '.s08-prompt-card, .s08-source-item, .s08-assemble-label, .s08-inject-label'
    ).forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return function noop() {};  // ←FM-1
  }

  /* ── 局部状态 ── */
  var state = { timers: [], phase: 'idle' };  // ←FM-2: 统一 timer 数组

  /* ── DOM 引用 ── */
  var header        = slide.querySelector('.s08-header');
  var memCard       = slide.querySelector('#s08-memory-card');
  var userCard      = slide.querySelector('#s08-user-card');
  var promptCard    = slide.querySelector('#s08-prompt-card');
  var builderCard   = slide.querySelector('#s08-builder-card');
  var sources       = slide.querySelectorAll('.s08-source-item');
  var assembleLabel = slide.querySelector('#s08-assemble-label');
  var injectLabel   = slide.querySelector('#s08-inject-label');
  var beam          = slide.querySelector('#s08-beam');

  /* ── 粒子元素（SVG circle × 8）← FM-3: 使用 SVG circle 元素 ── */
  var memParticles = [0, 1, 2, 3].map(function (i) {
    return document.getElementById('s08-pm-' + i);
  });
  var usrParticles = [0, 1, 2, 3].map(function (i) {
    return document.getElementById('s08-pu-' + i);
  });

  /* ── 辅助：安全入场（fromTo 防 display:none 时序）── */
  function fadeUp(el, delay) {
    if (!el) return;
    gsap.fromTo(el,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', delay: delay / 1000 }
    );
  }

  /* ── 辅助：加 timer 并归入 state.timers ← FM-2 ── */
  function addTimer(fn, delay) {
    var id = setTimeout(fn, delay);
    state.timers.push(id);  // ←FM-2: 推入统一数组
    return id;
  }

  /* ── 辅助：SVG circle 粒子动画（两段弧线模拟贝塞尔）← FM-3 ── */
  function spawnParticle(circle, sx, sy, mx, my, ex, ey, delayMs) {
    if (!circle) return;
    gsap.set(circle, { attr: { cx: sx, cy: sy }, opacity: 0 });
    addTimer(function () {  // ←FM-2: 用 addTimer 纳入统一管理
      gsap.timeline()
        .to(circle, { opacity: 1, duration: 0.15 })
        .to(circle, { attr: { cx: mx, cy: my }, duration: 0.5, ease: 'power2.out' }, '<')
        .to(circle, { attr: { cx: ex, cy: ey }, duration: 0.65, ease: 'power2.in' })
        .to(circle, { opacity: 0, duration: 0.25 });
    }, delayMs);
  }

  /* ── 初始化：所有目标 opacity:0 ── */
  var allCards = [header, memCard, userCard, promptCard, builderCard];
  allCards.forEach(function (el) { if (el) gsap.set(el, { opacity: 0, y: 10 }); });
  sources.forEach(function (s) { gsap.set(s, { opacity: 0 }); });
  if (assembleLabel) gsap.set(assembleLabel, { opacity: 0 });
  if (injectLabel)   gsap.set(injectLabel,   { opacity: 0 });
  if (beam) gsap.set(beam, { opacity: 0 });

  /* ── 终态展示函数（跳过时使用）── */
  function showAll() {
    state.timers.forEach(clearTimeout);  // ←FM-2
    state.timers = [];
    gsap.killTweensOf(slide.querySelectorAll('*'));
    allCards.forEach(function (el) { if (el) gsap.set(el, { opacity: 1, y: 0 }); });
    sources.forEach(function (s) { gsap.set(s, { opacity: 1 }); });
    if (assembleLabel) gsap.set(assembleLabel, { opacity: 1 });
    if (injectLabel)   gsap.set(injectLabel,   { opacity: 1 });
    if (beam) gsap.set(beam, { opacity: 1, attr: { x2: 908 } });
    state.phase = 'complete';
  }

  /* ════════════ 时序编排（5 秒动画）════════════ */

  /* t=0ms: 标题 fade-in */
  fadeUp(header, 0);
  state.phase = 'title_in';

  /* t=500ms: MEMORY.md 文件卡 fade-up */
  addTimer(function () {
    fadeUp(memCard, 0);
    state.phase = 'files_in';
  }, 500);

  /* t=700ms: USER.md 文件卡 fade-up（200ms 间隔）*/
  addTimer(function () { fadeUp(userCard, 0); }, 700);

  /* t=1100ms: 右列 system prompt 框出现（虚线边框）*/
  addTimer(function () {
    fadeUp(promptCard, 0);
    state.phase = 'prompt_shell_in';
  }, 1100);

  /* t=1500ms: 中列 Prompt Builder 出现 + 6 来源逐行点亮 */
  addTimer(function () {
    fadeUp(builderCard, 0);
    state.phase = 'builder_in';
    /* 6 来源逐行点亮，每行 250ms 间隔 */
    sources.forEach(function (src, i) {
      addTimer(function () {  // ←FM-2: 嵌套 timer 也归入统一数组
        gsap.to(src, { opacity: 1, duration: 0.2, ease: 'power1.out' });
      }, 250 * (i + 1));
    });
  }, 1500);

  /* t=2000ms: 粒子流启动
     SVG viewBox="0 0 1300 400"，3 列 grid 1fr:1.2fr:1fr gap=24px
     左列右边缘 x≈391，中列左边缘 x≈415，中列中心 y≈200
     MEMORY 在左列上方 y≈120，USER 在左列下方 y≈280              */
  addTimer(function () {
    state.phase = 'particles_flying';

    /* MEMORY → Builder（amber 粒子），弧顶向上 */
    [0, 200, 420, 640].forEach(function (d, i) {
      spawnParticle(memParticles[i],
        391, 120,   /* start: MEMORY.md 右边缘 */
        403, 75,    /* mid: 向上弧顶 */
        418, 190,   /* end: Builder 入口上侧 */
        d
      );
    });

    /* USER → Builder（teal 粒子），弧顶向下 */
    [0, 200, 420, 640].forEach(function (d, i) {
      spawnParticle(usrParticles[i],
        391, 280,   /* start: USER.md 右边缘 */
        403, 320,   /* mid: 向下弧顶 */
        418, 210,   /* end: Builder 入口下侧 */
        d
      );
    });
  }, 2000);

  /* t=3500ms: 拼装完成标签 + Builder→Prompt 光柱 */
  addTimer(function () {
    state.phase = 'assemble_done';
    if (assembleLabel) {
      gsap.to(assembleLabel, { opacity: 1, duration: 0.3, ease: 'power1.out' });
    }
    /* 光柱：x2 从 884 → 908 模拟光从 Builder 扫向 Prompt */
    if (beam) {
      gsap.fromTo(beam,
        { attr: { x1: 884, x2: 884 }, opacity: 1 },
        { attr: { x2: 908 }, duration: 0.55, ease: 'power2.out' }
      );
    }
  }, 3500);

  /* t=4500ms: Agent system prompt 框 amber 脉冲 1 次 */
  addTimer(function () {
    if (injectLabel) {
      gsap.to(injectLabel, { opacity: 1, duration: 0.3 });
    }
    if (promptCard) {
      /* 脉冲：border 从透明 → amber → 透明，共 0.9s */
      gsap.fromTo(promptCard,
        { boxShadow: '0 0 0 2px transparent' },
        {
          boxShadow: '0 0 0 2px #d4a574',
          duration: 0.4,
          ease: 'power2.out',
          onComplete: function () {
            gsap.to(promptCard, {
              boxShadow: '0 0 0 2px transparent',
              duration: 0.55,
              ease: 'power2.in'
            });
          }
        }
      );
    }
    state.phase = 'complete';
  }, 4500);

  /* ── Enter 键跳过 ── */
  function handleKeydown(e) {
    if (e.key === 'Enter' && state.phase !== 'complete') {
      showAll();
    }
  }
  document.addEventListener('keydown', handleKeydown);

  /* ═══════════ cleanup ═══════════ */
  return function cleanup() {
    state.timers.forEach(clearTimeout);  // ←FM-2: 一次性清所有 timer
    state.timers = [];
    gsap.killTweensOf(slide.querySelectorAll('*'));  // 清所有 tween
    document.removeEventListener('keydown', handleKeydown);
    state = {};
  };
};


/* =====================================================
   S11 · 冷记忆③ LLM 摘要层（🔴 3-worker concurrent assembly line）
   状态机：idle → header_in → warning → sessions → pipeline
           → workers_run → w1_done → w3_done → w2_done
           → schema_in → fallback_in → callout_pulse → complete
   FM-1: hookFn 入口 querySelector 防 null → noop cleanup
   FM-2: 所有 setTimeout push state.timers，cleanup 一次性 clearTimeout
   FM-3: GSAP tween 引用存 state.workers[]，cleanup killTweensOf 防泄漏
   ===================================================== */
window.slideHooks['slides/S11-llm-summary.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S11"]');
  if (!slide) return function noop() {};  // ←FM-1: querySelector 防 null

  var state = {
    timers: [],  // ←FM-2: 所有 timer 集中管理
    tweens: [],  // ←FM-3: GSAP tween 引用集中管理
    phase: 'idle'
  };

  /* ── DOM refs ── */
  var header   = slide.querySelector('#s11-header');
  var warning  = slide.querySelector('#s11-warning');
  var warnIcon = slide.querySelector('#s11-warning-icon');
  var sessions = slide.querySelector('#s11-sessions');
  var arrow1   = slide.querySelector('#s11-arrow1');
  var arrow2   = slide.querySelector('#s11-arrow2');
  var pipeline = slide.querySelector('#s11-pipeline');
  var schema   = slide.querySelector('#s11-schema');
  var fallback = slide.querySelector('#s11-fallback');
  var callout  = slide.querySelector('#s11-callout');
  var skipHint = slide.querySelector('#s11-skip');

  /* worker 元素 */
  var workers = [
    { bar: slide.querySelector('#s11-w1-bar'), status: slide.querySelector('#s11-w1-status'), icon: slide.querySelector('#s11-w1-icon'), dur: 1.2, session: 1 },
    { bar: slide.querySelector('#s11-w2-bar'), status: slide.querySelector('#s11-w2-status'), icon: slide.querySelector('#s11-w2-icon'), dur: 1.8, session: 2 },
    { bar: slide.querySelector('#s11-w3-bar'), status: slide.querySelector('#s11-w3-status'), icon: slide.querySelector('#s11-w3-icon'), dur: 1.5, session: 3 }
  ];

  /* schema rows */
  var schemaRows = [
    slide.querySelector('#s11-sr1'),
    slide.querySelector('#s11-sr2'),
    slide.querySelector('#s11-sr3'),
    slide.querySelector('#s11-sr4'),
    slide.querySelector('#s11-sr5')
  ];

  /* ── showAll：Enter 跳过时立即显示全部 ── */
  function showAll() {
    if (state.phase === 'complete') return;
    state.phase = 'complete';

    /* 清待执行 timers（动画已跳过）*/
    state.timers.forEach(clearTimeout);  // ←FM-2
    state.timers = [];

    /* kill 进行中的 GSAP tween */
    state.tweens.forEach(function (t) { if (t) t.kill(); });  // ←FM-3
    state.tweens = [];
    gsap.killTweensOf(slide.querySelectorAll('*'));

    /* 全部可见 */
    [header, warning, sessions, arrow1, pipeline, schema, arrow2].forEach(function (el) {
      if (el) { el.style.opacity = '1'; el.style.transform = 'none'; }
    });

    /* Worker 进度条全满 + done 状态 */
    workers.forEach(function (w) {
      if (w.bar) { w.bar.style.width = '100%'; w.bar.classList.add('done'); }
      if (w.icon) w.icon.textContent = '✓';
      if (w.status) { w.status.textContent = '✓ session ' + w.session; w.status.className = 's11-worker-status s11-status-done'; }
    });

    /* W4/W5 也激活（max=5 全用上） */
    var w4status = slide.querySelector('#s11-w4-status');
    var w5status = slide.querySelector('#s11-w5-status');
    var w4icon = slide.querySelector('#s11-w4');
    var w5icon = slide.querySelector('#s11-w5');
    if (w4status) { w4status.textContent = '✓ session 4'; w4status.className = 's11-worker-status s11-status-done'; }
    if (w5status) { w5status.textContent = '✓ session 5'; w5status.className = 's11-worker-status s11-status-done'; }

    /* schema 全 lit */
    schemaRows.forEach(function (row) {
      if (row) { row.classList.add('lit'); }
    });

    /* fallback + callout */
    if (fallback) { fallback.classList.add('lit'); }
    if (callout) { callout.style.opacity = '1'; }
    if (skipHint) skipHint.classList.remove('visible');
  }

  /* ── 动画序列 ── */

  /* t=0：标题 fade-in */
  var t0 = setTimeout(function () {
    state.phase = 'header_in';
    gsap.to(header, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  }, 120);
  state.timers.push(t0);  // ←FM-2

  /* t=400ms：显示跳过提示 + warning + 红色脉冲 */
  var t1 = setTimeout(function () {
    state.phase = 'warning';
    if (skipHint) skipHint.classList.add('visible');
    gsap.to(warning, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    var t1b = setTimeout(function () {
      if (warnIcon) warnIcon.classList.add('pulse');
    }, 200);
    state.timers.push(t1b);  // ←FM-2
  }, 520);
  state.timers.push(t1);

  /* t=800ms：session 卡片堆叠出现 */
  var t2 = setTimeout(function () {
    state.phase = 'sessions';
    gsap.to(sessions, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    if (arrow1) gsap.to(arrow1, { opacity: 1, duration: 0.25, ease: 'power2.out' });
  }, 920);
  state.timers.push(t2);

  /* t=1500ms：并发摘要器框出现 */
  var t3 = setTimeout(function () {
    state.phase = 'pipeline';
    gsap.to(pipeline, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    if (arrow2) gsap.to(arrow2, { opacity: 1, duration: 0.25, ease: 'power2.out' });
  }, 1620);
  state.timers.push(t3);

  /* t=1800ms：Worker 1/2/3 同时启动进度条（不同 duration 模拟真实异步） */
  var t4 = setTimeout(function () {
    state.phase = 'workers_run';

    workers.forEach(function (w) {
      if (!w.bar) return;
      var tw = gsap.fromTo(w.bar,
        { width: '0%' },
        {
          width: '100%',
          duration: w.dur,
          ease: 'none'
        }
      );
      state.tweens.push(tw);  // ←FM-3: tween 引用存档
    });
  }, 1920);
  state.timers.push(t4);

  /* t=2500ms：Worker 4/5 ⏸ 灰色等待标签（已在 HTML 默认渲染，此处加淡入） */
  var t5 = setTimeout(function () {
    /* W4/W5 进度条微动（表示等待中，不填满） */
    var w4bar = slide.querySelector('#s11-w4-bar');
    var w5bar = slide.querySelector('#s11-w5-bar');
    if (w4bar) {
      var tw4 = gsap.to(w4bar, { width: '12%', duration: 0.5, ease: 'power1.out' });
      state.tweens.push(tw4);
    }
    if (w5bar) {
      var tw5 = gsap.to(w5bar, { width: '6%', duration: 0.5, ease: 'power1.out' });
      state.tweens.push(tw5);
    }
  }, 2620);
  state.timers.push(t5);

  /* t=3000ms：Worker 1 完成（最快，1.2s 后 ≈ t=3s） */
  var t6 = setTimeout(function () {
    state.phase = 'w1_done';
    var w = workers[0];
    if (w.bar) { w.bar.style.width = '100%'; w.bar.classList.add('done'); }
    if (w.icon) w.icon.textContent = '✓';
    if (w.status) {
      w.status.textContent = '✓ session 1';
      w.status.className = 's11-worker-status s11-status-done';
    }
  }, 3120);
  state.timers.push(t6);

  /* t=3500ms：Worker 3 完成（1.5s 后 ≈ t=3.3s，动画结束后显示） */
  var t7 = setTimeout(function () {
    state.phase = 'w3_done';
    var w = workers[2];
    if (w.bar) { w.bar.style.width = '100%'; w.bar.classList.add('done'); }
    if (w.icon) w.icon.textContent = '✓';
    if (w.status) {
      w.status.textContent = '✓ session 3';
      w.status.className = 's11-worker-status s11-status-done';
    }
  }, 3620);
  state.timers.push(t7);

  /* t=3800ms：Worker 2 完成（1.8s 后 ≈ t=3.7s，动画结束后显示） */
  var t8 = setTimeout(function () {
    state.phase = 'w2_done';
    var w = workers[1];
    if (w.bar) { w.bar.style.width = '100%'; w.bar.classList.add('done'); }
    if (w.icon) w.icon.textContent = '✓';
    if (w.status) {
      w.status.textContent = '✓ session 2';
      w.status.className = 's11-worker-status s11-status-done';
    }
  }, 3920);
  state.timers.push(t8);

  /* t=4000ms：schema 框出现 */
  var t9 = setTimeout(function () {
    state.phase = 'schema_in';
    gsap.to(schema, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  }, 4120);
  state.timers.push(t9);

  /* t=4200ms：5 行逐行点亮，每 200ms 一行 */
  schemaRows.forEach(function (row, i) {
    var tRow = setTimeout(function () {
      if (row) row.classList.add('lit');
    }, 4320 + i * 200);
    state.timers.push(tRow);  // ←FM-2
  });

  /* t=5500ms：兜底机制 fade-up */
  var t10 = setTimeout(function () {
    state.phase = 'fallback_in';
    if (fallback) fallback.classList.add('lit');
  }, 5620);
  state.timers.push(t10);

  /* t=5800ms：callout 出现 + amber pulse */
  var t11 = setTimeout(function () {
    state.phase = 'callout_pulse';
    if (callout) gsap.to(callout, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    var tag = slide.querySelector('#s11-callout-tag');
    if (tag) tag.classList.add('amber-pulse');
  }, 5920);
  state.timers.push(t11);

  /* t=6200ms：complete */
  var t12 = setTimeout(function () {
    state.phase = 'complete';
    if (skipHint) skipHint.classList.remove('visible');
  }, 6320);
  state.timers.push(t12);

  /* ── Enter 键跳过 ── */
  function handleKeydown(e) {
    if (e.key === 'Enter') showAll();
  }
  document.addEventListener('keydown', handleKeydown);

  /* ═══════════ cleanup ═══════════ */
  return function cleanup() {
    state.timers.forEach(clearTimeout);  // ←FM-2: 一次性清所有 timer
    state.timers = [];
    state.tweens.forEach(function (t) { if (t) t.kill(); });  // ←FM-3: kill GSAP tweens
    state.tweens = [];
    gsap.killTweensOf(slide.querySelectorAll('*'));
    document.removeEventListener('keydown', handleKeydown);
    state = {};
  };
};

/* ═══════════════════════════════════════════════════════════════
   S09 · 冷记忆① · SQLite 持久化
   🔴 Process lifecycle dual-column comparison animation
   FM 清单：
     FM-1: noop cleanup（querySelector 防 null 时立即返回空函数）
     FM-2: 所有 timers 统一收纳 state.timers，cleanup 一次性 clearTimeout
     FM-3: 进程退出黑屏特效（flash overlay opacity 0→0.82→0，0.3s）
   ═══════════════════════════════════════════════════════════════ */
window.slideHooks['slides/S09-sqlite-persistence.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S09"]');
  if (!slide) return function noop() {};  // ←FM-1: noop cleanup

  var state = { timers: [], phase: 'idle' };
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── DOM 引用 ── */
  var overlay   = slide.querySelector('#s09-flash');
  var title     = slide.querySelector('.s09-title');
  var subtitle  = slide.querySelector('.s09-subtitle');
  var leftCol   = slide.querySelector('#s09-left-col');
  var rightCol  = slide.querySelector('#s09-right-col');
  var callout   = slide.querySelector('#s09-callout');
  var lossCard  = slide.querySelector('.s09-loss-card');
  var persistCard = slide.querySelector('.s09-persist-card');

  /* ── 辅助：showAll — 跳过动画直接终态 ── */
  function showAll() {
    if (state.phase === 'complete') return;
    state.timers.forEach(clearTimeout);  // ←FM-2: 一次性清
    state.timers = [];
    gsap.set([title, subtitle, leftCol, rightCol, callout], { opacity: 1, y: 0 });
    gsap.set(slide.querySelectorAll('.s09-stage-card'), { opacity: 1, y: 0, x: 0 });
    if (overlay) gsap.set(overlay, { opacity: 0 });
    state.phase = 'complete';
  }

  /* ── Enter 键跳过 ── */
  function handleKeydown(e) {
    if (e.key === 'Enter') showAll();
  }
  document.addEventListener('keydown', handleKeydown);

  if (prefersReduced) {
    /* reduced-motion: CSS @media 已处理终态，JS 只需标记完成 */
    state.phase = 'complete';
  } else {
    /* ── 初始化所有动画元素为不可见 ── */
    gsap.set([title, subtitle, leftCol, rightCol, callout], { opacity: 0 });
    gsap.set(slide.querySelectorAll('.s09-stage-card'), { opacity: 0 });
    if (overlay) gsap.set(overlay, { opacity: 0 });

    /* ── t=0: 标题 + 副标 fade-in（延迟 120ms 等 slide visible）── */
    var t0 = setTimeout(function () {
      state.phase = 'stage0_titles';
      gsap.fromTo([title, subtitle],
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out' }
      );
    }, 120);
    state.timers.push(t0);  // ←FM-2

    /* ── t=400ms: 双栏框淡入 ── */
    var t1 = setTimeout(function () {
      state.phase = 'stage1_cols';
      gsap.fromTo([leftCol, rightCol],
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }
      );
    }, 520);
    state.timers.push(t1);

    /* ── t=800ms: Stage 1 "Session 启动" 双栏同步显示 ── */
    var t2 = setTimeout(function () {
      state.phase = 'stage2_session';
      gsap.fromTo(slide.querySelectorAll('.s09-stage-1'),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      );
    }, 920);
    state.timers.push(t2);

    /* ── t=1500ms: Stage 2 "user 发消息" 双栏同步 ── */
    var t3 = setTimeout(function () {
      state.phase = 'stage3_message';
      gsap.fromTo(slide.querySelectorAll('.s09-stage-2'),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      );
    }, 1620);
    state.timers.push(t3);

    /* ── t=2500ms: Stage 3 "进程退出 💀" + 黑屏特效 ←FM-3 ── */
    var t4 = setTimeout(function () {
      state.phase = 'stage4_exit';
      /* 先显示退出卡 */
      gsap.fromTo(slide.querySelectorAll('.s09-stage-3-exit'),
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }
      );
      /* 黑屏蒙版：0 → 0.82 → 0，总时长约 0.3s  ←FM-3 */
      if (overlay) {
        gsap.fromTo(overlay,
          { opacity: 0 },
          {
            opacity: 0.82,
            duration: 0.15,
            ease: 'power2.in',
            onComplete: function () {
              gsap.to(overlay, { opacity: 0, duration: 0.15, ease: 'power2.out' });
            }
          }
        );
      }
    }, 2620);
    state.timers.push(t4);

    /* ── t=3000ms: Stage 4 "对照" — 左栏震动 / 右栏 amber 脉冲 ── */
    var t5 = setTimeout(function () {
      state.phase = 'stage5_contrast';
      gsap.fromTo(slide.querySelectorAll('.s09-stage-4-result'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
      );
      /* 左栏丢失卡震动 */
      var t5a = setTimeout(function () {
        if (lossCard) {
          gsap.fromTo(lossCard,
            { x: 0 },
            { x: 5, duration: 0.07, repeat: 5, yoyo: true, ease: 'power1.inOut' }
          );
        }
      }, 300);
      state.timers.push(t5a);  // ←FM-2
      /* 右栏持久化卡 amber 脉冲 */
      var t5b = setTimeout(function () {
        if (persistCard) {
          gsap.fromTo(persistCard,
            { boxShadow: '0 0 0 0 rgba(212,165,116,0)' },
            { boxShadow: '0 0 16px 2px rgba(212,165,116,0.55)', duration: 0.5, yoyo: true, repeat: 2, ease: 'power2.inOut' }
          );
        }
      }, 300);
      state.timers.push(t5b);  // ←FM-2
    }, 3120);
    state.timers.push(t5);

    /* ── t=4000ms: Stage 5 "重启" ── */
    var t6 = setTimeout(function () {
      state.phase = 'stage6_restart';
      gsap.fromTo(slide.querySelectorAll('.s09-stage-5'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      );
    }, 4120);
    state.timers.push(t6);

    /* ── t=4800ms: 底部 callout fade-up ── */
    var t7 = setTimeout(function () {
      state.phase = 'stage7_callout';
      gsap.fromTo(callout,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }, 4920);
    state.timers.push(t7);

    /* ── complete ── */
    var t8 = setTimeout(function () { state.phase = 'complete'; }, 5320);
    state.timers.push(t8);  // ←FM-2
  }

  /* ═══════════ cleanup ═══════════ */
  return function cleanup() {
    state.timers.forEach(clearTimeout);  // ←FM-2: 一次性清所有 timer
    state.timers = [];
    if (overlay) gsap.set(overlay, { opacity: 0 });
    gsap.killTweensOf(slide.querySelectorAll('*'));
    document.removeEventListener('keydown', handleKeydown);
    state = {};
  };
};

/* =====================================================
   S10 · FTS5 双索引 · Dual-query parallel pipeline animation
   状态机：IDLE → TITLE_QUERY → SPLIT → LEFT_TOKEN → RIGHT_TRIGRAM
           → DB_QUERY → RESULTS → FOOTER → CALLOUT → COMPLETE
   timer 统一 state.timers[]，Enter 跳过
   ===================================================== */
window.slideHooks['slides/S10-fts5-dual-index.html'] = function () {

  /* ── FM-1: querySelector 防 null，返回 noop cleanup ── */
  var slide = document.querySelector('[data-slide-id="S10"]');
  if (!slide) return function noop() {};  // ←FM-1: 防 null slide

  /* ── 状态闭包 ── */
  var state = {
    timers: [],          // 所有 setTimeout id，cleanup 一次性清  // ←FM-2
    completed: false,    // 已跳到终态
    phase: 0
  };

  /* ── 工具：push timer ── */
  function after(ms, fn) {                                        // ←FM-2: 统一管理
    var id = setTimeout(fn, ms);
    state.timers.push(id);
    return id;
  }

  /* ── 获取 DOM 元素 ── */
  var elHeader   = slide.querySelector('.s10-anim-header');
  var elQuery    = slide.querySelector('.s10-anim-query');
  var laneLeft   = slide.querySelector('#s10-lane-left');
  var laneRight  = slide.querySelector('#s10-lane-right');
  var tokKafka   = slide.querySelector('#s10-tok-kafka');
  var tokReba    = slide.querySelector('#s10-tok-rebalance');
  var tgBadges   = [
    slide.querySelector('#s10-tg-0'),
    slide.querySelector('#s10-tg-1'),
    slide.querySelector('#s10-tg-2'),
    slide.querySelector('#s10-tg-3')
  ];
  var sliderEl   = slide.querySelector('#s10-slider');
  var dbLeft     = slide.querySelector('#s10-db-left');
  var dbRight    = slide.querySelector('#s10-db-right');
  var dbIconL    = slide.querySelector('#s10-db-icon-left');
  var dbIconR    = slide.querySelector('#s10-db-icon-right');
  var resLeft    = slide.querySelector('#s10-result-left');
  var resRight   = slide.querySelector('#s10-result-right');
  var callout    = slide.querySelector('#s10-callout');
  var likeWarn   = slide.querySelector('#s10-like-warn');
  var footnote   = slide.querySelector('#s10-footnote');

  /* ── trigram badge 单个高度 + gap ── */
  var BADGE_STEP = 44; /* 36px height + 8px gap */

  /* ── 终态：显示全部（Enter 跳过 or 完成后再次进入）── */
  function showAll() {                                            // ←FM-3: skipToEnd 防 timer 泄漏
    state.completed = true;
    state.timers.forEach(clearTimeout);
    state.timers = [];

    gsap.set([elHeader, elQuery], { opacity: 1, y: 0 });
    gsap.set([laneLeft, laneRight], { opacity: 1 });
    laneLeft.classList.add('s10-lit-left');
    laneRight.classList.add('s10-lit-right');
    if (tokKafka)  gsap.set(tokKafka,  { opacity: 1 });
    if (tokReba)   gsap.set(tokReba,   { opacity: 1 });
    tgBadges.forEach(function (b, i) {
      if (b) {
        gsap.set(b, { opacity: 1 });
        b.style.borderColor = 'rgba(125,211,192,0.8)';
      }
    });
    if (sliderEl) {
      gsap.set(sliderEl, { opacity: 0.9 });
      sliderEl.style.top = (BADGE_STEP * 3) + 'px';
    }
    gsap.set([dbLeft, dbRight], { opacity: 1 });
    if (dbIconL) gsap.set(dbIconL, { scale: 1 });
    if (dbIconR) gsap.set(dbIconR, { scale: 1 });
    gsap.set([resLeft, resRight], { opacity: 1 });
    if (resLeft)  resLeft.classList.add('s10-hit');
    if (resRight) resRight.classList.add('s10-hit');
    gsap.set([callout, likeWarn, footnote], { opacity: 1, y: 0 });
  }

  /* ── 入场序列 ── */

  /* t=120ms: 标题 + 副标 */
  after(120, function () {
    if (!elHeader) return;
    gsap.fromTo(elHeader,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }
    );
  });

  /* t=350ms: user query 气泡 */
  after(350, function () {
    if (!elQuery) return;
    gsap.fromTo(elQuery,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  });

  /* t=600ms: 两栏 lane 入场 + 边框点亮 */
  after(600, function () {
    if (laneLeft) {
      gsap.fromTo(laneLeft,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out',
          onComplete: function () { laneLeft.classList.add('s10-lit-left'); } }
      );
    }
    if (laneRight) {
      gsap.fromTo(laneRight,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out',
          onComplete: function () { laneRight.classList.add('s10-lit-right'); } }
      );
    }
  });

  /* t=1200ms: 左路 [kafka] [rebalance] stagger */
  after(1200, function () {
    if (tokKafka) {
      gsap.fromTo(tokKafka,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(1.4)' }
      );
    }
    after(280, function () {
      if (tokReba) {
        gsap.fromTo(tokReba,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(1.4)' }
        );
      }
    });
  });

  /* t=1800ms: 右路 trigram 滑窗 – 4 个依次出现（每 400ms） */
  after(1800, function () {
    /* 先显示滑窗框，置于第一个位置 */
    if (sliderEl) {
      sliderEl.style.top = '0px';
      gsap.fromTo(sliderEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.25 }
      );
    }

    tgBadges.forEach(function (badge, i) {
      after(i * 400, function () {
        if (!badge) return;
        gsap.fromTo(badge,
          { opacity: 0, x: -10 },
          { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out',
            onComplete: function () {
              /* 滑窗框跟随移动到当前 badge */
              if (sliderEl) {
                gsap.to(sliderEl, {
                  y: i * BADGE_STEP,   /* translateY 而非 top，保持 top:0 基准 */
                  duration: 0.3,
                  ease: 'power2.inOut'
                });
              }
            }
          }
        );
      });
    });
  });

  /* t=3500ms: 数据库查询脉冲 */
  after(3500, function () {
    [dbLeft, dbRight].forEach(function (el) {
      if (!el) return;
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    });
    [dbIconL, dbIconR].forEach(function (icon) {
      if (!icon) return;
      gsap.fromTo(icon,
        { scale: 1 },
        { scale: 1.18, duration: 0.28, yoyo: true, repeat: 1, ease: 'power1.inOut' }
      );
    });
  });

  /* t=4200ms: 命中结果亮起 */
  after(4200, function () {
    if (resLeft) {
      gsap.fromTo(resLeft, { opacity: 0 }, { opacity: 1, duration: 0.35,
        onComplete: function () { resLeft.classList.add('s10-hit'); }
      });
    }
    after(200, function () {
      if (resRight) {
        gsap.fromTo(resRight, { opacity: 0 }, { opacity: 1, duration: 0.35,
          onComplete: function () { resRight.classList.add('s10-hit'); }
        });
      }
    });
  });

  /* t=5000ms: LIKE 警告 + 注脚 */
  after(5000, function () {
    if (likeWarn) {
      gsap.fromTo(likeWarn,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
    after(300, function () {
      if (footnote) {
        gsap.fromTo(footnote,
          { opacity: 0 },
          { opacity: 1, duration: 0.4 }
        );
      }
    });
  });

  /* t=5800ms: callout pulse 一次 */
  after(5800, function () {
    if (!callout) return;
    gsap.fromTo(callout,
      { opacity: 0, scale: 0.97 },
      { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.3)',
        onComplete: function () {
          gsap.to(callout, {
            scale: 1.015, duration: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut'
          });
        }
      }
    );
    after(900, function () { state.completed = true; });
  });

  /* ── Enter 跳过 ── */
  function handleKeydown(e) {
    if (e.key === 'Enter' && !state.completed) {
      showAll();
    }
  }
  document.addEventListener('keydown', handleKeydown);

  /* ── cleanup（必须 return）── */
  return function cleanup() {
    state.timers.forEach(clearTimeout);          // ←FM-2: 一次性清所有 timer，防跨 slide 泄漏
    state.timers = [];
    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(slide.querySelectorAll('*'));  // ←FM-3: kill 所有 tween
    }
    document.removeEventListener('keydown', handleKeydown);
    /* 清 lit class，防止下次进入时 border 残留 */
    if (laneLeft)  laneLeft.classList.remove('s10-lit-left');
    if (laneRight) laneRight.classList.remove('s10-lit-right');
    if (resLeft)   resLeft.classList.remove('s10-hit');
    if (resRight)  resRight.classList.remove('s10-hit');
    state = {};
  };
};

/* ─────────────────────────────────────────────────────────
   S12 · 完整周期 · 沉浸式对话框（灵魂页）
   🔴🔴 ChatGPT-style immersive dialog + Agent internal state
   FM 清单：
     FM-1: hookFn 入口 noop return（data-slide-id 防 null）
     FM-2: typewriter interval 可 kill（typeIntervals 统一收纳）
     FM-3: 所有 timer 统一 state.timers 数组，cleanup 一次性 clear
───────────────────────────────────────────────────────── */
window.slideHooks['slides/S12-full-cycle.html'] = function () {
  /* ── FM-1: 入口防 null ── */
  var slide = document.querySelector('[data-slide-id="S12"]');
  if (!slide) return function noop() {};  // ←FM-1

  /* ── 局部状态（闭包内，不污染全局）── */
  var state = {
    timers: [],        // ←FM-3: 统一 timer 数组
    typeIntervals: [], // ←FM-2: typewriter interval 数组
    phase: 'idle',
    complete: false
  };

  /* ── addTimer 辅助（所有 setTimeout 必须经此注册）── */
  function addTimer(fn, ms) {  // ←FM-3
    var id = setTimeout(fn, ms);
    state.timers.push(id);
    return id;
  }

  /* ── typewriter 辅助 ←FM-2 ── */
  function typewrite(el, text, speed, onDone) {
    var i = 0;
    el.textContent = '';
    var id = setInterval(function () {
      if (i >= text.length) {
        clearInterval(id);
        state.typeIntervals = state.typeIntervals.filter(function (x) { return x !== id; });
        if (onDone) onDone();
        return;
      }
      el.textContent += text[i++];
    }, speed);
    state.typeIntervals.push(id);  // ←FM-2: 收纳
    return id;
  }

  /* ── count-up 辅助 ── */
  function countUp(el, target, duration) {
    var step = Math.max(1, Math.round(target / (duration / 30)));
    var current = 0;
    var id = setInterval(function () {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) {
        clearInterval(id);
        state.typeIntervals = state.typeIntervals.filter(function (x) { return x !== id; });
      }
    }, 30);
    state.typeIntervals.push(id);
  }

  /* ── DOM 节点引用 ── */
  var chatBox      = document.getElementById('s12-chat-box');
  var banner       = document.getElementById('s12-banner');
  var cntMem       = document.getElementById('s12-cnt-mem');
  var cntUser      = document.getElementById('s12-cnt-user');
  var userRow      = document.getElementById('s12-user-row');
  var bubbleUser   = document.getElementById('s12-bubble-user');
  var internal     = document.getElementById('s12-internal');
  var stepKeyword  = document.getElementById('s12-step-keyword');
  var stepTool     = document.getElementById('s12-step-tool');
  var stepFts5     = document.getElementById('s12-step-fts5');
  var fts5Bar      = document.getElementById('s12-fts5-bar');
  var fts5Ok       = document.getElementById('s12-fts5-ok');
  var stepHit      = document.getElementById('s12-step-hit');
  var sessionCards = document.querySelectorAll('[data-slide-id="S12"] .s12-session-card');
  var stepWorkers  = document.getElementById('s12-step-workers');
  var w1Row        = document.getElementById('s12-w1-row');
  var w2Row        = document.getElementById('s12-w2-row');
  var w3Row        = document.getElementById('s12-w3-row');
  var w1Bar        = document.getElementById('s12-w1-bar');
  var w2Bar        = document.getElementById('s12-w2-bar');
  var w3Bar        = document.getElementById('s12-w3-bar');
  var w1Ok         = document.getElementById('s12-w1-ok');
  var w2Ok         = document.getElementById('s12-w2-ok');
  var w3Ok         = document.getElementById('s12-w3-ok');
  var stepPrompt   = document.getElementById('s12-step-prompt');
  var pbMem        = document.getElementById('s12-pb-mem');
  var pbUser       = document.getElementById('s12-pb-user');
  var pbSum        = document.getElementById('s12-pb-sum');
  var pbQuery      = document.getElementById('s12-pb-query');
  var stepLlm      = document.getElementById('s12-step-llm');
  var agentRow     = document.getElementById('s12-agent-row');
  var bubbleAgent  = document.getElementById('s12-bubble-agent');
  var statusBar    = document.getElementById('s12-status');
  var hookText     = document.getElementById('s12-hook-text');

  /* ── fadeStep 辅助（步骤行淡入）── */
  function fadeStep(el) {
    if (!el) return;
    gsap.to(el, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' });
  }

  /* ── showAll：立即显示终态（Enter 跳过）── */
  function showAll() {
    if (state.complete) return;
    state.complete = true;
    state.phase = 'complete';

    /* 清除所有挂起 timer / interval */
    state.timers.forEach(clearTimeout);      // ←FM-3
    state.typeIntervals.forEach(clearInterval);  // ←FM-2
    state.timers = [];
    state.typeIntervals = [];

    /* 对话框 */
    if (chatBox) gsap.set(chatBox, { opacity: 1 });

    /* banner */
    if (banner) gsap.set(banner, { opacity: 1, y: 0 });
    if (cntMem)  cntMem.textContent  = '87';
    if (cntUser) cntUser.textContent = '12';

    /* user 气泡 */
    if (userRow) gsap.set(userRow, { opacity: 1 });
    if (bubbleUser) bubbleUser.textContent = '上次我们聊的 kafka rebalance ？';

    /* 内部状态面板（显示但 opacity 0.5 作为档案）*/
    if (internal) gsap.set(internal, { opacity: 0.5, y: 0 });

    /* 所有 step 显示 */
    var allSteps = [stepKeyword, stepTool, stepFts5, stepHit, stepWorkers, stepPrompt, stepLlm];
    allSteps.forEach(function (s) {
      if (s) gsap.set(s, { opacity: 1, x: 0 });
    });

    /* FTS5 进度条 */
    if (fts5Bar) fts5Bar.style.width = '100%';
    if (fts5Ok)  gsap.set(fts5Ok, { opacity: 1 });

    /* session 卡片 */
    sessionCards.forEach(function (c) {
      gsap.set(c, { opacity: 1, scale: 1 });
    });

    /* Worker 行 + 进度条 */
    [w1Row, w2Row, w3Row].forEach(function (r) {
      if (r) gsap.set(r, { opacity: 1 });
    });
    [w1Bar, w2Bar, w3Bar].forEach(function (b) {
      if (b) { b.style.transition = 'none'; b.style.width = '100%'; }
    });
    [w1Ok, w2Ok, w3Ok].forEach(function (o) {
      if (o) gsap.set(o, { opacity: 1 });
    });

    /* prompt 色块 */
    [pbMem, pbUser, pbSum, pbQuery].forEach(function (p) {
      if (p) gsap.set(p, { opacity: 1, x: 0, y: 0 });
    });

    /* agent 回答 */
    if (agentRow) gsap.set(agentRow, { opacity: 1 });
    if (bubbleAgent) {
      bubbleAgent.textContent = '上次你遇到的 kafka rebalance 是因为 consumer group session.timeout.ms 设置过短。当 GC pause 超过超时阈值，broker 认为 consumer 已下线，立即触发 rebalance。建议将 session.timeout.ms 调整为 45s，并配合 heartbeat.interval.ms = 15s，可显著降低误判 rebalance 频率。';
    }

    /* toast */
    if (statusBar) gsap.set(statusBar, { opacity: 1, y: 0 });
    if (hookText) hookText.classList.add('pulse');
  }

  /* ════════════════════════════════════════════
     12 阶段动画时序
  ════════════════════════════════════════════ */

  /* t=0  阶段 0：对话框渐入 */
  addTimer(function () {
    state.phase = 'phase_0';
    if (!chatBox) return;
    gsap.fromTo(chatBox,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }
    );
  }, 120);

  /* t=600ms  阶段 1：热记忆 banner 滑入 + count-up */
  addTimer(function () {
    state.phase = 'phase_1';
    if (!banner) return;
    gsap.fromTo(banner,
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out',
        onComplete: function () {
          countUp(cntMem,  87, 900);
          countUp(cntUser, 12, 700);
        }
      }
    );
  }, 600);

  /* t=1800ms  阶段 2：user 气泡打字机 */
  addTimer(function () {
    state.phase = 'phase_2';
    if (!userRow) return;
    gsap.fromTo(userRow,
      { opacity: 0, x: 16 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out',
        onComplete: function () {
          if (bubbleUser) {
            typewrite(bubbleUser, '上次我们聊的 kafka rebalance ？', 35);
          }
        }
      }
    );
  }, 1800);

  /* t=2700ms  阶段 3：内部状态面板展开 */
  addTimer(function () {
    state.phase = 'phase_3';
    if (!internal) return;
    gsap.fromTo(internal,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  }, 2700);

  /* t=3200ms  阶段 4：检测关键词 */
  addTimer(function () {
    state.phase = 'phase_4';
    fadeStep(stepKeyword);
  }, 3200);

  /* t=3700ms  阶段 5：触发工具 */
  addTimer(function () {
    state.phase = 'phase_5';
    fadeStep(stepTool);
  }, 3700);

  /* t=4200ms  阶段 6：FTS5 查询进度条 */
  addTimer(function () {
    state.phase = 'phase_6';
    fadeStep(stepFts5);
    addTimer(function () {
      if (fts5Bar) fts5Bar.style.width = '100%';
      addTimer(function () {
        if (fts5Ok) gsap.to(fts5Ok, { opacity: 1, duration: 0.25 });
      }, 1050);
    }, 100);
  }, 4200);

  /* t=5300ms  阶段 7：命中 5 个 session */
  addTimer(function () {
    state.phase = 'phase_7';
    fadeStep(stepHit);
    /* 5 个 session 卡片 stagger 闪现 */
    sessionCards.forEach(function (card, i) {
      addTimer(function () {
        gsap.fromTo(card,
          { opacity: 0, scale: 0.85 },
          { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.4)' }
        );
      }, i * 120);
    });
  }, 5300);

  /* t=6500ms  阶段 8：3 Worker 并行进度条 */
  addTimer(function () {
    state.phase = 'phase_8';
    fadeStep(stepWorkers);

    /* Worker 行淡入 */
    [w1Row, w2Row, w3Row].forEach(function (r, i) {
      addTimer(function () {
        if (r) gsap.fromTo(r, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      }, i * 80);
    });

    /* 进度条启动（3 个同时，不同 duration 由 CSS transition 控制）*/
    addTimer(function () {
      if (w1Bar) w1Bar.style.width = '100%';
      if (w2Bar) w2Bar.style.width = '100%';
      if (w3Bar) w3Bar.style.width = '100%';

      /* W1 1.2s 完成 */
      addTimer(function () {
        if (w1Ok) gsap.to(w1Ok, { opacity: 1, duration: 0.25 });
      }, 1250);
      /* W3 1.5s 完成 */
      addTimer(function () {
        if (w3Ok) gsap.to(w3Ok, { opacity: 1, duration: 0.25 });
      }, 1550);
      /* W2 1.8s 完成 */
      addTimer(function () {
        if (w2Ok) gsap.to(w2Ok, { opacity: 1, duration: 0.25 });
      }, 1850);
    }, 300);
  }, 6500);

  /* t=8500ms  阶段 9：拼装 prompt（4 色块汇聚）*/
  addTimer(function () {
    state.phase = 'phase_9';
    fadeStep(stepPrompt);
    addTimer(function () {
      if (pbMem)   gsap.fromTo(pbMem,   { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' });
      if (pbUser)  gsap.fromTo(pbUser,  { opacity: 0, x: 18  }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' });
      if (pbSum)   gsap.fromTo(pbSum,   { opacity: 0, y: 12  }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', delay: 0.1 });
      if (pbQuery) gsap.fromTo(pbQuery, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', delay: 0.15 });
    }, 200);
  }, 8500);

  /* t=9000ms  阶段 10：LLM 推理 spinner */
  addTimer(function () {
    state.phase = 'phase_10';
    fadeStep(stepLlm);
  }, 9000);

  /* t=9700ms  阶段 11：内部面板淡化 + Agent 回答打字机 */
  addTimer(function () {
    state.phase = 'phase_11';
    /* 内部面板降至 0.5 opacity（保留作"幕后档案"）*/
    if (internal) gsap.to(internal, { opacity: 0.5, duration: 0.6, ease: 'power1.inOut' });
    /* agent 回答气泡出现 */
    if (agentRow) {
      gsap.fromTo(agentRow,
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out',
          onComplete: function () {
            if (bubbleAgent) {
              typewrite(
                bubbleAgent,
                '上次你遇到的 kafka rebalance 是因为 consumer group session.timeout.ms 设置过短。当 GC pause 超过超时阈值，broker 认为 consumer 已下线，立即触发 rebalance。建议将 session.timeout.ms 调整为 45s，并配合 heartbeat.interval.ms = 15s，可显著降低误判 rebalance 频率。',
                28
              );
            }
          }
        }
      );
    }
  }, 9700);

  /* t=10800ms  阶段 12：底部 toast + 第 2 章钩子 amber pulse */
  addTimer(function () {
    state.phase = 'phase_12';
    if (!statusBar) return;
    gsap.fromTo(statusBar,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out',
        onComplete: function () {
          if (hookText) hookText.classList.add('pulse');
          state.complete = true;
        }
      }
    );
  }, 10800);

  /* ── Enter 键跳过 ── */
  function handleKeydown(e) {
    if (e.key === 'Enter' && !state.complete) {
      showAll();
    }
  }
  document.addEventListener('keydown', handleKeydown);

  /* ═══════════════ cleanup ═══════════════ */
  return function cleanup() {
    /* ←FM-3: 清所有 setTimeout */
    state.timers.forEach(clearTimeout);
    state.timers = [];
    /* ←FM-2: 清所有 typewriter interval */
    state.typeIntervals.forEach(clearInterval);
    state.typeIntervals = [];
    /* GSAP 全清 */
    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(slide.querySelectorAll('*'));  // ←FM-1
    }
    /* 移除事件监听 */
    document.removeEventListener('keydown', handleKeydown);
    /* 重置关键文本（防止 re-enter 打字机累积）*/
    if (bubbleUser)  bubbleUser.textContent  = '';
    if (bubbleAgent) bubbleAgent.textContent = '';
    if (cntMem)  cntMem.textContent  = '0';
    if (cntUser) cntUser.textContent = '0';
    if (hookText) hookText.classList.remove('pulse');
    state = {};
  };
};

/* ═══════════════════════════════════════════════════════════════════════
   S14 · 第二章过渡页（chapter2-intro）
   五连击节点 stagger 点亮（350ms）+ SVG 连线 stroke-dashoffset 流动绘制
   ═══════════════════════════════════════════════════════════════════════ */
window.slideHooks['slides/S14-chapter2-intro.html'] = function () {
  const slide = document.querySelector('[data-slide-id="S14"]');
  if (!slide) return function noop() {};

  const nodes = slide.querySelectorAll('.s14c-node');           // 5 个
  const lines = slide.querySelectorAll('.s14c-line');           // 4 条
  const pill  = slide.querySelector('#s14c-pill');

  /* ←FM-2: 入口先重置所有 .lit / .draw 防 re-enter 残影 */
  nodes.forEach(n => n.classList.remove('lit'));
  lines.forEach(l => {
    l.classList.remove('draw');
    l.style.transition = 'none';
    l.style.strokeDasharray = '';
    l.style.strokeDashoffset = '';
  });
  if (pill) pill.classList.remove('lit');

  /* ←FM-3: timerIds 统一数组，cleanup 一次性 clearTimeout */
  const timerIds = [];

  /* ←FM-1: requestAnimationFrame 包 getTotalLength() / getBoundingClientRect 防 0
     SVG 在 layout 完成前 length 可能为 0，rAF 等下一帧再读 */
  requestAnimationFrame(() => {
    /* 用 line 的两端点直接算长度（比 getTotalLength 更稳）*/
    lines.forEach(line => {
      const x1 = parseFloat(line.getAttribute('x1')) || 0;
      const y1 = parseFloat(line.getAttribute('y1')) || 0;
      const x2 = parseFloat(line.getAttribute('x2')) || 0;
      const y2 = parseFloat(line.getAttribute('y2')) || 0;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 200;
      line.style.strokeDasharray  = len + ' ' + len;
      line.style.strokeDashoffset = len;
      /* 强制 reflow 让初始态生效，再恢复 transition */
      // eslint-disable-next-line no-unused-expressions
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 0.5s ease-out';
    });

    /* ── stagger 调度 ── */
    const NODE_INTERVAL = 350;   // 节点间隔
    const LINE_DELAY    = 200;   // 连线比节点延迟 200ms
    const PILL_DELAY    = 600;   // 全亮后 pill 延迟 600ms 出

    nodes.forEach((node, idx) => {
      const t = setTimeout(() => {
        node.classList.add('lit');
      }, idx * NODE_INTERVAL);
      timerIds.push(t);
    });

    lines.forEach((line, idx) => {
      /* 第 idx 条线在第 idx+1 节点亮后 LINE_DELAY 启动绘制 */
      const t = setTimeout(() => {
        line.classList.add('draw');
      }, idx * NODE_INTERVAL + LINE_DELAY);
      timerIds.push(t);
    });

    /* 5 节点全亮 + 最后一条线绘完后，pill 出现 */
    const pillAt = (nodes.length - 1) * NODE_INTERVAL + LINE_DELAY + 500 + PILL_DELAY;
    const tp = setTimeout(() => {
      if (pill) pill.classList.add('lit');
    }, pillAt);
    timerIds.push(tp);
  });

  /* ═══════════════ cleanup ═══════════════ */
  return function cleanup() {
    /* ←FM-3: 清所有 setTimeout */
    timerIds.forEach(clearTimeout);
    timerIds.length = 0;
    /* 重置节点 / 连线 / pill */
    nodes.forEach(n => n.classList.remove('lit'));
    lines.forEach(l => {
      l.classList.remove('draw');
      l.style.transition = 'none';
      l.style.strokeDasharray = '';
      l.style.strokeDashoffset = '';
    });
    if (pill) pill.classList.remove('lit');
  };
};



/* ═══════════════════════════════════════════════════════════════════════
   S16 · 双计数器 · memory user-turn vs skill tool-iter（🔴🔴 灵魂页）
   状态机：idle → playing → paused → done
   核心反直觉：典型一个 user-turn 含 5 个 tool call → skill 涨速 ≈ 5× memory
   ←FM-1: 入口完整重置（重置所有 .lit / .bump / .fired / .show / 计数器归 0）
   ←FM-2: timerIds 统一数组，cleanup 一次性 clearTimeout + removeEventListener
   ←FM-3: 状态机切换不污染（暂停 → 重置后能重新播放，slider 切换重启）
   ═══════════════════════════════════════════════════════════════════════ */
window.slideHooks['slides/S16-dual-counter.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S16"]');
  if (!slide) return function noop() {};  // ←FM-1: noop cleanup 防 DOM 缺失早退

  /* ── prefers-reduced-motion 检查：立即显示终态 ── */
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    slide.querySelectorAll('.s16d-tool-node').forEach(function (n) { n.classList.add('lit'); });
    slide.querySelectorAll('.s16d-tick').forEach(function (t) { t.style.opacity = '1'; t.style.transform = 'none'; });
    var bUser  = slide.querySelector('#s16d-bubble-user');
    var bAgent = slide.querySelector('#s16d-bubble-agent');
    if (bUser)  bUser.style.opacity  = '1';
    if (bAgent) bAgent.style.opacity = '1';
    return function noop() {};
  }

  /* ────────── DOM 引用 ────────── */
  var bubbleUser   = slide.querySelector('#s16d-bubble-user');
  var bubbleAgent  = slide.querySelector('#s16d-bubble-agent');
  var toolNodes    = [1,2,3,4,5].map(function (i) { return slide.querySelector('#s16d-tool-' + i); });
  var trackMem     = slide.querySelector('#s16d-track-mem');
  var trackSkill   = slide.querySelector('#s16d-track-skill');
  var fireMem      = slide.querySelector('#s16d-fire-mem');
  var fireSkill    = slide.querySelector('#s16d-fire-skill');
  var cntMemEl     = slide.querySelector('#s16d-cnt-mem');
  var cntSkillEl   = slide.querySelector('#s16d-cnt-skill');
  var cntSkillThr  = slide.querySelector('#s16d-cnt-skill-thresh');
  var threshLabel  = slide.querySelector('#s16d-thresh-skill-label');
  var threshLine   = slide.querySelector('#s16d-thresh-skill');
  var ticksMem     = [1,2,3,4,5,6,7,8,9,10].map(function (i) { return slide.querySelector('#s16d-tick-mem-' + i); });
  var ticksSkill   = [1,2,3,4,5,6,7,8,9,10].map(function (i) { return slide.querySelector('#s16d-tick-skill-' + i); });
  var btnPlay      = slide.querySelector('#s16d-btn-play');
  var btnStep      = slide.querySelector('#s16d-btn-step');
  var btnReset     = slide.querySelector('#s16d-btn-reset');
  var slider       = slide.querySelector('#s16d-slider');
  var statePill    = slide.querySelector('#s16d-state-pill');

  /* ────────── 状态 ──────────  ←FM-2 / FM-3 */
  var state = {
    timerIds: [],          /* ←FM-2: 统一 timer 数组 */
    phase: 'idle',         /* idle | playing | paused | done */
    cntMem: 0,
    cntSkill: 0,
    nudgeInterval: 10,     /* slider 当前值 */
    /* 当前 turn 内 tool 进度（0..5），用于「单步」模式接力 */
    turnIdx: 0,
    toolIdx: 0,
    /* 🔴 FM-3: 用 token 表示「当前调度上下文」，重置/暂停后旧 timer 唤醒时检查 token 决定丢弃，
       避免暂停后再播放出现旧 timer 写入新计数的污染 */
    runToken: 0
  };

  /* ────────── helper ────────── */
  function addTimer(fn, delay) {            /* ←FM-2: 所有 setTimeout 经此入口 */
    var id = setTimeout(fn, delay);
    state.timerIds.push(id);
    return id;
  }
  function clearAllTimers() {                /* ←FM-2: 一次性清 */
    state.timerIds.forEach(clearTimeout);
    state.timerIds = [];
  }
  function setStatePill(label, cls) {
    if (!statePill) return;
    statePill.textContent = label;
    statePill.classList.remove('playing', 'paused');
    if (cls) statePill.classList.add(cls);
  }

  /* ────────── 入口完整重置 ────────── ←FM-1 */
  function fullReset() {
    clearAllTimers();
    state.runToken += 1;                    /* ←FM-3: 让所有旧 in-flight timer 失效 */
    state.phase = 'idle';
    state.cntMem = 0;
    state.cntSkill = 0;
    state.turnIdx = 0;
    state.toolIdx = 0;

    /* 视觉重置：tool 节点 / tick / 高亮 / 弹跳 / badge */
    toolNodes.forEach(function (n) { if (n) n.classList.remove('lit'); });
    ticksMem.forEach(function (t)  { if (t) { t.style.opacity = '0'; t.style.transform = 'translateY(4px) scale(0.6)'; } });
    ticksSkill.forEach(function (t){ if (t) { t.style.opacity = '0'; t.style.transform = 'translateY(4px) scale(0.6)'; } });
    if (cntMemEl)   { cntMemEl.textContent   = '0'; cntMemEl.classList.remove('bump'); }
    if (cntSkillEl) { cntSkillEl.textContent = '0'; cntSkillEl.classList.remove('bump'); }
    if (trackMem)   trackMem.classList.remove('fired');
    if (trackSkill) trackSkill.classList.remove('fired');
    if (fireMem)    fireMem.classList.remove('show');
    if (fireSkill)  fireSkill.classList.remove('show');
    if (bubbleUser)  bubbleUser.style.opacity  = '0';
    if (bubbleAgent) bubbleAgent.style.opacity = '0';

    setStatePill('idle', null);
  }

  /* ────────── 计数器自增（带 bump 动画）────────── */
  function bumpCounter(el) {
    if (!el) return;
    el.classList.remove('bump');
    /* 强制 reflow 让动画可重放 */
    void el.offsetWidth;
    el.classList.add('bump');
  }
  function incMem() {
    state.cntMem += 1;
    if (cntMemEl) cntMemEl.textContent = String(state.cntMem);
    bumpCounter(cntMemEl);
    /* 点亮对应 tick */
    var tick = ticksMem[state.cntMem - 1];
    if (tick) {
      tick.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(.4,1.5,.5,1)';
      tick.style.opacity = '1';
      tick.style.transform = 'translateY(0) scale(1)';
    }
    /* 阈值检查：memory 阈值 demo 用 2（生产默认 10，详见 lesson §2.2 L825） */
    if (state.cntMem >= 2) {
      fireThreshold('mem');
    }
  }
  function incSkill() {
    state.cntSkill += 1;
    if (cntSkillEl) cntSkillEl.textContent = String(state.cntSkill);
    bumpCounter(cntSkillEl);
    var tick = ticksSkill[Math.min(state.cntSkill - 1, 9)];
    if (tick) {
      tick.style.transition = 'opacity 0.25s ease, transform 0.3s cubic-bezier(.4,1.5,.5,1)';
      tick.style.opacity = '1';
      tick.style.transform = 'translateY(0) scale(1)';
    }
    /* 阈值检查：skill 阈值 = 当前 nudge_interval（3 / 5 / 10）*/
    if (state.cntSkill >= state.nudgeInterval) {
      fireThreshold('skill');
    }
  }

  /* ────────── 阈值穿透：spawn_review badge + reset 该轨道计数 ────────── */
  function fireThreshold(which) {
    var track = which === 'mem' ? trackMem : trackSkill;
    var badge = which === 'mem' ? fireMem  : fireSkill;
    if (!track || !badge) return;
    track.classList.remove('fired');
    badge.classList.remove('show');
    void track.offsetWidth; void badge.offsetWidth;
    track.classList.add('fired');
    badge.classList.add('show');

    /* 阈值穿透后，该计数器归 0（模拟 spawn_review 后重新计数）*/
    var token = state.runToken;
    addTimer(function () {
      if (token !== state.runToken) return;     /* ←FM-3: 旧 token 丢弃 */
      if (which === 'mem') {
        state.cntMem = 0;
        if (cntMemEl) cntMemEl.textContent = '0';
        ticksMem.forEach(function (t) { if (t) { t.style.opacity = '0'; t.style.transform = 'translateY(4px) scale(0.6)'; } });
      } else {
        state.cntSkill = 0;
        if (cntSkillEl) cntSkillEl.textContent = '0';
        ticksSkill.forEach(function (t) { if (t) { t.style.opacity = '0'; t.style.transform = 'translateY(4px) scale(0.6)'; } });
      }
    }, 1100);
  }

  /* ────────── 单个 user-turn cycle（用 token 隔离）────────── */
  /* Stage 1（0–1.5s）：user 气泡 + 重置 tool / agent
     Stage 2（1.5–7.5s）：5 tool 依次点亮，每个间隔 1.2s，每次 incSkill
     Stage 3（7.5–9s）：agent 气泡 + incMem
     Stage 4（9–11s）：判定阶段（已在 incXxx 内 inline 触发）
     Stage 5（11s）：自动进入下一 cycle（除非 done/paused） */
  function runTurn(token) {
    if (token !== state.runToken) return;       /* ←FM-3 */
    state.turnIdx += 1;
    state.toolIdx = 0;

    /* Stage 1: user 气泡入场 */
    if (bubbleUser)  bubbleUser.style.opacity  = '0';
    if (bubbleAgent) bubbleAgent.style.opacity = '0';
    toolNodes.forEach(function (n) { if (n) n.classList.remove('lit'); });
    addTimer(function () {
      if (token !== state.runToken) return;
      if (bubbleUser) {
        bubbleUser.style.transition = 'opacity 0.4s ease';
        bubbleUser.style.opacity = '1';
      }
    }, 200);

    /* Stage 2: 5 tool 依次点亮 + skill +1（间隔 1.0s，给观众时间） */
    [0,1,2,3,4].forEach(function (i) {
      addTimer(function () {
        if (token !== state.runToken) return;
        var node = toolNodes[i];
        if (node) node.classList.add('lit');
        incSkill();
        state.toolIdx = i + 1;
      }, 1500 + i * 1000);
    });

    /* Stage 3: agent final response + memory +1 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (bubbleAgent) {
        bubbleAgent.style.transition = 'opacity 0.4s ease';
        bubbleAgent.style.opacity = '1';
      }
      incMem();
    }, 7000);

    /* Stage 5: 自动循环（间隔 9s 后） */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (state.phase !== 'playing') return;     /* 暂停/done 都不再续 */
      runTurn(token);
    }, 9500);
  }

  /* ────────── 单步：执行一个 tool（或推进到下一 turn）────────── */
  function stepOnce() {
    /* 单步进入会强制 paused（不自动续 timer），用同步推进代替 */
    if (state.phase === 'playing') {
      pauseRun();
    }
    if (state.phase === 'done') return;
    state.phase = 'paused';
    setStatePill('paused', 'paused');

    /* 如果当前 turn 还没开始 → 显示 user 气泡 + 第 1 个 tool */
    if (state.toolIdx === 0) {
      state.turnIdx += 1;
      if (bubbleUser)  bubbleUser.style.opacity  = '1';
      if (bubbleAgent) bubbleAgent.style.opacity = '0';
      toolNodes.forEach(function (n) { if (n) n.classList.remove('lit'); });
      var n0 = toolNodes[0];
      if (n0) n0.classList.add('lit');
      incSkill();
      state.toolIdx = 1;
      return;
    }
    /* 中间 tool 推进 */
    if (state.toolIdx < 5) {
      var nx = toolNodes[state.toolIdx];
      if (nx) nx.classList.add('lit');
      incSkill();
      state.toolIdx += 1;
      return;
    }
    /* tool 跑完 → agent + memory +1 */
    if (state.toolIdx === 5) {
      if (bubbleAgent) bubbleAgent.style.opacity = '1';
      incMem();
      state.toolIdx = 0;   /* 下次单步进入新 turn */
      return;
    }
  }

  /* ────────── 状态机控制 ────────── */
  function startRun() {
    /* idle / paused / done 都先 fullReset 再起 */
    fullReset();
    state.phase = 'playing';
    setStatePill('playing', 'playing');
    if (btnPlay) btnPlay.textContent = '⏸ 暂停';
    runTurn(state.runToken);
  }
  function pauseRun() {
    state.phase = 'paused';
    setStatePill('paused', 'paused');
    if (btnPlay) btnPlay.textContent = '▶ 继续';
    state.runToken += 1;        /* ←FM-3: 让 in-flight timer 全部失效 */
    clearAllTimers();
  }
  function resumeRun() {
    /* 接着当前 cnt 继续跑（不 reset 计数）*/
    state.phase = 'playing';
    setStatePill('playing', 'playing');
    if (btnPlay) btnPlay.textContent = '⏸ 暂停';
    runTurn(state.runToken);
  }
  function togglePlay() {
    if (state.phase === 'playing') {
      pauseRun();
    } else if (state.phase === 'paused') {
      resumeRun();
    } else {
      /* idle / done */
      startRun();
    }
  }
  function resetAll() {
    fullReset();
    if (btnPlay) btnPlay.textContent = '▶ 播放';
  }
  function onSliderChange() {
    var v = parseInt(slider.value, 10);
    if (!isNaN(v)) state.nudgeInterval = v;
    if (cntSkillThr) cntSkillThr.textContent = String(v);
    if (threshLabel) threshLabel.textContent = String(v);
    /* 阈值线位置：v=10 时 90%，v=5 时 45%，v=3 时 27%（线性映射 to 9% per unit）*/
    if (threshLine) threshLine.style.left = (v * 9) + '%';
    /* slider 切换 → 强制 reset 并重新跑 */
    if (state.phase === 'playing' || state.phase === 'paused') {
      startRun();
    } else {
      resetAll();
    }
  }

  /* ────────── 事件绑定 ────────── */
  if (btnPlay)  btnPlay.addEventListener('click', togglePlay);
  if (btnStep)  btnStep.addEventListener('click', stepOnce);
  if (btnReset) btnReset.addEventListener('click', resetAll);
  if (slider)   slider.addEventListener('change', onSliderChange);

  /* 初始化：reset + 显示气泡占位（避免空白突兀）*/
  fullReset();

  /* ────────── cleanup ────────── ←FM-1 / FM-2 / FM-3 */
  return function cleanup() {
    state.runToken += 1;                                /* ←FM-3 */
    clearAllTimers();                                   /* ←FM-2 */
    if (btnPlay)  btnPlay.removeEventListener('click', togglePlay);
    if (btnStep)  btnStep.removeEventListener('click', stepOnce);
    if (btnReset) btnReset.removeEventListener('click', resetAll);
    if (slider)   slider.removeEventListener('change', onSliderChange);
    /* 视觉重置（防止 re-enter 时还停留在旧状态）*/
    if (cntMemEl)   cntMemEl.textContent   = '0';
    if (cntSkillEl) cntSkillEl.textContent = '0';
    if (bubbleUser)  bubbleUser.style.opacity  = '0';
    if (bubbleAgent) bubbleAgent.style.opacity = '0';
    state = {};
  };
};


/* =====================================================================
   S17 · 判定时机 turn-end vs mid-tool（🔴🔴 toggle 时序对比）
   状态机：state ∈ {correct, wrong}
   FM 清单：
     ←FM-1: 入口默认 state=correct，cleanup 重置 state
     ←FM-2: 切换 toggle 不重建 DOM，只切 .active class / .visible class
     ←FM-3: timerIds + 折叠源码 click handler 全部解绑（cleanup）
   ===================================================================== */
window.slideHooks['slides/S17-decision-timing.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S17"]');
  if (!slide) return function noop () {};  // ←FM-1: 防 DOM 缺失早退

  /* ── 局部状态 ── */
  var timerIds = [];                  // ←FM-3
  var state = { mode: 'correct' };    // ←FM-1: 入口默认 correct

  /* ── DOM 引用 ── */
  var btnCorrect    = slide.querySelector('#s17d-btn-correct');
  var btnWrong      = slide.querySelector('#s17d-btn-wrong');
  var spawnCorrect  = slide.querySelector('#s17d-spawn-correct');
  var spawnWrong    = slide.querySelector('#s17d-spawn-wrong');
  var arrowCorrect  = slide.querySelector('#s17d-arrow-correct');
  var lineT2Spawn   = slide.querySelector('#s17d-line-t2-spawn');
  var linePulseT2   = slide.querySelector('#s17d-line-pulse-t2');
  var linePulseSpw  = slide.querySelector('#s17d-line-pulse-spawn');
  var tagLLM1       = slide.querySelector('#s17d-tag-llm-1');
  var tagLLM2       = slide.querySelector('#s17d-tag-llm-2');
  var tagConflict   = slide.querySelector('#s17d-tag-conflict');
  var calloutOk     = slide.querySelector('#s17d-callout-correct');
  var calloutBad    = slide.querySelector('#s17d-callout-wrong');
  var codeToggle    = slide.querySelector('#s17d-code-toggle');
  var codeBlock     = slide.querySelector('#s17d-code-block');

  /* ── 状态切换：只 toggle class，不重建 DOM // ←FM-2 ── */
  function applyMode (mode) {
    state.mode = mode;

    /* 按钮 active class */
    if (btnCorrect) btnCorrect.classList.toggle('active', mode === 'correct');
    if (btnWrong)   btnWrong.classList.toggle('active',   mode === 'wrong');

    /* 时序图节点显隐 */
    if (spawnCorrect) spawnCorrect.classList.toggle('visible', mode === 'correct');
    if (spawnWrong)   spawnWrong.classList.toggle('visible',   mode === 'wrong');

    /* correct 路径箭头：错误模式淡化 */
    if (arrowCorrect) {
      arrowCorrect.style.opacity = (mode === 'correct') ? '1' : '0.25';
    }

    /* mid-tool 错位脉冲线 + 警示标签 */
    [lineT2Spawn, linePulseT2, linePulseSpw].forEach(function (el) {
      if (el) el.classList.toggle('visible', mode === 'wrong');
    });
    [tagLLM1, tagLLM2, tagConflict].forEach(function (el) {
      if (el) el.classList.toggle('visible', mode === 'wrong');
    });

    /* 底部 callout 互斥显示 */
    if (calloutOk)  calloutOk.classList.toggle('visible',  mode === 'correct');
    if (calloutBad) calloutBad.classList.toggle('visible', mode === 'wrong');
  }

  /* ── 按钮 click ── */
  function onClickCorrect () { if (state.mode !== 'correct') applyMode('correct'); }
  function onClickWrong   () { if (state.mode !== 'wrong')   applyMode('wrong');   }
  if (btnCorrect) btnCorrect.addEventListener('click', onClickCorrect);
  if (btnWrong)   btnWrong.addEventListener('click',   onClickWrong);

  /* ── 折叠源码 click ── */
  function onClickCode () {
    if (!codeBlock || !codeToggle) return;
    var expanded = codeToggle.classList.toggle('expanded');
    codeBlock.classList.toggle('visible', expanded);
    codeToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    /* 切换图标文字 */
    var icon = codeToggle.querySelector('.s17d-arrow-icon');
    /* icon transform 由 CSS 控制（.expanded { transform: rotate(90deg) }），文字保留 ▶ */
  }
  if (codeToggle) codeToggle.addEventListener('click', onClickCode);

  /* ── 键盘快捷切换：T = turn-end (correct), M = mid-tool (wrong) ── */
  function handleKey (e) {
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); onClickCorrect(); }
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); onClickWrong();   }
  }
  document.addEventListener('keydown', handleKey);

  /* ── 入场：延迟 80ms 应用默认 mode（等 slide visible）── */
  timerIds.push(setTimeout(function () {  // ←FM-3
    applyMode(state.mode);
  }, 80));

  /* ── cleanup // ←FM-3 ── */
  return function cleanup () {
    timerIds.forEach(clearTimeout);
    timerIds.length = 0;
    if (btnCorrect) btnCorrect.removeEventListener('click', onClickCorrect);
    if (btnWrong)   btnWrong.removeEventListener('click',   onClickWrong);
    if (codeToggle) codeToggle.removeEventListener('click', onClickCode);
    document.removeEventListener('keydown', handleKey);
    /* 重置视觉状态：回到 correct 默认 */
    if (spawnCorrect) spawnCorrect.classList.add('visible');
    if (spawnWrong)   spawnWrong.classList.remove('visible');
    [lineT2Spawn, linePulseT2, linePulseSpw, tagLLM1, tagLLM2, tagConflict].forEach(function (el) {
      if (el) el.classList.remove('visible');
    });
    if (calloutOk)  calloutOk.classList.add('visible');
    if (calloutBad) calloutBad.classList.remove('visible');
    if (codeBlock)  codeBlock.classList.remove('visible');
    if (codeToggle) {
      codeToggle.classList.remove('expanded');
      codeToggle.setAttribute('aria-expanded', 'false');
    }
    if (arrowCorrect) arrowCorrect.style.opacity = '';
    state = {};
  };
};


/* =====================================================================
   S22 · Nudge 完整运行交互动画（🔴🔴 灵魂页 · 5 阶段连续动画）
   左半幕 chat dialog（user → 5 tool call → agent final → notify）
   右半幕 stage（双计数器 + spawn_review pill + fork shields + reflect + pipeline + tree）
   状态机：phase ∈ {idle | accumulating | threshold | forking | reflecting | committing | done}
   FM 清单：
     ←FM-1: 入口 fullReset() 重置 .lit / .active / .show / 计数器归 0 / 进度条归 0
     ←FM-2: timerIds 统一数组，cleanup 一次性 clearTimeout + removeEventListener
     ←FM-3: runToken 隔离，暂停/重置/slider 切换时自增 token，所有 in-flight timer 失效
   ===================================================================== */
window.slideHooks['slides/S22-nudge-full-animation.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S22"]');
  if (!slide) return function noop () {};   // ←FM-1: noop cleanup 防 DOM 缺失早退

  /* ── prefers-reduced-motion 兜底：直接跳到终态 ── */
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    slide.querySelectorAll('.s22f-msg-user, .s22f-msg-agent').forEach(function (el) { el.style.opacity = '1'; });
    slide.querySelectorAll('.s22f-tool-call').forEach(function (el) { el.classList.add('lit'); });
    slide.querySelectorAll('.s22f-shield').forEach(function (el) { el.classList.add('lit'); });
    slide.querySelectorAll('.s22f-pstep').forEach(function (el) { el.classList.add('lit'); });
    slide.querySelectorAll('.s22f-pseg').forEach(function (el) { el.classList.add('done'); });
    var rRef = slide.querySelector('#s22f-reflect');     if (rRef) rRef.classList.add('show');
    var rNot = slide.querySelector('#s22f-notify');      if (rNot) rNot.classList.add('show');
    var rFc  = slide.querySelector('#s22f-fork-card');   if (rFc)  rFc.classList.add('active');
    var rPp  = slide.querySelector('#s22f-path-patch');  if (rPp)  rPp.classList.add('chosen');
    var rPc  = slide.querySelector('#s22f-path-create'); if (rPc)  rPc.classList.add('dimmed');
    var rTr  = slide.querySelector('#s22f-tree-new');    if (rTr)  rTr.classList.add('lit');
    return function noop () {};
  }

  /* ────────── DOM 引用 ────────── */
  var msgUser     = slide.querySelector('#s22f-msg-user');
  var msgAgent    = slide.querySelector('#s22f-msg-agent');
  var msgFinal    = slide.querySelector('#s22f-msg-final');
  var bubbleAgent = slide.querySelector('#s22f-bubble-agent');
  var notify      = slide.querySelector('#s22f-notify');
  var toolCalls   = [1,2,3,4,5].map(function (i) { return slide.querySelector('#s22f-tool-' + i); });
  var psegs       = [1,2,3,4,5].map(function (i) { return slide.querySelector('#s22f-pseg-' + i); });
  var phaseName   = slide.querySelector('#s22f-phase-name');
  var phaseTip    = slide.querySelector('#s22f-phase-tip');
  var cntMemEl    = slide.querySelector('#s22f-cnt-mem-val');
  var cntSkillEl  = slide.querySelector('#s22f-cnt-skill-val');
  var cntSkillBox = slide.querySelector('#s22f-cnt-skill');
  var cntSkillThr = slide.querySelector('#s22f-cnt-skill-thr');
  var spawnPill   = slide.querySelector('#s22f-spawn-pill');
  var forkCard    = slide.querySelector('#s22f-fork-card');
  var shields     = [1,2,3,4].map(function (i) { return slide.querySelector('#s22f-shield-' + i); });
  var reflectBox  = slide.querySelector('#s22f-reflect');
  var pathPatch   = slide.querySelector('#s22f-path-patch');
  var pathCreate  = slide.querySelector('#s22f-path-create');
  var psteps      = [1,2,3,4,5].map(function (i) { return slide.querySelector('#s22f-pstep-' + i); });
  var treeNew     = slide.querySelector('#s22f-tree-new');
  var btnPlay     = slide.querySelector('#s22f-btn-play');
  var btnPause    = slide.querySelector('#s22f-btn-pause');
  var btnStep     = slide.querySelector('#s22f-btn-step');
  var btnReset    = slide.querySelector('#s22f-btn-reset');
  var slider      = slide.querySelector('#s22f-slider');
  var statePill   = slide.querySelector('#s22f-state-pill');

  /* ────────── 状态 ────────── ←FM-2 / FM-3 */
  var state = {
    timerIds: [],          /* ←FM-2: 统一 timer 数组 */
    phase: 'idle',         /* idle | accumulating | threshold | forking | reflecting | committing | done */
    phaseIdx: 0,           /* 0..5 → 0=idle 1..5=阶段 1..5 */
    cntMem: 0,
    cntSkill: 0,
    nudgeInterval: 10,     /* slider 当前值 */
    runToken: 0            /* ←FM-3: 暂停/重置/slider 切换时自增 */
  };

  /* ────────── helper ────────── */
  function addTimer (fn, delay) {        /* ←FM-2: 所有 setTimeout 经此入口 */
    var id = setTimeout(fn, delay);
    state.timerIds.push(id);
    return id;
  }
  function clearAllTimers () {            /* ←FM-2: 一次性清 */
    state.timerIds.forEach(clearTimeout);
    state.timerIds = [];
  }
  function setStatePill (label, cls) {
    if (!statePill) return;
    statePill.textContent = label;
    statePill.classList.remove('playing', 'paused', 'done');
    if (cls) statePill.classList.add(cls);
  }
  function setPhaseLabel (name, tip) {
    if (phaseName) phaseName.textContent = name;
    if (phaseTip)  phaseTip.textContent  = tip || '';
  }
  function bumpEl (el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* ────────── 入口完整重置 ────────── ←FM-1 */
  function fullReset () {
    clearAllTimers();
    state.runToken += 1;                  /* ←FM-3: 让所有旧 in-flight timer 失效 */
    state.phase = 'idle';
    state.phaseIdx = 0;
    state.cntMem = 0;
    state.cntSkill = 0;

    /* 视觉重置 */
    if (msgUser)  msgUser.style.opacity  = '0';
    if (msgAgent) msgAgent.style.opacity = '0';
    if (msgFinal) msgFinal.style.opacity = '0';
    if (bubbleAgent) bubbleAgent.classList.remove('dim');
    if (notify) notify.classList.remove('show');

    toolCalls.forEach(function (n) { if (n) n.classList.remove('lit'); });
    psegs.forEach(function (p) { if (p) p.classList.remove('done', 'active'); });

    if (cntMemEl)   { cntMemEl.textContent   = '0'; cntMemEl.classList.remove('bump'); }
    if (cntSkillEl) { cntSkillEl.textContent = '0'; cntSkillEl.classList.remove('bump'); }
    if (cntSkillBox) cntSkillBox.classList.remove('threshold-hit');
    if (spawnPill) spawnPill.classList.remove('show');

    if (forkCard) forkCard.classList.remove('active');
    shields.forEach(function (s) { if (s) s.classList.remove('lit'); });
    if (reflectBox) reflectBox.classList.remove('show');
    if (pathPatch)  pathPatch.classList.remove('chosen');
    if (pathCreate) pathCreate.classList.remove('chosen', 'dimmed');

    psteps.forEach(function (p) { if (p) p.classList.remove('lit'); });
    if (treeNew) treeNew.classList.remove('lit');

    setStatePill('idle', null);
    setPhaseLabel('idle', '点击 ▶ 播放');
  }

  /* ────────── 阶段进度推进 ────────── */
  function setPhase (idx, name, tip) {
    state.phaseIdx = idx;
    state.phase = name;
    setPhaseLabel(name, tip || '');
    /* 已完成阶段 done，当前阶段 active */
    psegs.forEach(function (p, i) {
      if (!p) return;
      p.classList.remove('done', 'active');
      if (i + 1 < idx) p.classList.add('done');
      else if (i + 1 === idx) p.classList.add('active');
    });
  }
  function markPhaseDone (idx) {
    var p = psegs[idx - 1];
    if (p) { p.classList.remove('active'); p.classList.add('done'); }
  }

  /* ════════════════════════════════════════════
     5 阶段动画时序（基于 nudge_interval=10 的标准节奏）
     ① accumulating  0  →  15s  · 5 tool call 累加 + skill 计数 +5
     ② threshold    15  →  22s  · 计数=10 阈值穿透 + agent final
     ③ forking      22  →  30s  · fork 卡片 + 4 重约束盾牌依次亮
     ④ reflecting   30  →  38s  · reflection prompt + PATCH/CREATE 决定
     ⑤ committing   38  →  45s  · 5 步校验流水线 + SKILL.md 落盘 + notify
     总长 ~45s
     ════════════════════════════════════════════ */

  /* ── 阶段 ① 累加（0–15s）── */
  function runPhase1 (token) {
    if (token !== state.runToken) return;
    setPhase(1, 'accumulating', '① 累加：user-turn 内 5 tool call 触发 skill +5');

    /* 0.3s: user 气泡入场 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (msgUser) {
        msgUser.style.transition = 'opacity 0.4s ease';
        msgUser.style.opacity = '1';
      }
    }, 300);

    /* 1.0s: agent 主气泡入场 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (msgAgent) {
        msgAgent.style.transition = 'opacity 0.4s ease';
        msgAgent.style.opacity = '1';
      }
    }, 1000);

    /* 5 tool call 依次点亮，间隔 ~2.4s（覆盖到 t≈14.5s）*/
    var TOOL_START = 2200;
    var TOOL_GAP   = 2400;
    [0,1,2,3,4].forEach(function (i) {
      addTimer(function () {
        if (token !== state.runToken) return;
        var node = toolCalls[i];
        if (node) node.classList.add('lit');
        /* skill +1 + bump */
        state.cntSkill += 1;
        if (cntSkillEl) {
          cntSkillEl.textContent = String(Math.min(state.cntSkill, 10));
          bumpEl(cntSkillEl);
        }
      }, TOOL_START + i * TOOL_GAP);
    });

    /* 阶段 ① 完成 → 触发 ② */
    addTimer(function () {
      if (token !== state.runToken) return;
      markPhaseDone(1);
      runPhase2(token);
    }, 15000);
  }

  /* ── 阶段 ② 判定（15–22s）── */
  function runPhase2 (token) {
    if (token !== state.runToken) return;
    setPhase(2, 'threshold', '② 判定：计数=阈值，spawn_review 触发');

    /* 0.2s: agent final response */
    addTimer(function () {
      if (token !== state.runToken) return;
      /* memory +1（user-turn 结束）*/
      state.cntMem += 1;
      if (cntMemEl) {
        cntMemEl.textContent = String(state.cntMem);
        bumpEl(cntMemEl);
      }
      if (msgFinal) {
        msgFinal.style.transition = 'opacity 0.4s ease';
        msgFinal.style.opacity = '1';
      }
    }, 200);

    /* 1.2s: 计数器框闪光 + spawn_review pill 弹出 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (cntSkillBox) {
        cntSkillBox.classList.remove('threshold-hit');
        void cntSkillBox.offsetWidth;
        cntSkillBox.classList.add('threshold-hit');
      }
      if (spawnPill) {
        spawnPill.classList.remove('show');
        void spawnPill.offsetWidth;
        spawnPill.classList.add('show');
      }
    }, 1200);

    /* 阶段 ② 完成 → 触发 ③ */
    addTimer(function () {
      if (token !== state.runToken) return;
      markPhaseDone(2);
      runPhase3(token);
    }, 7000);
  }

  /* ── 阶段 ③ Fork（22–30s）── */
  function runPhase3 (token) {
    if (token !== state.runToken) return;
    setPhase(3, 'forking', '③ Fork：子 agent 弹出 + 4 重约束盾牌依次亮');

    /* 主对话淡 50% */
    if (bubbleAgent) bubbleAgent.classList.add('dim');

    /* 0.3s: fork 卡片入场 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (forkCard) forkCard.classList.add('active');
    }, 300);

    /* 4 重约束盾牌依次亮（间隔 1.4s，覆盖 t=1.5s..5.7s）*/
    [0,1,2,3].forEach(function (i) {
      addTimer(function () {
        if (token !== state.runToken) return;
        var sh = shields[i];
        if (sh) sh.classList.add('lit');
      }, 1500 + i * 1400);
    });

    /* 阶段 ③ 完成 → 触发 ④ */
    addTimer(function () {
      if (token !== state.runToken) return;
      markPhaseDone(3);
      runPhase4(token);
    }, 8000);
  }

  /* ── 阶段 ④ 反思（30–38s）── */
  function runPhase4 (token) {
    if (token !== state.runToken) return;
    setPhase(4, 'reflecting', '④ 反思：滚动 reflection prompt + 决定 PATCH 路径');

    /* 0.3s: reflect prompt 入场 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (reflectBox) reflectBox.classList.add('show');
    }, 300);

    /* 5.0s: 决定 PATCH 路径（amber 高亮）+ CREATE 路径变灰 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (pathPatch)  pathPatch.classList.add('chosen');
      if (pathCreate) pathCreate.classList.add('dimmed');
    }, 5000);

    /* 阶段 ④ 完成 → 触发 ⑤ */
    addTimer(function () {
      if (token !== state.runToken) return;
      markPhaseDone(4);
      runPhase5(token);
    }, 8000);
  }

  /* ── 阶段 ⑤ 落盘（38–45s）── */
  function runPhase5 (token) {
    if (token !== state.runToken) return;
    setPhase(5, 'committing', '⑤ 落盘：5 步校验 → SKILL.md 写入文件树');

    /* 5 步校验依次绿勾（间隔 0.8s，覆盖 t=0.3s..3.5s）*/
    [0,1,2,3,4].forEach(function (i) {
      addTimer(function () {
        if (token !== state.runToken) return;
        var p = psteps[i];
        if (p) p.classList.add('lit');
      }, 300 + i * 800);
    });

    /* 4.5s: SKILL.md 落盘到文件树 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (treeNew) treeNew.classList.add('lit');
    }, 4500);

    /* 5.5s: 后台通知 */
    addTimer(function () {
      if (token !== state.runToken) return;
      if (notify) notify.classList.add('show');
    }, 5500);

    /* 阶段 ⑤ 完成 → done */
    addTimer(function () {
      if (token !== state.runToken) return;
      markPhaseDone(5);
      state.phase = 'done';
      setStatePill('done', 'done');
      setPhaseLabel('done', '✓ 一次完整 nudge 周期已落盘');
      if (btnPlay) btnPlay.textContent = '▶ 重播';
    }, 7000);
  }

  /* ────────── 单步：跳到下一阶段开头 ────────── */
  function phaseAdvance () {
    /* 单步进入会强制 paused 当前节奏，用同步推进代替 */
    if (state.phase === 'playing' || state.timerIds.length > 0) {
      state.runToken += 1;     /* ←FM-3 失效 in-flight */
      clearAllTimers();
    }
    if (state.phase === 'done') return;
    var token = state.runToken;
    var nextIdx = state.phaseIdx + 1;
    if (nextIdx > 5) return;

    /* 推进进度条标记 */
    if (state.phaseIdx >= 1) markPhaseDone(state.phaseIdx);

    /* 强制设置 paused（不自动续）*/
    setStatePill('paused', 'paused');

    /* 跳到对应阶段并立即推进到该阶段终态（短时序）*/
    if (nextIdx === 1) {
      setPhase(1, 'accumulating', '① 累加（单步）');
      if (msgUser)  msgUser.style.opacity  = '1';
      if (msgAgent) msgAgent.style.opacity = '1';
      toolCalls.forEach(function (n) { if (n) n.classList.add('lit'); });
      state.cntSkill = 5;
      if (cntSkillEl) { cntSkillEl.textContent = '5'; bumpEl(cntSkillEl); }
    } else if (nextIdx === 2) {
      setPhase(2, 'threshold', '② 判定（单步）');
      state.cntSkill = 10;
      state.cntMem = 1;
      if (cntSkillEl) { cntSkillEl.textContent = '10'; bumpEl(cntSkillEl); }
      if (cntMemEl)   { cntMemEl.textContent   = '1';  bumpEl(cntMemEl);   }
      if (msgFinal) msgFinal.style.opacity = '1';
      if (cntSkillBox) { cntSkillBox.classList.remove('threshold-hit'); void cntSkillBox.offsetWidth; cntSkillBox.classList.add('threshold-hit'); }
      if (spawnPill)   { spawnPill.classList.remove('show');             void spawnPill.offsetWidth;   spawnPill.classList.add('show'); }
    } else if (nextIdx === 3) {
      setPhase(3, 'forking', '③ Fork（单步）');
      if (bubbleAgent) bubbleAgent.classList.add('dim');
      if (forkCard) forkCard.classList.add('active');
      shields.forEach(function (s) { if (s) s.classList.add('lit'); });
    } else if (nextIdx === 4) {
      setPhase(4, 'reflecting', '④ 反思（单步）');
      if (reflectBox) reflectBox.classList.add('show');
      if (pathPatch)  pathPatch.classList.add('chosen');
      if (pathCreate) pathCreate.classList.add('dimmed');
    } else if (nextIdx === 5) {
      setPhase(5, 'committing', '⑤ 落盘（单步）');
      psteps.forEach(function (p) { if (p) p.classList.add('lit'); });
      if (treeNew) treeNew.classList.add('lit');
      if (notify) notify.classList.add('show');
      addTimer(function () {
        markPhaseDone(5);
        state.phase = 'done';
        setStatePill('done', 'done');
        setPhaseLabel('done', '✓ 单步完成');
      }, 200);
    }
  }

  /* ────────── 状态机控制 ────────── */
  function startRun () {
    /* idle / paused / done 都先 fullReset 再起 */
    fullReset();
    state.phase = 'playing';
    setStatePill('playing', 'playing');
    if (btnPlay) btnPlay.textContent = '▶ 播放中';
    runPhase1(state.runToken);
  }
  function pauseRun () {
    if (state.phase === 'idle' || state.phase === 'done') return;
    state.runToken += 1;       /* ←FM-3: 让 in-flight timer 全部失效 */
    clearAllTimers();
    state.phase = 'paused';
    setStatePill('paused', 'paused');
    if (btnPlay) btnPlay.textContent = '▶ 继续';
  }
  function togglePlay () {
    if (state.phase === 'playing') {
      pauseRun();
    } else {
      /* idle / paused / done → 重新开始 */
      startRun();
    }
  }
  function resetAll () {
    fullReset();
    if (btnPlay) btnPlay.textContent = '▶ 播放';
  }
  function onSliderChange () {
    var v = parseInt(slider.value, 10);
    if (!isNaN(v)) state.nudgeInterval = v;
    if (cntSkillThr) cntSkillThr.textContent = String(v);
    /* slider 切换 → 强制 reset（重新跑一遍）*/
    state.runToken += 1;
    clearAllTimers();
    if (state.phase === 'playing' || state.phase === 'paused') {
      startRun();
    } else {
      resetAll();
    }
  }

  /* ────────── 事件绑定 ────────── */
  if (btnPlay)  btnPlay.addEventListener('click', togglePlay);
  if (btnPause) btnPause.addEventListener('click', pauseRun);
  if (btnStep)  btnStep.addEventListener('click', phaseAdvance);
  if (btnReset) btnReset.addEventListener('click', resetAll);
  if (slider)   slider.addEventListener('change', onSliderChange);

  /* 初始化：reset 到 idle 静态展示 */
  fullReset();

  /* ────────── cleanup ────────── ←FM-1 / FM-2 / FM-3 */
  return function cleanup () {
    state.runToken += 1;                                /* ←FM-3 */
    clearAllTimers();                                   /* ←FM-2 */
    if (btnPlay)  btnPlay.removeEventListener('click', togglePlay);
    if (btnPause) btnPause.removeEventListener('click', pauseRun);
    if (btnStep)  btnStep.removeEventListener('click', phaseAdvance);
    if (btnReset) btnReset.removeEventListener('click', resetAll);
    if (slider)   slider.removeEventListener('change', onSliderChange);
    /* 视觉重置（防止 re-enter 时还停留在旧状态）*/
    if (cntMemEl)   cntMemEl.textContent   = '0';
    if (cntSkillEl) cntSkillEl.textContent = '0';
    if (msgUser)  msgUser.style.opacity  = '0';
    if (msgAgent) msgAgent.style.opacity = '0';
    if (msgFinal) msgFinal.style.opacity = '0';
    if (notify)   notify.classList.remove('show');
    if (forkCard) forkCard.classList.remove('active');
    if (reflectBox) reflectBox.classList.remove('show');
    if (spawnPill)  spawnPill.classList.remove('show');
    state = {};
  };
};


/* ═══════════════════════════════════════════════════════════════════════
   S23 · 第三章过渡破题（chapter3-intro）
   三连击节点 stagger 点亮（350ms）+ 张力条 stroke-dashoffset 流动绘制
   + 三段式结论 pill 末尾出现
   ←FM-1: requestAnimationFrame 包路径长度计算防 0
   ←FM-2: 入口重置所有 .lit / .draw 防 re-enter 残影
   ←FM-3: timerIds 统一数组，cleanup 一次性 clearTimeout
   ═══════════════════════════════════════════════════════════════════════ */
window.slideHooks['slides/S23-chapter3-intro.html'] = function () {
  const slide = document.querySelector('[data-slide-id="S23"]');
  if (!slide) return function noop() {};

  const nodes = slide.querySelectorAll('.s23i-node');           // 3 个
  const lines = slide.querySelectorAll('.s23i-tension-line');   // 3 条
  const pill  = slide.querySelector('#s23i-pill');

  /* ── prefers-reduced-motion 检查：立即显示终态，跳过动画调度 ── */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    nodes.forEach(n => n.classList.add('lit'));
    lines.forEach(l => {
      l.style.strokeDasharray = '';
      l.style.strokeDashoffset = '0';
    });
    if (pill) pill.classList.add('lit');
    return function noop() {};
  }

  /* ←FM-2: 入口先重置所有 .lit / .draw 防 re-enter 残影 */
  nodes.forEach(n => n.classList.remove('lit'));
  lines.forEach(l => {
    l.classList.remove('draw');
    l.style.transition = 'none';
    l.style.strokeDasharray = '';
    l.style.strokeDashoffset = '';
  });
  if (pill) pill.classList.remove('lit');

  /* ←FM-3: timerIds 统一数组，cleanup 一次性 clearTimeout */
  const timerIds = [];

  /* ←FM-1: requestAnimationFrame 包路径长度计算防 0
     SVG 在 layout 完成前 length 可能为 0，rAF 等下一帧再读 */
  requestAnimationFrame(() => {
    /* 用 line 的两端点直接算长度（比 getTotalLength 更稳）
       张力条 viewBox 600x22，preserveAspectRatio=none → 实际宽度按容器拉伸，
       但 dasharray 用 viewBox 单位即可，stroke-dashoffset 在 viewBox 坐标下生效 */
    lines.forEach(line => {
      const x1 = parseFloat(line.getAttribute('x1')) || 0;
      const y1 = parseFloat(line.getAttribute('y1')) || 0;
      const x2 = parseFloat(line.getAttribute('x2')) || 0;
      const y2 = parseFloat(line.getAttribute('y2')) || 0;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 600;
      line.style.strokeDasharray  = len + ' ' + len;
      line.style.strokeDashoffset = len;
      /* 强制 reflow 让初始态生效，再恢复 transition */
      // eslint-disable-next-line no-unused-expressions
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 0.5s ease-out';
    });

    /* ── stagger 调度 ── */
    const NODE_INTERVAL = 350;   // 节点间隔
    const LINE_DELAY    = 200;   // 张力条比节点延迟 200ms
    const LINE_DURATION = 500;   // 张力条流动时长（与 transition 一致）
    const PILL_DELAY    = 1200;  // 全部节点亮 + 张力条流完后，pill 延迟 1.2s 出现

    nodes.forEach((node, idx) => {
      const t = setTimeout(() => {
        node.classList.add('lit');
      }, idx * NODE_INTERVAL);
      timerIds.push(t);
    });

    lines.forEach((line, idx) => {
      /* 第 idx 条线在第 idx+1 节点亮后 LINE_DELAY 启动绘制 */
      const t = setTimeout(() => {
        line.classList.add('draw');
      }, idx * NODE_INTERVAL + LINE_DELAY);
      timerIds.push(t);
    });

    /* 3 节点全亮 + 最后一条线绘完后，pill 1.2s 后出现 */
    const pillAt = (nodes.length - 1) * NODE_INTERVAL + LINE_DELAY + LINE_DURATION + PILL_DELAY;
    const tp = setTimeout(() => {
      if (pill) pill.classList.add('lit');
    }, pillAt);
    timerIds.push(tp);
  });

  /* ═══════════════ cleanup ═══════════════ */
  return function cleanup() {
    /* ←FM-3: 清所有 setTimeout */
    timerIds.forEach(clearTimeout);
    timerIds.length = 0;
    /* 重置节点 / 张力条 / pill */
    nodes.forEach(n => n.classList.remove('lit'));
    lines.forEach(l => {
      l.classList.remove('draw');
      l.style.transition = 'none';
      l.style.strokeDasharray = '';
      l.style.strokeDashoffset = '';
    });
    if (pill) pill.classList.remove('lit');
  };
};


/* ═══════════════════════════════════════════════════════════════════════
   S29 · F5 三轴互动演示器 · 灵魂页（5 系统切换 + 对比模式 + 三轴坐标移动）
   Pattern: System State Machine + Coordinate Projection + 3D Visual Tracking
   State: { activeSystem, compareSystem, compareMode, runToken, timerIds[] }
   FM refs:
     ←FM-1: 入口 fullReset() 清所有 .active / .visible / 计数器，防 re-enter 残影
     ←FM-2: timerIds 统一数组 + cleanup 一次性 clearTimeout + removeEventListener
     ←FM-3: runToken 每次切换/toggle/reset 时自增，所有 in-flight transition 检查 token 失效
   ═══════════════════════════════════════════════════════════════════════ */
window.slideHooks['slides/S29-f5-three-axes-demo.html'] = function () {
  var slide = document.querySelector('[data-slide-id="S29"]');
  if (!slide) return function noop () {};   /* ←FM-1: noop cleanup 防 DOM 缺失早退 */

  /* ────────── 5 系统预设（基于 lesson 表 3-4 / 3-5 四维评价） ────────── */
  var positions = {
    hermes: {
      dyn: 0.85, trust: 0.70, dist: 0.75, ce: 0.80,
      color: '#d4a574', label: 'Hermes Agent',
      strong: '动态强（19 平台一致 + Nudge 自学）',
      sacrifice: '约束弱（仅 Docker user-space + 无 worktree）',
      tradeoff: 'Hermes 选择了强动态，代价是执行环境和入口权限更依赖信任与后续治理。'
    },
    claudeCode: {
      dyn: 0.50, trust: 0.30, dist: 0.20, ce: 0.50,
      color: '#7dd3c0', label: 'Claude Code',
      strong: '约束强（kernel sandbox-exec + per-subagent worktree）',
      sacrifice: '动态弱（仅单 IDE 入口，平台耦合）',
      tradeoff: 'Claude Code 选择了强约束，代价是只在单点 IDE 内深度，跨平台一致性放弃。'
    },
    deepagents: {
      dyn: 0.55, trust: 0.55, dist: 0.45, ce: 0.30,
      color: '#90c884', label: 'DeepAgents',
      strong: '机制完备（11 机制：planner / scratchpad / interrupt 等）',
      sacrifice: '默认无记忆 / 无 Nudge / 无 SkillForge',
      tradeoff: 'DeepAgents 是框架不是产品——给齐积木，自学习闭环要自己组装。'
    },
    openclaw: {
      dyn: 0.45, trust: 0.50, dist: 0.65, ce: 0.40,
      color: '#a8b3c4', label: 'OpenClaw',
      strong: '社区生态（ClawHub skill 市场 + 多模型适配）',
      sacrifice: 'skill 需手写 / 无 nudge 自动产出',
      tradeoff: 'OpenClaw 押注社区贡献，不押自学习闭环——靠生态而非靠机制赢。'
    },
    cursor: {
      dyn: 0.40, trust: 0.40, dist: 0.30, ce: 0.55,
      color: '#8a96a8', label: 'Cursor',
      strong: 'IDE 内体验流畅（diff / inline edit / chat）',
      sacrifice: '只在编辑器 / 跨平台一致性弱 / 无 harness 级机制',
      tradeoff: 'Cursor 把工程预算押在编辑器场景，不做通用 harness 的取舍。'
    }
  };

  /* ────────── 投影坐标系（与 SVG viewBox 一致） ────────── */
  var ORIGIN_X = 230, ORIGIN_Y = 280;
  /* X 轴单位向量: (200, 100)，对应 dyn 0→1 */
  /* Y 轴单位向量: (0, -240)，对应 trust 0→1 */
  /* Z 轴单位向量: (-170, -160)，对应 dist 0→1 */
  function project (p) {
    return {
      x: ORIGIN_X + 200 * p.dyn + (-170) * p.dist,
      y: ORIGIN_Y + 100 * p.dyn + (-240) * p.trust + (-160) * p.dist
    };
  }
  function projectX (dyn) { return { x: ORIGIN_X + 200 * dyn, y: ORIGIN_Y + 100 * dyn }; }
  function projectY (trust) { return { x: ORIGIN_X, y: ORIGIN_Y + (-240) * trust }; }
  function projectZ (dist) { return { x: ORIGIN_X + (-170) * dist, y: ORIGIN_Y + (-160) * dist }; }

  /* ────────── DOM 引用 ────────── */
  var sysBtns        = slide.querySelectorAll('.s29d-sys-btn');
  var dotPrimary     = slide.querySelector('#s29d-dot-primary');
  var dotPrimaryHalo = slide.querySelector('#s29d-dot-primary-halo');
  var dotPrimaryLbl  = slide.querySelector('#s29d-dot-primary-label');
  var dotCompare     = slide.querySelector('#s29d-dot-compare');
  var dotCompareLbl  = slide.querySelector('#s29d-dot-compare-label');
  var projXEl        = slide.querySelector('#s29d-proj-x');
  var projYEl        = slide.querySelector('#s29d-proj-y');
  var projZEl        = slide.querySelector('#s29d-proj-z');
  var compareLine    = slide.querySelector('#s29d-compare-line');
  var compareTag     = slide.querySelector('#s29d-compare-tag');
  var barDyn         = slide.querySelector('#s29d-bar-dyn');
  var barTrust       = slide.querySelector('#s29d-bar-trust');
  var barDist        = slide.querySelector('#s29d-bar-dist');
  var barCe          = slide.querySelector('#s29d-bar-ce');
  var valDyn         = slide.querySelector('#s29d-val-dyn');
  var valTrust       = slide.querySelector('#s29d-val-trust');
  var valDist        = slide.querySelector('#s29d-val-dist');
  var valCe          = slide.querySelector('#s29d-val-ce');
  var cardDyn        = slide.querySelector('#s29d-axis-card-dyn');
  var cardTrust      = slide.querySelector('#s29d-axis-card-trust');
  var cardDist       = slide.querySelector('#s29d-axis-card-dist');
  var cardCe         = slide.querySelector('#s29d-axis-card-ce');
  var tradeoffBox    = slide.querySelector('#s29d-tradeoff');
  var tradeoffSys    = slide.querySelector('#s29d-tradeoff-sys');
  var strongEl       = slide.querySelector('#s29d-strong');
  var sacrificeEl    = slide.querySelector('#s29d-sacrifice');
  var tradeoffTextEl = slide.querySelector('#s29d-tradeoff-text');
  var btnReset       = slide.querySelector('#s29d-btn-reset');
  var toggleEl       = slide.querySelector('#s29d-toggle-compare');
  var toggleText     = slide.querySelector('#s29d-toggle-text');
  var statePill      = slide.querySelector('#s29d-state-pill');

  /* ────────── 状态 ────────── ←FM-2 / FM-3 */
  var state = {
    timerIds: [],                /* ←FM-2: 统一 timer 数组 */
    activeSystem: 'hermes',      /* 当前主系统 */
    compareSystem: null,         /* 对比系统（compareMode ON 时第二次点击赋值）*/
    compareMode: false,          /* 对比模式 toggle */
    runToken: 0                  /* ←FM-3: 切换/toggle/reset 时自增 */
  };

  /* prefers-reduced-motion 兜底（CSS 已把 transition 关掉，这里仅控制 fading 跳过）*/
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ────────── helper ────────── */
  function addTimer (fn, delay) {        /* ←FM-2: 所有 setTimeout 经此入口 */
    var id = setTimeout(fn, delay);
    state.timerIds.push(id);
    return id;
  }
  function clearAllTimers () {           /* ←FM-2: 一次性清 */
    state.timerIds.forEach(clearTimeout);
    state.timerIds = [];
  }
  function fmt (v) { return v.toFixed(2); }
  function setCircleCenter (el, x, y) {
    if (!el) return;
    el.setAttribute('cx', x);
    el.setAttribute('cy', y);
  }
  function setTextPos (el, x, y) {
    if (!el) return;
    el.setAttribute('x', x);
    el.setAttribute('y', y);
  }
  function setLineEndpoints (el, x1, y1, x2, y2) {
    if (!el) return;
    el.setAttribute('x1', x1);
    el.setAttribute('y1', y1);
    el.setAttribute('x2', x2);
    el.setAttribute('y2', y2);
  }

  /* ────────── 应用主系统视觉 ────────── */
  function applyPrimary (key, token) {
    if (token !== state.runToken) return;       /* ←FM-3 */
    var p = positions[key];
    if (!p) return;
    var pos = project(p);

    /* SVG 圆点 + halo + label */
    setCircleCenter(dotPrimary, pos.x, pos.y);
    setCircleCenter(dotPrimaryHalo, pos.x, pos.y);
    setTextPos(dotPrimaryLbl, pos.x + 14, pos.y - 4);
    if (dotPrimary)     dotPrimary.setAttribute('fill', p.color);
    if (dotPrimaryHalo) dotPrimaryHalo.setAttribute('stroke', p.color);
    if (dotPrimaryLbl) {
      dotPrimaryLbl.setAttribute('fill', p.color);
      dotPrimaryLbl.textContent = p.label;
    }

    /* 投影虚线（X / Y / Z 三条到原点） */
    if (projXEl) {
      var px = projectX(p.dyn);
      setLineEndpoints(projXEl, pos.x, pos.y, px.x, px.y);
      projXEl.setAttribute('stroke', p.color);
    }
    if (projYEl) {
      var py = projectY(p.trust);
      setLineEndpoints(projYEl, pos.x, pos.y, py.x, py.y);
      projYEl.setAttribute('stroke', p.color);
    }
    if (projZEl) {
      var pz = projectZ(p.dist);
      setLineEndpoints(projZEl, pos.x, pos.y, pz.x, pz.y);
      projZEl.setAttribute('stroke', p.color);
    }

    /* 进度条 + 数值 */
    if (barDyn)   barDyn.style.width   = (p.dyn   * 100) + '%';
    if (barTrust) barTrust.style.width = (p.trust * 100) + '%';
    if (barDist)  barDist.style.width  = (p.dist  * 100) + '%';
    if (barCe)    barCe.style.width    = (p.ce    * 100) + '%';
    if (valDyn)   valDyn.textContent   = fmt(p.dyn);
    if (valTrust) valTrust.textContent = fmt(p.trust);
    if (valDist)  valDist.textContent  = fmt(p.dist);
    if (valCe)    valCe.textContent    = fmt(p.ce);
    if (barDyn)   barDyn.style.background   = p.color;
    if (barTrust) barTrust.style.background = p.color;
    if (barDist)  barDist.style.background  = p.color;
    if (barCe)    barCe.style.background    = p.color;
    if (valDyn)   valDyn.style.color   = p.color;
    if (valTrust) valTrust.style.color = p.color;
    if (valDist)  valDist.style.color  = p.color;
    if (valCe)    valCe.style.color    = p.color;
    if (cardDyn)   cardDyn.style.borderLeftColor   = p.color;
    if (cardTrust) cardTrust.style.borderLeftColor = p.color;
    if (cardDist)  cardDist.style.borderLeftColor  = p.color;
    if (cardCe)    cardCe.style.borderLeftColor    = p.color;

    /* 取舍卡淡入淡出 */
    if (tradeoffBox && !reducedMotion) {
      tradeoffBox.classList.add('fading');
      addTimer(function () {
        if (token !== state.runToken) return;        /* ←FM-3 */
        if (tradeoffSys) {
          tradeoffSys.textContent = p.label;
          tradeoffSys.style.color = p.color;
        }
        if (strongEl)       strongEl.textContent = p.strong;
        if (sacrificeEl)    sacrificeEl.textContent = p.sacrifice;
        if (tradeoffTextEl) tradeoffTextEl.textContent = p.tradeoff;
        tradeoffBox.classList.remove('fading');
      }, 220);
    } else {
      if (tradeoffSys) {
        tradeoffSys.textContent = p.label;
        tradeoffSys.style.color = p.color;
      }
      if (strongEl)       strongEl.textContent = p.strong;
      if (sacrificeEl)    sacrificeEl.textContent = p.sacrifice;
      if (tradeoffTextEl) tradeoffTextEl.textContent = p.tradeoff;
    }

    /* 系统按钮组 active / compare-pick 视觉 */
    sysBtns.forEach(function (btn) {
      var k = btn.getAttribute('data-system');
      btn.classList.remove('active', 'compare-pick');
      if (k === state.activeSystem) btn.classList.add('active');
      if (state.compareMode && k === state.compareSystem && k !== state.activeSystem) {
        btn.classList.add('compare-pick');
      }
    });
  }

  /* ────────── 应用对比系统（compareMode ON 时） ────────── */
  function applyCompare (key, token) {
    if (token !== state.runToken) return;       /* ←FM-3 */
    if (!key || !positions[key]) {
      hideCompare();
      return;
    }
    var p = positions[key];
    var pos = project(p);
    var primPos = project(positions[state.activeSystem]);

    setCircleCenter(dotCompare, pos.x, pos.y);
    setTextPos(dotCompareLbl, pos.x + 14, pos.y - 4);
    if (dotCompare)    dotCompare.setAttribute('fill', p.color);
    if (dotCompareLbl) {
      dotCompareLbl.setAttribute('fill', p.color);
      dotCompareLbl.textContent = p.label;
    }

    /* 配对连线 + 三轴距离 */
    setLineEndpoints(compareLine, primPos.x, primPos.y, pos.x, pos.y);
    var midX = (primPos.x + pos.x) / 2;
    var midY = (primPos.y + pos.y) / 2 - 8;
    setTextPos(compareTag, midX, midY);
    if (compareTag) {
      var pa = positions[state.activeSystem];
      var diffDyn   = Math.abs(pa.dyn   - p.dyn);
      var diffTrust = Math.abs(pa.trust - p.trust);
      var diffDist  = Math.abs(pa.dist  - p.dist);
      var dist3d = Math.sqrt(diffDyn*diffDyn + diffTrust*diffTrust + diffDist*diffDist);
      compareTag.textContent = '三轴距离 ' + dist3d.toFixed(2);
    }

    /* 显示 */
    if (dotCompare)    dotCompare.classList.add('visible');
    if (dotCompareLbl) dotCompareLbl.classList.add('visible');
    if (compareLine)   compareLine.classList.add('visible');
    if (compareTag)    compareTag.classList.add('visible');

    /* 系统按钮组 compare-pick 视觉 */
    sysBtns.forEach(function (btn) {
      var k = btn.getAttribute('data-system');
      btn.classList.remove('compare-pick');
      if (k === state.compareSystem && k !== state.activeSystem) {
        btn.classList.add('compare-pick');
      }
    });
  }

  function hideCompare () {
    if (dotCompare)    dotCompare.classList.remove('visible');
    if (dotCompareLbl) dotCompareLbl.classList.remove('visible');
    if (compareLine)   compareLine.classList.remove('visible');
    if (compareTag)    compareTag.classList.remove('visible');
    sysBtns.forEach(function (btn) { btn.classList.remove('compare-pick'); });
  }

  /* ────────── 入口完整重置 ────────── ←FM-1 */
  function fullReset () {
    clearAllTimers();
    state.runToken += 1;                 /* ←FM-3: 让所有旧 in-flight timer 失效 */
    state.activeSystem = 'hermes';
    state.compareSystem = null;
    state.compareMode = false;

    if (toggleEl)  { toggleEl.classList.remove('on'); toggleEl.setAttribute('aria-pressed', 'false'); }
    if (toggleText) toggleText.textContent = 'OFF';
    if (statePill) { statePill.textContent = '单视图'; statePill.classList.remove('compare'); }

    hideCompare();
    applyPrimary('hermes', state.runToken);
  }

  /* ────────── 系统按钮点击 ────────── */
  function onSysBtnClick (e) {
    var btn = e.currentTarget;
    var key = btn.getAttribute('data-system');
    if (!key || !positions[key]) return;

    state.runToken += 1;             /* ←FM-3 */
    var token = state.runToken;
    clearAllTimers();

    if (state.compareMode) {
      /* 对比模式：第一次点击新系统 → 设为 compareSystem；点 active 自身 → no-op */
      if (key === state.activeSystem) return;
      state.compareSystem = key;
      applyCompare(key, token);
      applyPrimary(state.activeSystem, token);
    } else {
      /* 单视图模式：切主系统 + 不显示对比 */
      state.activeSystem = key;
      state.compareSystem = null;
      hideCompare();
      applyPrimary(key, token);
    }
  }

  /* ────────── 对比 toggle 点击 ────────── */
  function onToggleClick () {
    state.runToken += 1;             /* ←FM-3 */
    var token = state.runToken;
    clearAllTimers();

    state.compareMode = !state.compareMode;
    if (state.compareMode) {
      if (toggleEl)  { toggleEl.classList.add('on'); toggleEl.setAttribute('aria-pressed', 'true'); }
      if (toggleText) toggleText.textContent = 'ON';
      if (statePill) { statePill.textContent = '对比模式'; statePill.classList.add('compare'); }
      /* 默认对比 = 与 active 最对立的系统 */
      if (!state.compareSystem || state.compareSystem === state.activeSystem) {
        state.compareSystem = (state.activeSystem === 'claudeCode') ? 'hermes' : 'claudeCode';
      }
      applyCompare(state.compareSystem, token);
    } else {
      if (toggleEl)  { toggleEl.classList.remove('on'); toggleEl.setAttribute('aria-pressed', 'false'); }
      if (toggleText) toggleText.textContent = 'OFF';
      if (statePill) { statePill.textContent = '单视图'; statePill.classList.remove('compare'); }
      state.compareSystem = null;
      hideCompare();
    }
    applyPrimary(state.activeSystem, token);
  }

  function onToggleKeydown (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleClick();
    }
  }

  /* ────────── 重置按钮 ────────── */
  function onResetClick () {
    fullReset();
  }

  /* ────────── 事件绑定 ────────── */
  sysBtns.forEach(function (btn) { btn.addEventListener('click', onSysBtnClick); });
  if (toggleEl) {
    toggleEl.addEventListener('click', onToggleClick);
    toggleEl.addEventListener('keydown', onToggleKeydown);
  }
  if (btnReset) btnReset.addEventListener('click', onResetClick);

  /* 初始化：默认 Hermes 单视图 */
  fullReset();

  /* ────────── cleanup ────────── ←FM-1 / FM-2 / FM-3 */
  return function cleanup () {
    state.runToken += 1;                                /* ←FM-3 */
    clearAllTimers();                                   /* ←FM-2 */
    sysBtns.forEach(function (btn) { btn.removeEventListener('click', onSysBtnClick); });
    if (toggleEl) {
      toggleEl.removeEventListener('click', onToggleClick);
      toggleEl.removeEventListener('keydown', onToggleKeydown);
    }
    if (btnReset) btnReset.removeEventListener('click', onResetClick);
    hideCompare();
    if (toggleEl)  toggleEl.classList.remove('on');
    if (statePill) statePill.classList.remove('compare');
    state = {};
  };
};
