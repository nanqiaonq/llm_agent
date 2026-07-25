/**
 * Harness Engineering L4 · Architect Blueprint
 * js/main.js — 导航框架 + 工具栏逻辑
 * 版本：v1（骨架层，不含 slide 内容）
 *
 * 架构规范：
 *   - slideHooks 由 interactive.js 注册，main.js 调用
 *   - 画笔拖尾：FADE_MS=1200，_pen.trails[] + animatePenTrail()（参照 REF golden patterns §1）
 *   - 画板 toggle：再按 D 先 clearDrawBoard() 再 drawBoardEnabled=false（清后退）
 *   - ESC 键同样走清后退路径
 */

(function () {
  'use strict';

  /* ===== slideFiles：与 slide_structure.json slides[].file 完全一致 ===== */
      var slideFiles = [
    'slides/S01-cover.html',
    'slides/S02-singularity-moment.html',
    'slides/S03-harness-engineering-consensus.html',
    'slides/S04-hermes-agent-overview.html',
    'slides/S05-hermes-vs-openclaw.html',
    'slides/S06-chapter1-intro.html',
    'slides/S07-memory-architecture.html',
    'slides/S08-hot-memory-load.html',
    'slides/S09-sqlite-persistence.html',
    'slides/S10-fts5-dual-index.html',
    'slides/S11-llm-summary.html',
    'slides/S12-full-cycle.html',
    'slides/S13-memory-providers.html',
    'slides/S14-chapter2-intro.html',
    'slides/S15-skill-four-sources.html',
    'slides/S16-dual-counter.html',
    'slides/S17-decision-timing.html',
    'slides/S18-fork-4-constraints.html',
    'slides/S19-prompt-reflection.html',
    'slides/S20-skill-commit.html',
    'slides/S21-mvp-demo.html',
    'slides/S22-nudge-full-animation.html',
    'slides/S23-chapter3-intro.html',
    'slides/S24-f5-three-axes.html',
    'slides/S25-dynamic-axis-scatter.html',
    'slides/S26-constraint-matrix.html',
    'slides/S27-acp-dual-entry.html',
    'slides/S28-f5-table.html',
    'slides/S29-f5-three-axes-demo.html',
    'slides/S30-f5-keyword-mapping.html',
    'slides/S31-takeaways.html',
    'slides/S32-next-hook.html',
    'slides/S33-honest-statement.html'
  ];

  /* ===== slideTitles：与 slide_structure.json slides[].title 完全一致 ===== */
      var slideTitles = [
    '课程封面 · 第四节系列时间轴定位',
    '智能体奇点时刻 · 2026 数据冲击',
    'Harness Engineering · 三方共识 + 工具谱系',
    'Hermes Agent · 集大成者全景（灵魂页）',
    'Hermes vs OpenClaw · 同源不同路',
    '第一章 · 记忆系统（过渡页）',
    'DeepAgents 记忆三大断裂点',
    '热记忆双层 · 加载动画',
    '冷记忆① SQLite 持久化',
    '冷记忆② FTS5 双索引（unicode61 + trigram）',
    '冷记忆③ LLM 摘要层',
    '完整周期 · 沉浸式对话框（灵魂页）',
    '扩展层 · 8 种外部 Memory Provider（opt-in / 详见 L5）',
    '第二章 · Nudge 机制（过渡页）',
    'Skill 四来源对比 · agent-created 破题',
    '双计数器灵魂页 · user-turn vs tool-iter 涨速差 5×',
    '判定时机 · turn-end vs mid-tool',
    'Fork 4 重约束 · 防递归是核心防线',
    'Prompt 驱动反思：PATCH > CREATE + ACTIVE 倾向',
    '落盘 5 步校验 + 无 Consent 禁用配置',
    'MVP Demo 架构图 · langchain 三件套',
    'Nudge 完整运行交互动画（灵魂页）',
    '第三章 · F5 取舍分析（过渡页）',
    'F5 三轴定义（白话）· 三个工程问题的代号',
    '动态轴：19 platform × 8 backend 散点定位图',
    '约束轴四维度矩阵 vs Claude Code（灵魂页）',
    '分治轴：ACP 双入口认证不一致',
    'F5 综合定位：Hermes 选了什么放弃什么',
    'F5 三轴互动演示器（灵魂页）· 5 系统对比',
    'F5 ↔ 前三节关键词映射表',
    '学员带走 4 件产物',
    '第五节悬念钩子 + 课后作业',
    '诚实声明 · GEPA + 四层记忆边界'
  ];

  /* ===== 章节结构（对应 slide_structure.json chapters）===== */
      var chapters = [
    { title: '第0章：开场角色声明 + 衔接前置课程', start: 0,  end: 4  },
    { title: '第1章：记忆系统——热/冷分离三段式架构', start: 5,  end: 12 },
    { title: '第2章：Nudge 机制——Skill 的自动生产', start: 13, end: 21 },
    { title: '第3章：F5 取舍分析——三对张力评价框架', start: 22, end: 29 },
    { title: '第4章：收束与收尾',                    start: 30, end: 32 }
  ];

  /* ===== 状态变量 ===== */
  var totalSlides     = slideFiles.length;
  var currentIndex    = 0;
  var slideCache      = {};
  var currentCleanup  = null;
  var menuOpen        = false;
  var drawBoardEnabled = false;
  var drawCtx         = null;
  var isDrawing       = false;
  var currentDrawColor = '#d4a574'; /* 默认琥珀色 */
  var colorPickerOpen = false;

  /* ===== loadSlide：fetch + 缓存 ===== */
  async function loadSlide(n) {
    if (n < 0 || n >= totalSlides) return;

    /* 执行上页 cleanup */
    if (typeof currentCleanup === 'function') {
      try { currentCleanup(); } catch (e) { /* ignore */ }
    }
    currentCleanup = null;
    window._slideCleanup = null;

    currentIndex = n;
    updateProgressBar();
    updatePageIndicator();
    updateMenuActiveState();
    updateHash();

    var file = slideFiles[n];
    var html;

    if (slideCache[file]) {
      html = slideCache[file];
    } else {
      try {
        var resp = await fetch(file);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        html = await resp.text();
        slideCache[file] = html;
      } catch (e) {
        html = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-family:var(--font-mono);font-size:0.9rem;">无法加载 ' + file + '</div>';
        slideCache[file] = html;
      }
    }

    var viewport = document.getElementById('slide-viewport');
    viewport.innerHTML = '<div class="slide">' + html + '</div>';

    /* 手动重新创建 <script> 标签（innerHTML 注入的 script 不自动执行）*/
    var scripts = viewport.querySelectorAll('script');
    scripts.forEach(function(oldScript) {
      var newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src = oldScript.src;
        newScript.async = false;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    /* slideHooks 注册（来自 interactive.js）*/
    /* 延迟 ≤10ms，避免内容填充前空面板闪烁 */
    var hookFn = window.slideHooks && window.slideHooks[file];
    if (typeof hookFn === 'function') {
      setTimeout(function() {
        try {
          var cleanup = hookFn();
          if (typeof cleanup === 'function') {
            currentCleanup = cleanup;
            window._slideCleanup = cleanup;
          }
        } catch (e) {
          console.warn('[main.js] slideHook error for', file, e);
        }
      }, 8);
    }

    /* animate-ready 入场动画 */
    setTimeout(function() {
      var els = document.querySelectorAll('.animate-ready');
      els.forEach(function(el) {
        var delay = parseFloat(el.getAttribute('data-delay') || '0');
        setTimeout(function() { el.classList.add('animated'); }, delay * 1000);
      });
    }, 8);

    /* 预加载前后页 */
    [n - 1, n + 1].forEach(function(i) {
      if (i >= 0 && i < totalSlides && !slideCache[slideFiles[i]]) {
        fetch(slideFiles[i]).then(function(r) { return r.ok ? r.text() : ''; }).then(function(t) {
          if (t) slideCache[slideFiles[i]] = t;
        }).catch(function() {});
      }
    });

    /* 翻页按钮状态 */
    var prev = document.getElementById('nav-prev');
    var next = document.getElementById('nav-next');
    if (prev) prev.disabled = n === 0;
    if (next) next.disabled = n === totalSlides - 1;
  }

  /* ===== 进度条 ===== */
  function updateProgressBar() {
    var pct = totalSlides > 1 ? (currentIndex / (totalSlides - 1)) * 100 : 100;
    var bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = Math.max(4, pct) + '%';
  }

  /* ===== 页码指示器 ===== */
  function updatePageIndicator() {
    var cur = document.getElementById('page-current');
    var tot = document.getElementById('page-total');
    if (cur) cur.textContent = currentIndex + 1;
    if (tot) tot.textContent = totalSlides;
  }

  /* ===== URL hash 同步 ===== */
  function updateHash() {
    history.replaceState(null, '', '#' + (currentIndex + 1));
  }

  function readHash() {
    var hash = location.hash.replace('#', '');
    var num = parseInt(hash, 10);
    if (num >= 1 && num <= totalSlides) return num - 1;
    return 0;
  }

  /* ===== 翻页 ===== */
  function prevSlide() { if (currentIndex > 0) loadSlide(currentIndex - 1); }
  function nextSlide() { if (currentIndex < totalSlides - 1) loadSlide(currentIndex + 1); }
  function goToSlide(n) { if (n >= 0 && n < totalSlides) loadSlide(n); }

  /* ===== 全屏 ===== */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  }

  /* ===== 菜单：buildMenu 目录分组铁律 ===== */
  function buildMenu() {
    var list = document.getElementById('menu-list');
    if (!list) return;
    list.innerHTML = '';

    chapters.forEach(function(ch) {
      /* 章节标题 */
      var chEl = document.createElement('div');
      chEl.className = 'menu-chapter';
      chEl.textContent = ch.title;
      list.appendChild(chEl);

      /* 该章节的 slide 条目 */
      for (var i = ch.start; i <= ch.end; i++) {
        (function(idx) {
          var item = document.createElement('div');
          item.className = 'menu-item';
          item.setAttribute('data-index', idx);
          /* 三件套：序号 + 标题（无 dot DOM）*/
          item.innerHTML =
            '<span class="menu-item-num">' + String(idx + 1).padStart(2, '0') + '</span>' +
            '<span>' + slideTitles[idx] + '</span>';
          item.onclick = function() { goToSlide(idx); closeMenu(); };
          list.appendChild(item);
        })(i);
      }
    });
  }

  function updateMenuActiveState() {
    var items = document.querySelectorAll('.menu-item');
    items.forEach(function(item) {
      var idx = parseInt(item.getAttribute('data-index'), 10);
      item.classList.toggle('active', idx === currentIndex);
    });
  }

  function toggleMenu() { menuOpen ? closeMenu() : openMenu(); }

  function openMenu() {
    menuOpen = true;
    var menu    = document.getElementById('side-menu');
    var overlay = document.getElementById('menu-overlay');
    if (menu)    menu.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    updateMenuActiveState();
  }

  function closeMenu() {
    menuOpen = false;
    var menu    = document.getElementById('side-menu');
    var overlay = document.getElementById('menu-overlay');
    if (menu)    menu.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
  }

  /* =================================================================
     画笔拖尾 (T)
     FADE_MS=1200 时间衰减模式；_pen.trails[] + animatePenTrail()
     参照 REF golden patterns §1
     ================================================================= */
  var _pen = {
    active:        false,
    canvas:        null,
    ctx:           null,
    drawing:       false,
    points:        [],
    trails:        [],
    rafId:         null,
    FADE_DURATION: 1200,
    LINE_WIDTH:    3
  };

  function initPenTrail() {
    var canvas = document.getElementById('pen-trail-canvas');
    if (!canvas) return;
    _pen.canvas = canvas;
    _pen.ctx    = canvas.getContext('2d');

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousedown', function(e) {
      _pen.drawing = true;
      _pen.points  = [{ x: e.clientX, y: e.clientY, t: Date.now() }];
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!_pen.drawing) return;
      _pen.points.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      penRender();
    });
    canvas.addEventListener('mouseup',    penUp);
    canvas.addEventListener('mouseleave', penUp);

    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var t = e.touches[0];
      _pen.drawing = true;
      _pen.points  = [{ x: t.clientX, y: t.clientY, t: Date.now() }];
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!_pen.drawing) return;
      var t = e.touches[0];
      _pen.points.push({ x: t.clientX, y: t.clientY, t: Date.now() });
      penRender();
    }, { passive: false });
    canvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      penUp();
    }, { passive: false });
  }

  function penUp() {
    if (!_pen.drawing) return;
    _pen.drawing = false;
    if (_pen.points.length > 1) {
      _pen.trails.push({ points: _pen.points.slice(), startTime: Date.now() });
    }
    _pen.points = [];
    if (_pen.active) animatePenTrail();
  }

  function penRender() {
    var ctx    = _pen.ctx;
    var canvas = _pen.canvas;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var now = Date.now();
    /* 清除已过期轨迹（时间衰减，非永久保留）*/
    _pen.trails = _pen.trails.filter(function(trail) {
      return now - trail.startTime < _pen.FADE_DURATION;
    });
    _pen.trails.forEach(function(trail) {
      var alpha = Math.max(0, 1 - (now - trail.startTime) / _pen.FADE_DURATION);
      penDrawPath(ctx, trail.points, alpha * 0.75);
    });
    if (_pen.points.length > 1) penDrawPath(ctx, _pen.points, 1);
  }

  function penDrawPath(ctx, points, alpha) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      var prev = points[i - 1];
      var curr = points[i];
      var mx = (prev.x + curr.x) / 2;
      var my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = hexToRgba(currentDrawColor, alpha);
    ctx.lineWidth   = _pen.LINE_WIDTH;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function togglePenTrail() {
    _pen.active = !_pen.active;
    var canvas = document.getElementById('pen-trail-canvas');
    var btn    = document.getElementById('btn-pen');
    if (_pen.active) {
      if (canvas) canvas.classList.add('pen-active');
      if (btn)    btn.classList.add('active');
      animatePenTrail();
    } else {
      if (canvas) canvas.classList.remove('pen-active');
      if (btn)    btn.classList.remove('active');
      if (_pen.rafId) cancelAnimationFrame(_pen.rafId);
      _pen.rafId = null;
      if (_pen.ctx && canvas) _pen.ctx.clearRect(0, 0, canvas.width, canvas.height);
      _pen.trails = [];
      _pen.points = [];
    }
  }

  function animatePenTrail() {
    if (!_pen.active) return;
    penRender();
    if (_pen.trails.length > 0 || _pen.drawing) {
      _pen.rafId = requestAnimationFrame(animatePenTrail);
    } else {
      _pen.rafId = null;
    }
  }

  /* =================================================================
     画板 (D)
     toggle 语义：再按 D 先 clearDrawBoard() 再 drawBoardEnabled=false
     ESC 键同样走清后退路径
     ================================================================= */
  function initDrawBoard() {
    var canvas = document.getElementById('draw-board-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    drawCtx       = canvas.getContext('2d');

    window.addEventListener('resize', function() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    canvas.addEventListener('mousedown', function(e) {
      if (!drawBoardEnabled) return;
      isDrawing = true;
      drawCtx.beginPath();
      drawCtx.moveTo(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;
      drawCtx.lineTo(e.clientX, e.clientY);
      drawCtx.strokeStyle = currentDrawColor;
      drawCtx.lineWidth   = 3;
      drawCtx.lineCap     = 'round';
      drawCtx.lineJoin    = 'round';
      drawCtx.stroke();
    });
    canvas.addEventListener('mouseup',    function() { isDrawing = false; });
    canvas.addEventListener('mouseleave', function() { isDrawing = false; });

    /* 触摸支持 */
    canvas.addEventListener('touchstart', function(e) {
      if (!drawBoardEnabled) return;
      e.preventDefault();
      var t = e.touches[0];
      isDrawing = true;
      drawCtx.beginPath();
      drawCtx.moveTo(t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      if (!isDrawing) return;
      e.preventDefault();
      var t = e.touches[0];
      drawCtx.lineTo(t.clientX, t.clientY);
      drawCtx.strokeStyle = currentDrawColor;
      drawCtx.lineWidth   = 3;
      drawCtx.lineCap     = 'round';
      drawCtx.stroke();
    }, { passive: false });
    canvas.addEventListener('touchend', function() { isDrawing = false; });
  }

  function toggleDrawBoard() {
    var canvas = document.getElementById('draw-board-canvas');
    var btn    = document.getElementById('btn-draw');
    if (drawBoardEnabled) {
      /* 清后退：先 clear 再关 */
      clearDrawBoard();
    } else {
      drawBoardEnabled = true;
      if (canvas) {
        canvas.style.pointerEvents = 'all';
        canvas.style.cursor        = 'crosshair';
      }
      document.body.classList.add('draw-mode');
      if (btn) btn.classList.add('active');
    }
  }

  function clearDrawBoard() {
    /* 清后退语义：先 clearRect，再关闭画板 */
    var canvas = document.getElementById('draw-board-canvas');
    if (canvas && drawCtx) {
      drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.pointerEvents = 'none';
      canvas.style.cursor        = 'default';
    }
    drawBoardEnabled = false;
    isDrawing        = false;
    document.body.classList.remove('draw-mode');
    var btn = document.getElementById('btn-draw');
    if (btn) btn.classList.remove('active');
  }

  /* ===== 颜色选择器（4 色，pen + board 共享 currentDrawColor）===== */
  function setDrawColor(hex) {
    currentDrawColor = hex;
    var dot = document.getElementById('color-dot-indicator');
    if (dot) dot.style.background = hex;
    document.querySelectorAll('#color-picker-popup .color-dot').forEach(function(btn) {
      btn.classList.toggle('selected', btn.dataset.color === hex);
    });
    closeColorPicker();
  }

  function toggleColorPicker() {
    colorPickerOpen = !colorPickerOpen;
    var popup = document.getElementById('color-picker-popup');
    if (popup) popup.classList.toggle('open', colorPickerOpen);
  }

  function closeColorPicker() {
    colorPickerOpen = false;
    var popup = document.getElementById('color-picker-popup');
    if (popup) popup.classList.remove('open');
  }

  /* ===== 键盘事件 ===== */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      /* 翻页 */
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        e.preventDefault();
        nextSlide();
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(0);
        break;
      case 'End':
        e.preventDefault();
        goToSlide(totalSlides - 1);
        break;
      /* ESC：画板清后退 → 画笔关 → 菜单关 */
      case 'Escape':
        if (drawBoardEnabled) { clearDrawBoard(); break; }
        if (_pen.active)      { togglePenTrail(); break; }
        if (menuOpen)         { closeMenu();      break; }
        goToSlide(0); /* 最终 fallback：返回封面 */
        break;
      /* 工具栏快捷键 */
      case 'f': case 'F':
        if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleFullscreen(); }
        break;
      case 'm': case 'M':
        if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleMenu(); }
        break;
      case 't': case 'T':
        togglePenTrail();
        break;
      case 'd': case 'D':
        toggleDrawBoard();
        break;
    }
  });

  /* ===== 触摸滑动 ===== */
  var touchStartX = 0;
  var touchStartY = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) nextSlide(); else prevSlide();
    }
  }, { passive: true });

  /* ===== 全局 API（供 index.html 的 onclick 绑定调用）===== */
  window.__nextSlide        = nextSlide;
  window.__prevSlide        = prevSlide;
  window.__goSlide          = function(i) { closeMenu(); goToSlide(i); };
  window.__toggleMenu       = toggleMenu;
  window.__closeMenu        = closeMenu;
  window.__toggleFullscreen = toggleFullscreen;
  window.__togglePenTrail   = togglePenTrail;
  window.__toggleDrawBoard  = toggleDrawBoard;
  window.__toggleColorPicker = toggleColorPicker;
  window.__setDrawColor     = setDrawColor;

  /* ===== 初始化 ===== */
  document.addEventListener('DOMContentLoaded', function() {
    buildMenu();
    initPenTrail();
    initDrawBoard();

    /* 初始化颜色指示器 */
    var dot = document.getElementById('color-dot-indicator');
    if (dot) dot.style.background = currentDrawColor;

    /* 点击外部关闭颜色选择器 */
    document.addEventListener('click', function(e) {
      if (colorPickerOpen && !e.target.closest('#color-picker-wrap')) {
        closeColorPicker();
      }
    });

    /* 菜单遮罩点击关闭 */
    var overlay = document.getElementById('menu-overlay');
    if (overlay) overlay.addEventListener('click', closeMenu);

    /* 从 hash 读取初始页码 */
    var startSlide = readHash();
    loadSlide(startSlide);
  });

})();
