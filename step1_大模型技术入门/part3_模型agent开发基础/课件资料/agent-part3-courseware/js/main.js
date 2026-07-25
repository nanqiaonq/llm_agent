/* ========== 课件配置 ========== */
const slideFiles = [
    'slides/S001-cover.html',
    'slides/S002-learning-path.html',
    'slides/S003-chapter1.html',
    'slides/S006-plugins-fail.html',
    'slides/S005-native-vs-emergent.html',
    'slides/S004-timeline.html',
    'slides/S007-ch2-title.html',
    'slides/S008-ceo-assistant.html',
    'slides/S009-six-dimensions.html',
    'slides/S010-rag-to-agent.html',
    'slides/S011-ch3-title.html',
    'slides/S012-cot.html',
    'slides/S013-tao-loop.html',
    'slides/S014-weather-case.html',
    'slides/S015-cot-vs-react.html',
    'slides/S015b-react-prompt.html',
    'slides/S016-ch4-title.html',
    'slides/S017-four-pillars.html',
    'slides/S018-llm-gaps.html',
    'slides/S019-ch5-title.html',
    'slides/S019b-workflow-demo.html',
    'slides/S020-decision-matrix.html',
    'slides/S021-fc-title.html',
    'slides/S022-core-myth.html',
    'slides/S023-fc-six-steps.html',
    'slides/S024-tool-definition.html',
    'slides/S025-desc-importance.html',
    'slides/S026-golden-template.html',
    'slides/S027-tool-choice.html',
    'slides/S028-serial-vs-parallel.html',
    'slides/S029-troubleshoot.html',
    'slides/S030-next-steps.html',
];

const slideTitles = [
    '封面：Agent Part 3',
    '本次课程学习路线',
    '第一章：宏观背景',
    'GPT Plugins 三重失败',
    '原生能力 vs 涌现能力',
    'LLM 助手演进路径',
    '第二章：Agent 是什么',
    'CEO 的两种助手',
    '六维能力对比表',
    '从 RAG 到 Agent',
    '第三章：TAO 循环架构',
    '思维链 CoT 概念',
    'TAO 循环图解',
    '案例：查天气两轮循环',
    'CoT vs ReAct 对比',
    'ReAct Prompt 原始模板',
    '第四章：智能体四要素',
    '智能体核心四要素',
    'LLM 的五类天然短板',
    '第五章：Agent vs Workflow',
    'Workflow 流程图步进模拟器',
    '选型决策矩阵',
    '技术层：Function Calling',
    '破除最大误解',
    'FC 六步调用周期',
    '工具定义三要素',
    'Description 决定生命线',
    '黄金描述模板',
    'tool_choice 控制模式',
    '串行 vs 并行调用',
    '四大排障速查表',
    '结语：走向实战',
];

/* ========== 状态管理 ========== */
let currentSlide = 1;
let loadedSlides = {};
const totalSlides = slideFiles.length;

/* ========== Slide 加载与显示 ========== */
async function loadSlide(n) {
    if (n < 1 || n > totalSlides) return '';
    const file = slideFiles[n - 1];
    if (loadedSlides[file]) return loadedSlides[file];
    try {
        const resp = await fetch(file + '?t=' + Date.now());
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const html = await resp.text();
        loadedSlides[file] = html;
        return html;
    } catch (e) {
        console.error('加载失败:', file, e);
        return '<div class="slide" style="justify-content:center;align-items:center;">' +
               '<h2 style="color:#ef4444;">页面加载失败</h2>' +
               '<p style="color:#64748b;">' + file + '</p></div>';
    }
}

async function showSlide(n) {
    if (n < 1 || n > totalSlides) return;
    currentSlide = n;

    if (window._slideCleanup) {
        window._slideCleanup();
        window._slideCleanup = null;
    }

    const container = document.getElementById('slide-container');
    const html = await loadSlide(n);
    container.innerHTML = html;

    const slideEl = container.querySelector('.slide');
    if (slideEl) {
        slideEl.classList.add('active');
        setTimeout(() => triggerAnimations(slideEl), 50);
    }

    if (window.slideHooks) {
        const filename = slideFiles[n - 1].split('/').pop();
        const hook = window.slideHooks[filename] || window.slideHooks[n];
        if (hook) setTimeout(() => hook(), 100);
    }

    updateUI();
    preloadAdjacent(n);
    localStorage.setItem('agentPart3V2CurrentSlide', String(n));
}

function triggerAnimations(slideEl) {
    const elements = slideEl.querySelectorAll('.animate-ready');
    elements.forEach((el, i) => {
        setTimeout(() => el.classList.add('animate-in'), i * 100);
    });
}

/* ========== 导航 ========== */
function nextSlide() { if (currentSlide < totalSlides) showSlide(currentSlide + 1); }
function prevSlide() { if (currentSlide > 1) showSlide(currentSlide - 1); }
function goToSlide(n) { showSlide(n); closeMenu(); }

