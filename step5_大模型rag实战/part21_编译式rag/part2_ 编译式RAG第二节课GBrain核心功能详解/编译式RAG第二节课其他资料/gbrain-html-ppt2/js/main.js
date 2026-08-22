/**
 * GBrain HTML 课件主控制器
 * 预设：P06 极简钢蓝数据感
 * 实现：导航 / 侧边菜单 / 画笔拖尾(T) / 画板(D) / 颜色选择器 / 快捷键
 * 参照结构锚点：/Users/mac/PycharmProjects/JupyterProject/.../html-courseware/js/main.js
 */

(function () {
  'use strict';

  /* ===== ←§一.4 三数组同步硬约束 (T6b)
   * slideFiles.length === slideTitles.length
   * chapters[last].end === slideFiles.length - 1
   * 加新页时三处必须同步
   * ===== */

  /* ←§一.4 slideFiles 数组：从 slide_structure.json slides[].file 提取，25 页 */
  var slideFiles = [
    'slides/S001-gbrain-cover.html',
    'slides/S002-compiled-rag-what.html',
    'slides/S003-three-layer-three-op.html',
    'slides/S003B-gbrain-origin.html',
    'slides/S004-gbrain-three-layer-arch.html',
    'slides/S005-two-capabilities-overview.html',
    'slides/S006-two-axes-core-thesis.html',
    'slides/T1-stage-connect.html',
    'slides/S007-declare-relationship.html',
    'slides/S008-dynamic-graph-grow.html',
    'slides/S009-zero-llm-deterministic.html',
    'slides/S010-selfwiring-vs-graphrag.html',
    'slides/T2-stage-storage-retrieval.html',
    'slides/S011-source-vs-compiled-dual-track.html',
    'slides/S012-two-engines-one-contract.html',
    'slides/S013-why-hybrid-retrieval.html',
    'slides/S014-three-way-merge-flow.html',
    'slides/S015-rrf-rank-slider.html',
    'slides/T3-stage-think.html',
    'slides/S016-search-vs-think.html',
    'slides/S017-gap-three-signals.html',
    'slides/S018-find-trajectory-temporal.html',
    'slides/T4-stage-ecosystem-judgment.html',
    'slides/S019-skills-vs-tools.html',
    'slides/S020-schema-minions-loop.html',
    'slides/S021-two-benchmarks-no-mix.html',
    'slides/S022-cost-not-equal-quality.html',
    'slides/S023-three-dimension-tradeoff.html',
    'slides/S024-notes-to-thinking-brain.html'
  ]; /* length = 29（含 4 张阶段过渡页 T1-T4） */

  /* ←§一.4 slideTitles 数组：从 slide_structure.json slides[].title 提取，与 slideFiles 同步 */
  var slideTitles = [
    'GBrain：从笔记到会思考的大脑',        /* 01 S001 */
    '编译式 RAG 是什么',                    /* 02 S002 */
    '三层 + 三操作骨架',                    /* 03 S003 */
    'GBrain 从哪来',                       /* 04 S003B */
    'GBrain 是什么 + 三层架构',             /* 04 S004 */
    '两大核心能力总览',                     /* 05 S005 */
    '两根轴 + 核心论断',                    /* 06 S006 */
    '能力一 · 建图 Connect',                /* 07 T1 过渡 */
    '建图的起点：你怎么声明关系',           /* 08 S007 */
    '动态建图演示：看图自己长出来',         /* 08 S008 */
    '零 LLM 的确定性与可追溯',             /* 09 S009 */
    'self-wiring vs GraphRAG',              /* 11 S010 */
    '支撑层 · 存与取 Storage + Retrieval',  /* 12 T2 过渡 */
    '源真相 vs 编译产物双轨',              /* 13 S011 */
    '两引擎一契约 + embedding 是什么',     /* 12 S012 */
    '为什么要混合检索',                     /* 13 S013 */
    '三路合流 HNSW+BM25+RRF',             /* 14 S014 */
    'RRF 为什么不能直接加分',              /* 17 S015 */
    '能力二 · 读+想 Read & Think',         /* 18 T3 过渡 */
    'search 给页面 vs think 给答案',       /* 19 S016 */
    '空白分析 gap：最该先看的',            /* 17 S017 */
    'find_trajectory：时序复利',           /* 21 S018 */
    '生态与判断力',                         /* 22 T4 过渡 */
    '51 skills vs 约90 MCP tools',        /* 23 S019 */
    'schema 包 + Minions 梦循环',          /* 20 S020 */
    '两个 benchmark 严禁混引',             /* 21 S021 */
    '成本贵 ≠ 质量差',                    /* 22 S022 */
    '三维权衡：一把判断的尺',              /* 23 S023 */
    '从笔记到会思考的大脑'                 /* 29 S024 */
  ]; /* length = 29 */

  /* ←§一.4 chapters 数组：从 slide_structure.json chapters 提取，9 章 */
  /* T6b: chapters[8].end = 24 = slideFiles.length - 1 = 25 - 1 = 24 ✓ */
  /* 6 阶段分组：每个能力/支撑阶段以过渡页(T1-T4)作章首 */
  var chapters = [
    { title: '开篇与全景',              start: 0,  end: 6  }, /* S001-S006 */
    { title: '能力一：建图 self-wiring', start: 7,  end: 11 }, /* T1,S007-S010 */
    { title: '支撑层：存与取',          start: 12, end: 17 }, /* T2,S011-S015 */
    { title: '能力二：读+想 综合',      start: 18, end: 21 }, /* T3,S016-S018 */
    { title: '生态与判断力',            start: 22, end: 27 }, /* T4,S019-S023 */
    { title: '收尾',                    start: 28, end: 28 }  /* S024 */
  ]; /* chapters[last].end = 28 = slideFiles.length - 1 ✓ */

  /* ===== 状态 ===== */
  var totalSlides    = slideFiles.length; /* 25 */
  var currentIndex   = 0;
  var slideCache     = {};
  var currentCleanup = null;
  var menuOpen       = false;
  var colorPickerOpen = false;

  /* ←§一.3 颜色选择器共享变量 */
  var currentDrawColor = '#3B82F6'; /* 初始蓝色 */

  /* ←§一.2 画板状态 */
  var drawBoardEnabled = false;
  var drawCtx          = null;
  var isDrawing        = false;

  /* ===== loadSlide / showSlide ===== */
  async function loadSlide(n) {
    if (n < 0 || n >= totalSlides) return;

    /* cleanup 上一页 */
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
        html = '<div style="text-align:center;padding:4rem;color:var(--text-dim);">无法加载 ' + file + '</div>';
        slideCache[file] = html;
      }
    }

    var viewport = document.getElementById('slide-viewport');
    viewport.innerHTML = '<div class="slide">' + html + '</div>';

    /* 手动重建 script 标签，innerHTML 注入的 script 不自动执行 */
    var scripts = viewport.querySelectorAll('script');
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src   = oldScript.src;
        newScript.async = false;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    /* slideHooks 支持（interactive-eng 注册的重交互 hook） */
    var hookFn = window.slideHooks && window.slideHooks[file];
    if (typeof hookFn === 'function') {
      /* 延迟 ≤10ms，避免内容填充前空面板闪烁 */
      setTimeout(function () {
        try {
          var cleanup = hookFn();
          if (typeof cleanup === 'function') currentCleanup = cleanup;
        } catch (e) {
          console.warn('[main.js] slideHook error:', file, e);
        }
      }, 8);
    }

    /* 触发 .animate-ready 入场动画 */
    setTimeout(function () {
      var els = document.querySelectorAll('.animate-ready');
      els.forEach(function (el) {
        var delay = parseFloat(el.getAttribute('data-delay') || '0');
        setTimeout(function () { el.classList.add('animated'); }, delay * 1000);
      });
    }, 8);

    /* 预加载相邻页 */
    [n - 1, n + 1].forEach(function (i) {
      if (i >= 0 && i < totalSlides && !slideCache[slideFiles[i]]) {
        fetch(slideFiles[i]).then(function (r) {
          return r.ok ? r.text() : '';
        }).then(function (t) {
          if (t) slideCache[slideFiles[i]] = t;
        }).catch(function () {});
      }
    });

    /* nav 按钮状态 */
    var prev = document.getElementById('nav-prev');
    var next = document.getElementById('nav-next');
    if (prev) prev.disabled = (n === 0);
    if (next) next.disabled = (n === totalSlides - 1);
  }

  /* ===== 进度条 & 页码 ===== */
  function updateProgressBar() {
    var pct = totalSlides > 1 ? (currentIndex / (totalSlides - 1)) * 100 : 100;
    var bar  = document.getElementById('progress-bar');
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
    var num  = parseInt(hash, 10);
    if (num >= 1 && num <= totalSlides) return num - 1;
    return 0;
  }

  /* ===== 翻页 ===== */
  function prevSlide()   { if (currentIndex > 0) loadSlide(currentIndex - 1); }
  function nextSlide()   { if (currentIndex < totalSlides - 1) loadSlide(currentIndex + 1); }
  function goToSlide(n)  { if (n >= 0 && n < totalSlides) loadSlide(n); }

  /* ===== 全屏 ===== */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  }

  /* ===== ←§一.4 目录分组：章标题蓝色粗体不可点 + 缩进子项可点，禁平铺无分组 ===== */
  function buildMenu() {
    var list = document.getElementById('menu-list');
    if (!list) return;
    list.innerHTML = '';

    chapters.forEach(function (ch) {
      /* 分组标题（不可点） */
      var chEl      = document.createElement('div');
      chEl.className = 'menu-chapter';
      chEl.textContent = ch.title;
      list.appendChild(chEl);

      /* 子项（可点） */
      for (var i = ch.start; i <= ch.end; i++) {
        (function (idx) {
          var item = document.createElement('div');
          item.className = 'menu-item';
          item.setAttribute('data-index', String(idx));
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
    document.querySelectorAll('.menu-item').forEach(function (item) {
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

  /* ===== ←§一.1 画笔拖尾 (T键) ===== */
  /* 参数：FADE_DURATION=2000ms，quadraticCurveTo 平滑，hexToRgba 颜色 */
  var _pen = {
    active:        false,
    canvas:        null,
    ctx:           null,
    drawing:       false,
    points:        [],
    trails:        [],   /* ←§一.1 _pen.trails[] 结构 */
    rafId:         null,
    FADE_DURATION: 2000, /* ←§一.1 FADE_MS=1200 时间衰减（文档标注 2000，以样本为准） */
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

    canvas.addEventListener('mousedown', function (e) {
      _pen.drawing = true;
      _pen.points  = [{ x: e.clientX, y: e.clientY, t: Date.now() }];
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!_pen.drawing) return;
      _pen.points.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      penRender();
    });
    canvas.addEventListener('mouseup',    penUp);
    canvas.addEventListener('mouseleave', penUp);

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      _pen.drawing = true;
      _pen.points  = [{ x: t.clientX, y: t.clientY, t: Date.now() }];
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
    if (_pen.active) animatePenTrail(); /* ←§一.1 animatePenTrail() */
  }

  function penRender() {
    var ctx = _pen.ctx, canvas = _pen.canvas;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var now = Date.now();
    /* 过滤已超时轨迹 */
    _pen.trails = _pen.trails.filter(function (trail) {
      return now - trail.startTime < _pen.FADE_DURATION;
    });
    /* 绘制淡出轨迹 */
    _pen.trails.forEach(function (trail) {
      var alpha = Math.max(0, 1 - (now - trail.startTime) / _pen.FADE_DURATION);
      penDrawPath(ctx, trail.points, alpha * 0.75);
    });
    /* 绘制当前拖尾 */
    if (_pen.points.length > 1) penDrawPath(ctx, _pen.points, 1);
  }

  /* ←§一.1 quadraticCurveTo 平滑曲线 */
  function penDrawPath(ctx, points, alpha) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      var prev = points[i - 1], curr = points[i];
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

  /* ←§一.1 _hexToRgba 颜色兼容 */
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
      animatePenTrail(); /* 启动 RAF 循环 */
    } else {
      if (canvas) canvas.classList.remove('pen-active');
      if (btn)    btn.classList.remove('active');
      if (_pen.rafId) { cancelAnimationFrame(_pen.rafId); _pen.rafId = null; }
      if (_pen.ctx && canvas) _pen.ctx.clearRect(0, 0, canvas.width, canvas.height);
      _pen.trails = [];
      _pen.points = [];
    }
  }

  /* ←§一.1 animatePenTrail() RAF 循环 */
  function animatePenTrail() {
    if (!_pen.active) return;
    penRender();
    if (_pen.trails.length > 0 || _pen.drawing) {
      _pen.rafId = requestAnimationFrame(animatePenTrail);
    } else {
      _pen.rafId = null;
    }
  }

  /* ===== ←§一.2 画板 (D键)：笔迹永久，再按 D/Esc 先 clearDrawBoard 再退 ===== */
  function initDrawBoard() {
    var canvas = document.getElementById('draw-board-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    drawCtx = canvas.getContext('2d');

    window.addEventListener('resize', function () {
      canvas.width  = window.innerWidth;
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
      drawCtx.lineWidth   = 3;
      drawCtx.lineCap     = 'round';
      drawCtx.lineJoin    = 'round';
      drawCtx.stroke();
    });
    canvas.addEventListener('mouseup',    function () { isDrawing = false; });
    canvas.addEventListener('mouseleave', function () { isDrawing = false; });
  }

  /* ←§一.2 toggle 语义：再按 D 先 clearDrawBoard() 再 drawBoardEnabled=false */
  function toggleDrawBoard() {
    if (drawBoardEnabled) {
      clearDrawBoard(); /* 先清后退 */
    } else {
      drawBoardEnabled = true;
      var canvas = document.getElementById('draw-board-canvas');
      if (canvas) {
        canvas.style.pointerEvents = 'all';
        canvas.style.cursor        = 'crosshair';
      }
      document.body.classList.add('draw-mode');
      var btn = document.getElementById('btn-draw');
      if (btn) btn.classList.add('active');
    }
  }

  /* ←§一.2 clearDrawBoard + 退出画板 */
  function clearDrawBoard() {
    drawBoardEnabled = false;
    isDrawing        = false;
    var canvas = document.getElementById('draw-board-canvas');
    if (canvas && drawCtx) {
      drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.pointerEvents = 'none';
      canvas.style.cursor        = 'default';
    }
    document.body.classList.remove('draw-mode');
    var btn = document.getElementById('btn-draw');
    if (btn) btn.classList.remove('active');
  }

  /* ===== ←§一.3 颜色选择器：4色共享 currentDrawColor ===== */
  function setDrawColor(hex) {
    currentDrawColor = hex;
    /* 更新圆点指示器 */
    var dot = document.getElementById('color-dot-indicator');
    if (dot) dot.style.background = hex;
    /* 更新选中白圈 */
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

  /* ===== 键盘快捷键 ===== */
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault(); prevSlide(); break;
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        e.preventDefault(); nextSlide(); break;
      case 'Home':
        e.preventDefault(); goToSlide(0); break;
      case 'End':
        e.preventDefault(); goToSlide(totalSlides - 1); break;
      case 'Escape':
        /* ←§一.2 ESC 走清后退路径 */
        if (drawBoardEnabled) { clearDrawBoard(); break; }
        if (_pen.active)      { togglePenTrail(); break; }
        if (menuOpen)         { closeMenu(); }
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
        togglePenTrail(); break;
      case 'd':
      case 'D':
        toggleDrawBoard(); break;
    }
  });

  /* ===== 触摸滑动（50px 阈值） ===== */
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

  /* ===== 全局 API (供 onclick 绑定 + slide 内调用) ===== */
  window.__nextSlide          = nextSlide;
  window.__prevSlide          = prevSlide;
  window.__goSlide            = function (i) { closeMenu(); goToSlide(i); };
  window.__toggleMenu         = toggleMenu;
  window.__closeMenu          = closeMenu;
  window.__toggleFullscreen   = toggleFullscreen;
  window.__togglePenTrail     = togglePenTrail;
  window.__toggleDrawBoard    = toggleDrawBoard;
  window.__toggleColorPicker  = toggleColorPicker;
  window.__setDrawColor       = setDrawColor;

  /* ===== 初始化 ===== */
  document.addEventListener('DOMContentLoaded', function () {
    buildMenu();
    initPenTrail();
    initDrawBoard();

    /* 初始化颜色指示器 */
    var dot = document.getElementById('color-dot-indicator');
    if (dot) dot.style.background = currentDrawColor;

    /* 初始化颜色选中状态 */
    document.querySelectorAll('#color-picker-popup .color-dot').forEach(function (btn) {
      btn.classList.toggle('selected', btn.dataset.color === currentDrawColor);
    });

    /* 点击外部关闭色盘 */
    document.addEventListener('click', function (e) {
      if (colorPickerOpen && !e.target.closest('#color-picker-wrap')) {
        closeColorPicker();
      }
    });

    /* 从 URL hash 读取起始页 */
    var startSlide = readHash();
    loadSlide(startSlide);
  });

  /* ===== T6b 三数组同步自检 (开发期断言，不影响产出) ===== */
  if (slideFiles.length !== slideTitles.length) {
    console.error('[T6b] slideFiles.length=' + slideFiles.length + ' !== slideTitles.length=' + slideTitles.length);
  }
  if (chapters[chapters.length - 1].end !== slideFiles.length - 1) {
    console.error('[T6b] chapters[last].end=' + chapters[chapters.length - 1].end + ' !== slideFiles.length-1=' + (slideFiles.length - 1));
  }

})();
