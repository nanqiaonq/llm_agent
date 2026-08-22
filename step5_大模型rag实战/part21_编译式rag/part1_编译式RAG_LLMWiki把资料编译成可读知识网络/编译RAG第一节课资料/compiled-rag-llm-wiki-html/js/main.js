/**
 * main.js — 编译式 RAG：LLM Wiki 原理 课件主控制器
 * 负责：slide 导航、侧边菜单（分组）、画笔拖尾(T)、画板(D)、颜色选择器、快捷键
 *
 * 产物注释回引 REF_golden_patterns.md §一：
 *   §一.1 画笔拖尾：_pen.trails[] + animatePenTrail() + FADE_MS=1200
 *   §一.2 画板 toggle：clearDrawBoard() 清后退语义 + ESC 同路径
 *   §一.3 颜色选择器：currentDrawColor 共享 + 4 色
 *   §一.4 目录分组：chapters 数组 + buildMenu() 分组渲染
 *   §一.5 工具栏五件套：M/T/D/颜色/F 各有 onclick 显式绑定
 *   §一.T6b 三数组同步：slideFiles.length===21 && chapters[last].end===20
 */

(function () {
  'use strict';

  /* ===== §一.T6b 三数组：slideFiles / slideTitles / chapters（21页）===== */
  /* 顺序与 slide_structure.json slides[].file 完全一致 */
  var slideFiles = [
    'slides/S001-cover.html',
    'slides/S002-the-familiar-friction.html',
    'slides/T2-pain-intro.html',
    'slides/S003-answer-jitter.html',
    'slides/S004-stale-index.html',
    'slides/S005-common-root-cause.html',
    'slides/T3-metaphor-intro.html',
    'slides/S006-dual-track-simulator.html',
    'slides/S006b-interpret-mechanism.html',
    'slides/S006c-compile-mechanism.html',
    'slides/S007-cost-compounding-curve.html',
    'slides/S008-dspy-namesake-disambig.html',
    'slides/T4-skeleton-intro.html',
    'slides/S009-three-layer-ownership.html',
    'slides/S010-compile-grows-wiki.html',
    'slides/S011-two-special-files.html',
    'slides/S012-three-ops-readwrite.html',
    'slides/T5-boundary-intro.html',
    'slides/S013-21x-cost-tension.html',
    'slides/S014-four-paradigm-selection.html',
    'slides/S015-mind-map-summary.html'
  ]; /* length === 21 */

  var slideTitles = [
    '编译式 RAG：LLM Wiki 原理',
    '你大概率见过的别扭',
    '第二章 · 机器索引 vs 可读 wiki',
    '答案抖动（生成层·两范式共有）',
    '中间产物滞后（两范式通病）',
    '共同边界与真正分野',
    '第三章 · 核心隐喻',
    '编译执行 vs 解释执行（双轨模拟器）',
    '解释执行的内在过程（逐个算相似度）',
    '编译执行的内在过程（index 目录导航命中）',
    '一次性消费→复利资产（成本累积曲线）',
    'DSPy 同名异义辨析',
    '第四章 · LLM Wiki 怎么搭起来',
    '三层架构所有权（点选高亮）',
    '编译过程长出 wiki（生长动画）',
    '两个特殊文件 index.md + log.md',
    '三操作 Ingest/Query/Lint 读写边界',
    '第五章 · 成本真相与选型决策',
    '20× 成本张力',
    '四范式三元选型对照',
    '心智地图小结'
  ]; /* length === 21 */

  /* 目录分组 ←§一.4（chapters[last].end === 20，0-based）*/
  var chapters = [
    { title: '开场',                                    start: 0,  end: 1  },
    { title: '机器索引 vs 可读 wiki',                   start: 2,  end: 5  },
    { title: '核心隐喻：编译 vs 解释',                  start: 6,  end: 11 },
    { title: 'LLM Wiki 怎么搭起来',                  start: 12, end: 16 },
    { title: '成本真相与选型决策',                      start: 17, end: 19 },
    { title: '收尾',                                    start: 20, end: 20 }
  ]; /* chapters[5].end === 20 ✓ */

  /* ===== 状态 ===== */
  var totalSlides = slideFiles.length;
  var currentIndex = 0;
  var slideCache = {};
  var currentCleanup = null;
  var menuOpen = false;

  /* 画板状态 */
  var drawBoardEnabled = false;
  var drawCtx = null;
  var isDrawing = false;

  /* 颜色（共享给画笔拖尾和画板）←§一.3 */
  var currentDrawColor = '#ef4444';
  var colorPickerOpen = false;

  /* ===== loadSlide / showSlide ===== */
  async function loadSlide(n) {
    if (n < 0 || n >= totalSlides) return;

    /* cleanup 上页 ←§一.9 GSAP 安全 */
    if (typeof currentCleanup === 'function') {
      try { currentCleanup(); } catch (e) { /* ignore */ }
    }
    currentCleanup = null;

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
        html = '<div style="text-align:center;padding:4rem;color:var(--text-secondary);">无法加载 ' + file + '</div>';
        slideCache[file] = html;
      }
    }

    var viewport = document.getElementById('slide-viewport');
    viewport.innerHTML = '<div class="slide">' + html + '</div>';

    /* 手动重建 <script> 标签（innerHTML 注入不会自动执行）*/
    var scripts = viewport.querySelectorAll('script');
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src = oldScript.src;
        newScript.async = false;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    /* slideHooks 调用（重交互页 ←§一.9）*/
    /* 延迟 ≤10ms，避免内容填充前出现空面板闪烁 */
    setTimeout(function () {
      var hookKey = file; /* 键名格式：'slides/SXX-filename.html' */
      if (window.slideHooks && typeof window.slideHooks[hookKey] === 'function') {
        try {
          var cleanup = window.slideHooks[hookKey]();
          if (typeof cleanup === 'function') currentCleanup = cleanup;
        } catch (e) { console.warn('slideHook error [' + hookKey + ']:', e); }
      }

      /* .animate-ready 入场动画 */
      var els = document.querySelectorAll('.animate-ready');
      els.forEach(function (el) {
        var delay = parseFloat(el.getAttribute('data-delay') || '0');
        setTimeout(function () { el.classList.add('animated'); }, delay * 1000);
      });
    }, 8);

    /* 预载相邻页 */
    [n - 1, n + 1].forEach(function (i) {
      if (i >= 0 && i < totalSlides && !slideCache[slideFiles[i]]) {
        fetch(slideFiles[i])
          .then(function (r) { return r.ok ? r.text() : ''; })
          .then(function (t) { if (t) slideCache[slideFiles[i]] = t; })
          .catch(function () {});
      }
    });

    /* 导航按钮状态 */
    var prev = document.getElementById('nav-prev');
    var next = document.getElementById('nav-next');
    if (prev) prev.disabled = n === 0;
    if (next) next.disabled = n === totalSlides - 1;
  }

  /* ===== 进度条 & 页码 ===== */
  function updateProgressBar() {
    var pct = totalSlides > 1 ? (currentIndex / (totalSlides - 1)) * 100 : 100;
    var bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = Math.max(4, pct) + '%';
  }

  function updatePageIndicator() {
    var cur = document.getElementById('page-current');
    var tot = document.getElementById('page-total');
    if (cur) cur.textContent = currentIndex + 1;
    if (tot) tot.textContent = totalSlides;
  }

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

  /* ===== 侧边菜单（分组渲染）←§一.4 目录分组铁律 ===== */
  function buildMenu() {
    var list = document.getElementById('menu-list');
    if (!list) return;
    list.innerHTML = '';

    chapters.forEach(function (ch) {
      /* 分组标题（蓝色粗体，不可点击）←§一.4 规则2 */
      var chEl = document.createElement('div');
      chEl.className = 'menu-chapter';
      chEl.textContent = ch.title;
      list.appendChild(chEl);

      /* 分组内 slides（序号 + 标题，可点击）←§一.4 规则3 */
      for (var i = ch.start; i <= ch.end; i++) {
        (function (idx) {
          var item = document.createElement('div');
          item.className = 'menu-item';
          item.setAttribute('data-index', idx);
          /* 禁止创建 .menu-item-dot DOM ←学员视角原则 */
          item.innerHTML =
            '<span class="menu-item-num">' + String(idx + 1).padStart(2, '0') + '</span>' +
            '<span>' + slideTitles[idx] + '</span>';
          item.onclick = function () { goToSlide(idx); closeMenu(); };
          list.appendChild(item);
        })(i);
      }
    });
  }

  function updateMenuActiveState() {
    var items = document.querySelectorAll('.menu-item');
    items.forEach(function (item) {
      var idx = parseInt(item.getAttribute('data-index'), 10);
      item.classList.toggle('active', idx === currentIndex);
    });
  }

  function toggleMenu() { menuOpen ? closeMenu() : openMenu(); }

  function openMenu() {
    menuOpen = true;
    var menu = document.getElementById('side-menu');
    var overlay = document.getElementById('menu-overlay');
    if (menu) menu.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    updateMenuActiveState();
  }

  function closeMenu() {
    menuOpen = false;
    var menu = document.getElementById('side-menu');
    var overlay = document.getElementById('menu-overlay');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
  }

  /* ===== 画笔拖尾 (T) ←§一.1 FADE_MS=1200 时间衰减模式 ===== */
  /* _pen.trails[] + animatePenTrail() 结构 */
  var _pen = {
    active: false,
    canvas: null,
    ctx: null,
    drawing: false,
    points: [],
    trails: [],
    rafId: null,
    FADE_MS: 1200,   /* ←§一.1 FADE_MS=1200，严禁永久保留 */
    LINE_WIDTH: 3
  };

  function initPenTrail() {
    var canvas = document.getElementById('pen-trail-canvas');
    if (!canvas) return;
    _pen.canvas = canvas;
    _pen.ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousedown', function (e) {
      _pen.drawing = true;
      _pen.points = [{ x: e.clientX, y: e.clientY, t: Date.now() }];
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!_pen.drawing) return;
      _pen.points.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      penRender();
    });
    canvas.addEventListener('mouseup', penUp);
    canvas.addEventListener('mouseleave', penUp);

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      _pen.drawing = true;
      _pen.points = [{ x: t.clientX, y: t.clientY, t: Date.now() }];
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (!_pen.drawing) return;
      var t = e.touches[0];
      _pen.points.push({ x: t.clientX, y: t.clientY, t: Date.now() });
      penRender();
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
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

  /* penRender：清屏→过期 trail 过滤→alpha 衰减绘制 ←§一.1 */
  function penRender() {
    var ctx = _pen.ctx, canvas = _pen.canvas;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var now = Date.now();
    /* 过期 trail 过滤（超过 FADE_MS 的直接丢弃）*/
    _pen.trails = _pen.trails.filter(function (trail) {
      return now - trail.startTime < _pen.FADE_MS;
    });
    _pen.trails.forEach(function (trail) {
      var alpha = Math.max(0, 1 - (now - trail.startTime) / _pen.FADE_MS);
      penDrawPath(ctx, trail.points, alpha * 0.75);
    });
    /* 当前正在绘制的点不参与淡出 */
    if (_pen.points.length > 1) penDrawPath(ctx, _pen.points, 1);
  }

  /* quadraticCurveTo 平滑曲线 ←§一.1 */
  function penDrawPath(ctx, points, alpha) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      var prev = points[i - 1], curr = points[i];
      var mx = (prev.x + curr.x) / 2, my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = hexToRgba(currentDrawColor, alpha);
    ctx.lineWidth = _pen.LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /* _hexToRgba 颜色兼容 ←§一.1 */
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
    var btn = document.getElementById('btn-pen');
    if (_pen.active) {
      if (canvas) canvas.classList.add('pen-active');
      if (btn) btn.classList.add('active');
      animatePenTrail();
    } else {
      if (canvas) canvas.classList.remove('pen-active');
      if (btn) btn.classList.remove('active');
      if (_pen.rafId) cancelAnimationFrame(_pen.rafId);
      _pen.rafId = null;
      if (_pen.ctx && canvas) _pen.ctx.clearRect(0, 0, canvas.width, canvas.height);
      _pen.trails = [];
      _pen.points = [];
    }
  }

  /* animatePenTrail：rAF 循环，trail 清空后停止 ←§一.1 */
  function animatePenTrail() {
    if (!_pen.active) return;
    penRender();
    if (_pen.trails.length > 0 || _pen.drawing) {
      _pen.rafId = requestAnimationFrame(animatePenTrail);
    } else {
      _pen.rafId = null;
    }
  }

  /* ===== 画板 (D) ←§一.2 清后退语义 ===== */
  function initDrawBoard() {
    var canvas = document.getElementById('draw-board-canvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawCtx = canvas.getContext('2d');

    window.addEventListener('resize', function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    canvas.addEventListener('mousedown', function (e) {
      if (!drawBoardEnabled) return;
      isDrawing = true;
      drawCtx.beginPath();
      drawCtx.moveTo(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!isDrawing) return;
      drawCtx.lineTo(e.clientX, e.clientY);
      drawCtx.strokeStyle = currentDrawColor;
      drawCtx.lineWidth = 3;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      drawCtx.stroke();
    });
    canvas.addEventListener('mouseup', function () { isDrawing = false; });
    canvas.addEventListener('mouseleave', function () { isDrawing = false; });

    canvas.addEventListener('touchstart', function (e) {
      if (!drawBoardEnabled) return;
      e.preventDefault();
      var t = e.touches[0];
      isDrawing = true;
      drawCtx.beginPath();
      drawCtx.moveTo(t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      if (!isDrawing) return;
      e.preventDefault();
      var t = e.touches[0];
      drawCtx.lineTo(t.clientX, t.clientY);
      drawCtx.strokeStyle = currentDrawColor;
      drawCtx.lineWidth = 3;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      drawCtx.stroke();
    }, { passive: false });
    canvas.addEventListener('touchend', function () { isDrawing = false; }, { passive: false });
  }

  /* toggleDrawBoard：再按 D 先 clearDrawBoard() 再 drawBoardEnabled=false ←§一.2 */
  function toggleDrawBoard() {
    if (drawBoardEnabled) {
      /* 清后退：先清画面再退出 ←§一.2 画板 toggle 语义 */
      clearDrawBoard();
    } else {
      drawBoardEnabled = true;
      var canvas = document.getElementById('draw-board-canvas');
      if (canvas) {
        canvas.style.pointerEvents = 'all';
        canvas.style.cursor = 'crosshair';
      }
      document.body.classList.add('draw-mode');
    }
  }

  /* clearDrawBoard：清画面 + 退出画板模式 ←§一.2 ESC 同样走此路径 */
  function clearDrawBoard() {
    drawBoardEnabled = false;
    isDrawing = false;
    var canvas = document.getElementById('draw-board-canvas');
    if (canvas) {
      if (drawCtx) drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.pointerEvents = 'none';
      canvas.style.cursor = 'default';
    }
    document.body.classList.remove('draw-mode');
  }

  /* ===== 颜色选择器 ←§一.3 currentDrawColor 共享 ===== */
  function setDrawColor(hex) {
    currentDrawColor = hex;
    var dot = document.getElementById('color-dot-indicator');
    if (dot) dot.style.background = hex;
    document.querySelectorAll('#color-picker-popup .color-dot').forEach(function (btn) {
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
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
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
      case 'Escape':
        /* ESC：画板优先清后退 ←§一.2 */
        if (drawBoardEnabled) { clearDrawBoard(); break; }
        if (_pen.active) { togglePenTrail(); break; }
        if (menuOpen) closeMenu();
        break;
      case 'f':
      case 'F':
        if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleFullscreen(); }
        break;
      case 'm':
      case 'M':
        if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleMenu(); }
        break;
      case 't':
      case 'T':
        togglePenTrail();
        break;
      case 'd':
      case 'D':
        toggleDrawBoard();
        break;
    }
  });

  /* ===== 触摸滑动 ===== */
  var touchStartX = 0, touchStartY = 0;
  document.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) nextSlide(); else prevSlide();
    }
  }, { passive: true });

  /* ===== 全局 API（工具栏 onclick 绑定目标）←§一.5 工具栏按钮事件绑定铁律 ===== */
  window.__nextSlide      = nextSlide;
  window.__prevSlide      = prevSlide;
  window.__goSlide        = function (i) { closeMenu(); goToSlide(i); };
  window.__toggleMenu     = toggleMenu;
  window.__closeMenu      = closeMenu;
  window.__toggleFullscreen  = toggleFullscreen;
  window.__togglePenTrail    = togglePenTrail;
  window.__toggleDrawBoard   = toggleDrawBoard;
  window.__toggleColorPicker = toggleColorPicker;
  window.__setDrawColor      = setDrawColor;

  /* ===== 初始化 ===== */
  document.addEventListener('DOMContentLoaded', function () {
    buildMenu();
    initPenTrail();
    initDrawBoard();

    /* 初始化颜色指示器 */
    var dot = document.getElementById('color-dot-indicator');
    if (dot) dot.style.background = currentDrawColor;

    /* 点击外部关闭色盘 */
    document.addEventListener('click', function (e) {
      if (colorPickerOpen && !e.target.closest('#color-picker-wrap')) closeColorPicker();
    });

    var startSlide = readHash();
    loadSlide(startSlide);
  });

})();