/* ========== 预加载 ========== */
function preloadAdjacent(n) {
    if (n + 1 <= totalSlides) loadSlide(n + 1);
    if (n - 1 >= 1) loadSlide(n - 1);
}

/* ========== UI 更新 ========== */
function updateUI() {
    const pct = (currentSlide / totalSlides) * 100;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('pageIndicator').textContent = currentSlide + ' / ' + totalSlides;
    document.querySelectorAll('.menu-item').forEach((item, i) => {
        item.classList.toggle('active', i + 1 === currentSlide);
    });
}

/* ========== 菜单 ========== */
function buildMenu() {
    const container = document.getElementById('menuItems');
    container.innerHTML = slideTitles.map((title, i) =>
        '<div class="menu-item" onclick="goToSlide(' + (i + 1) + ')">' +
        '<span class="menu-num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="menu-text">' + title + '</span></div>'
    ).join('');
}

function openMenu() {
    document.getElementById('sidebarMenu').classList.add('open');
    document.getElementById('menuOverlay').classList.add('open');
}

function closeMenu() {
    document.getElementById('sidebarMenu').classList.remove('open');
    document.getElementById('menuOverlay').classList.remove('open');
}

function toggleMenu() {
    document.getElementById('sidebarMenu').classList.contains('open') ? closeMenu() : openMenu();
}

/* ========== 全屏 ========== */
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        (document.documentElement.requestFullscreen ||
         document.documentElement.webkitRequestFullscreen ||
         document.documentElement.msRequestFullscreen).call(document.documentElement);
    } else {
        (document.exitFullscreen ||
         document.webkitExitFullscreen ||
         document.msExitFullscreen).call(document);
    }
}

/* ========== 钢笔拖尾 ========== */
let isPenTrailOn = false;
let penPoints = [];
const PEN_TRAIL_LENGTH = 20;
let penCanvas, penCtx;

function initPenTrail() {
    penCanvas = document.getElementById('pen-trail-canvas');
    penCtx = penCanvas.getContext('2d');
    resizePenCanvas();
    window.addEventListener('resize', resizePenCanvas);
    document.addEventListener('mousemove', trackPenPoint);
}

function resizePenCanvas() {
    if (!penCanvas) return;
    penCanvas.width = window.innerWidth;
    penCanvas.height = window.innerHeight;
}

function trackPenPoint(e) {
    if (isPenTrailOn) {
        penPoints.push({ x: e.clientX, y: e.clientY, age: 0 });
    }
}

function togglePenTrail() {
    isPenTrailOn = !isPenTrailOn;
    penCanvas.classList.toggle('active', isPenTrailOn);
    if (isPenTrailOn) {
        penPoints = [];
        animatePenTrail();
    }
}

function animatePenTrail() {
    if (!isPenTrailOn) return;
    penCtx.clearRect(0, 0, penCanvas.width, penCanvas.height);

    for (let i = 0; i < penPoints.length; i++) {
        penPoints[i].age++;
    }
    penPoints = penPoints.filter((p) => p.age < PEN_TRAIL_LENGTH);

    if (penPoints.length >= 2) {
        for (let i = 1; i < penPoints.length; i++) {
            const p1 = penPoints[i - 1];
            const p2 = penPoints[i];
            const opacity = i / penPoints.length;

            penCtx.beginPath();
            penCtx.moveTo(p1.x, p1.y);
            penCtx.lineTo(p2.x, p2.y);
            penCtx.lineWidth = 4 * opacity;
            penCtx.lineCap = 'round';
            penCtx.lineJoin = 'round';
            penCtx.strokeStyle = `rgba(124, 58, 237, ${opacity})`;
            penCtx.stroke();
        }
    }
    requestAnimationFrame(animatePenTrail);
}

/* ========== 键盘控制 ========== */
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
        case 'PageDown':
            e.preventDefault();
            nextSlide();
            break;
        case 'ArrowLeft':
        case 'PageUp':
            e.preventDefault();
            prevSlide();
            break;
        case 'f':
        case 'F':
            toggleFullScreen();
            break;
        case 'm':
        case 'M':
            toggleMenu();
            break;
        case 't':
        case 'T':
            togglePenTrail();
            break;
        case 'Escape':
            closeMenu();
            break;
    }
});

/* ========== 星空生成 ========== */
function generateStars() {
    const bg = document.getElementById('starsBg');
    if (!bg) return;
    for (let i = 0; i < 80; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (2 + Math.random() * 2) + 's';
        bg.appendChild(star);
    }
}

/* ========== 初始化 ========== */
window.addEventListener('DOMContentLoaded', () => {
    generateStars();
    buildMenu();
    initPenTrail();
    const saved = parseInt(localStorage.getItem('agentPart3V2CurrentSlide') || '1', 10) || 1;
    showSlide(saved > totalSlides ? 1 : saved);
});
