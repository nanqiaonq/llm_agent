/* ========== Agent Part 3 v2 交互逻辑 ========== */
window.slideHooks = window.slideHooks || {};

function safeGsapSet(target, vars) {
    if (window.gsap) {
        try { window.gsap.set(target, vars); } catch (_) {}
        return;
    }
    if (!target) return;
    if (Object.prototype.hasOwnProperty.call(vars, 'opacity')) target.style.opacity = String(vars.opacity);
    if (Object.prototype.hasOwnProperty.call(vars, 'scale')) target.style.transform = 'scale(' + vars.scale + ')';
    if (Object.prototype.hasOwnProperty.call(vars, 'x')) target.style.transform = 'translateX(' + vars.x + 'px)';
    if (Object.prototype.hasOwnProperty.call(vars, 'y')) target.style.transform = 'translateY(' + vars.y + 'px)';
}

function safeGsapTo(target, vars) {
    if (window.gsap) {
        try { window.gsap.to(target, vars); } catch (_) {}
        return;
    }
    if (!target) return;
    if (Object.prototype.hasOwnProperty.call(vars, 'opacity')) target.style.opacity = String(vars.opacity);
    if (Object.prototype.hasOwnProperty.call(vars, 'scale')) target.style.transform = 'scale(' + vars.scale + ')';
}

/* ── S004: 时间轴节点点击详情 ── */
window.slideHooks['S004-timeline.html'] = function() {
    const nodes = Array.from(document.querySelectorAll('.tl-node'));
    const details = Array.from(document.querySelectorAll('.tl-detail'));
    const line = document.getElementById('tl-line');
    if (!nodes.length || !details.length) return;

    nodes.forEach((node) => {
        node.onclick = function() {
            const targetId = node.getAttribute('data-target');
            const target = document.getElementById(targetId);

            nodes.forEach((n) => {
                n.style.opacity = '0.55';
                n.style.transform = 'scale(1)';
                n.style.borderColor = 'var(--card-border)';
            });
            details.forEach((d) => {
                d.style.display = 'none';
                d.style.opacity = '0';
                d.style.transform = 'translateY(12px)';
            });

            node.style.opacity = '1';
            node.style.borderColor = 'rgba(37,99,235,0.45)';
            safeGsapSet(node, { scale: 1 });
            safeGsapTo(node, { scale: 1.04, duration: 0.2 });

            if (target) {
                target.style.display = 'block';
                safeGsapSet(target, { opacity: 0, y: 12 });
                if (window.gsap) {
                    window.gsap.to(target, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
                } else {
                    target.style.opacity = '1';
                    target.style.transform = 'translateY(0)';
                }
            }
        };
    });

    if (line) {
        safeGsapSet(line, { scaleX: 0 });
        safeGsapTo(line, { scaleX: 1, duration: 0.45, ease: 'power2.out' });
    }
    nodes.forEach((node, i) => {
        safeGsapSet(node, { opacity: 0, y: 12 });
        if (window.gsap) {
            window.gsap.to(node, { opacity: 0.55, y: 0, duration: 0.28, delay: 0.06 * i, ease: 'power2.out' });
        } else {
            node.style.opacity = '0.55';
            node.style.transform = 'translateY(0)';
        }
    });

    setTimeout(() => {
        if (nodes[0] && typeof nodes[0].onclick === 'function') nodes[0].onclick();
    }, 120);
};

/* ── S009: 表格逐行淡入 ── */
window.slideHooks['S009-six-dimensions.html'] = function() {
    const rows = Array.from(document.querySelectorAll('#six-dim-table .dim-row'));
    if (!rows.length) return;

    rows.forEach((row) => {
        row.style.opacity = '0';
        row.style.transform = 'translateY(10px)';
    });

    rows.forEach((row, idx) => {
        if (window.gsap) {
            window.gsap.set(row, { opacity: 0, y: 10 });
            window.gsap.to(row, { opacity: 1, y: 0, duration: 0.28, delay: idx * 0.08, ease: 'power2.out' });
        } else {
            setTimeout(() => {
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, idx * 80);
        }
    });
};

/* ── S010: 过渡箭头脉冲 ── */
window.slideHooks['S010-rag-to-agent.html'] = function() {
    const arrow = document.getElementById('rag-agent-arrow');
    if (!arrow || !window.gsap) return;
    try { window.gsap.killTweensOf(arrow); } catch (_) {}
    window.gsap.set(arrow, { scale: 1, opacity: 0.8 });
    window.gsap.to(arrow, { scale: 1.18, opacity: 1, duration: 0.7, yoyo: true, repeat: -1, ease: 'power1.inOut' });
    window._slideCleanup = function() {
        try { window.gsap.killTweensOf(arrow); } catch (_) {}
    };
};

/* ── S012: CoT 思维链逐步演示 ── */
window.slideHooks['S012-cot.html'] = function() {
    const btn = document.getElementById('cot-start-btn');
    const step1 = document.getElementById('cot-step-1');
    const step2 = document.getElementById('cot-step-2');
    const step3 = document.getElementById('cot-step-3');
    const answer = document.getElementById('cot-answer');
    if (!btn || !step1 || !step2 || !step3 || !answer) return;

    const steps = [step1, step2, step3];
    const timers = [];
    let running = false;

    function safeTimeout(fn, ms) {
        const id = setTimeout(fn, ms);
        timers.push(id);
        return id;
    }

    function clearTimers() {
        while (timers.length) clearTimeout(timers.pop());
    }

    function resetView() {
        clearTimers();
        running = false;
        steps.forEach((step) => {
            step.classList.remove('visible', 'current', 'done');
        });
        answer.classList.remove('visible');
        btn.textContent = '▶ 开始思考';
        btn.disabled = false;
    }

    function showStep(i) {
        const step = steps[i];
        if (!step) return;
        step.classList.add('visible', 'current');
        safeTimeout(() => {
            step.classList.remove('current');
            step.classList.add('done');
        }, 550);
    }

    function play() {
        if (running) return;
        resetView();
        running = true;
        btn.disabled = true;

        showStep(0);
        safeTimeout(() => showStep(1), 800);
        safeTimeout(() => showStep(2), 1600);
        safeTimeout(() => {
            answer.classList.add('visible');
        }, 2400);
        safeTimeout(() => {
            running = false;
            btn.disabled = false;
            btn.textContent = '↺ 重新思考';
        }, 2650);
    }

    btn.onclick = function() {
        play();
    };

    resetView();
    window._slideCleanup = function() {
        clearTimers();
    };
};

/* ── S013: TAO 循环入场动画 ── */
window.slideHooks['S013-tao-loop.html'] = function() {
    const think = document.getElementById('tao-think');
    const act = document.getElementById('tao-act');
    const observe = document.getElementById('tao-observe');
    const e1 = document.getElementById('tao-edge-1');
    const e2 = document.getElementById('tao-edge-2');
    const e3 = document.getElementById('tao-edge-3');
    const particle = document.getElementById('tao-particle');
    const insight = document.getElementById('tao-insight');
    if (!think || !act || !observe || !e1 || !e2 || !e3 || !insight) return;

    const timers = [];
    const paths = [e1, e2, e3];
    let rafId = null;
    let loopStarted = false;
    function safeTimeout(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
    function clearTimers() { while (timers.length) { clearTimeout(timers.pop()); } }
    function stopParticleLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        loopStarted = false;
        if (particle) particle.style.opacity = '0';
    }
    window._slideCleanup = function() {
        clearTimers();
        stopParticleLoop();
    };

    [think, act, observe].forEach((node) => { node.style.opacity = '0.35'; node.style.transformOrigin = 'center center'; });
    [e1, e2, e3].forEach((edge) => { edge.style.strokeDasharray = '500'; edge.style.strokeDashoffset = '500'; });

    insight.style.display = 'none';
    insight.style.opacity = '0';
    if (particle) particle.style.opacity = '0';

    function startParticleLoop() {
        if (!particle || loopStarted) return;
        loopStarted = true;
        const segmentMs = 2600;
        const totalMs = segmentMs * paths.length;
        const start = performance.now();

        function tick(now) {
            const elapsed = (now - start) % totalMs;
            const segIdx = Math.floor(elapsed / segmentMs);
            const segProgress = (elapsed % segmentMs) / segmentMs;
            const path = paths[segIdx];
            if (path && path.getTotalLength) {
                const len = path.getTotalLength();
                const pt = path.getPointAtLength(len * segProgress);
                particle.setAttribute('cx', String(pt.x));
                particle.setAttribute('cy', String(pt.y));
                particle.style.opacity = '1';
            }
            rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);
    }

    function lightNode(node) {
        node.style.opacity = '1';
        if (window.gsap) {
            window.gsap.set(node, { scale: 1 });
            window.gsap.to(node, { scale: 1.07, duration: 0.22, yoyo: true, repeat: 1, ease: 'power1.inOut' });
        }
    }

    function drawEdge(edge) {
        if (window.gsap) {
            window.gsap.to(edge, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' });
        } else {
            edge.style.strokeDashoffset = '0';
        }
    }

    lightNode(think);
    safeTimeout(() => { drawEdge(e1); }, 180);
    safeTimeout(() => { lightNode(act); }, 550);
    safeTimeout(() => { drawEdge(e2); }, 760);
    safeTimeout(() => { lightNode(observe); }, 1080);
    safeTimeout(() => { drawEdge(e3); }, 1260);
    safeTimeout(() => { startParticleLoop(); }, 1380);
    safeTimeout(() => {
        insight.style.display = 'block';
        if (window.gsap) {
            window.gsap.set(insight, { opacity: 0, y: 8 });
            window.gsap.to(insight, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
        } else {
            insight.style.opacity = '1';
        }
    }, 1540);
};

/* ── S014: 查天气两轮循环步进 ── */
window.slideHooks['S014-weather-case.html'] = function() {
    const steps = Array.from(document.querySelectorAll('.weather-step'));
    const links = Array.from(document.querySelectorAll('.weather-link'));
    const btn = document.getElementById('weather-next-btn');
    const desc = document.getElementById('weather-case-desc');
    if (!steps.length || !btn || !desc) return;

    const messages = [
        '当前步骤：准备开始第一轮思考。',
        '第一轮 Think：识别需求，决定调用天气工具。',
        '第一轮 Act：执行 get_weather("北京")。',
        '第一轮 Observe：获得 33°C、晴天结果。',
        '第二轮 Think：触发高温提醒策略。',
        '第二轮 Act：组织最终回复和建议。',
        '第二轮 Observe：任务完成，循环终止。'
    ];

    let idx = 0;

    function paint() {
        steps.forEach((step, i) => {
            if (i < idx - 1) {
                step.style.opacity = '0.65';
                step.style.borderColor = 'rgba(22,163,74,0.35)';
                step.style.boxShadow = 'none';
            } else if (i === idx - 1) {
                step.style.opacity = '1';
                step.style.borderColor = 'rgba(124,58,237,0.45)';
                step.style.boxShadow = '0 8px 20px rgba(124,58,237,0.12)';
            } else {
                step.style.opacity = '0.45';
                step.style.borderColor = 'var(--card-border)';
                step.style.boxShadow = 'none';
            }
        });

        links.forEach((link) => {
            const from = parseInt(link.getAttribute('data-from') || '0', 10);
            link.classList.toggle('active-flow', from === idx && idx < steps.length);
        });

        desc.textContent = messages[idx];
        btn.textContent = idx >= steps.length ? '↺ 重置' : '▶ 下一步';
    }

    btn.onclick = function() {
        idx += 1;
        if (idx > steps.length) idx = 0;
        paint();
    };

    paint();
};

/* ── S019b: Workflow 流程图步进模拟器 ── */
window.slideHooks['S019b-workflow-demo.html'] = function() {
    const btn = document.getElementById('wf-start-btn');
    const desc = document.getElementById('wf-step-desc');
    const manualNode = document.getElementById('wf-node-manual');
    const nodes = [
        document.getElementById('wf-node-intake'),
        document.getElementById('wf-node-classify'),
        document.getElementById('wf-node-severity'),
        document.getElementById('wf-node-auto'),
        document.getElementById('wf-node-notify')
    ];
    const lines = [
        document.getElementById('wf-line-1'),
        document.getElementById('wf-line-2'),
        document.getElementById('wf-line-3'),
        document.getElementById('wf-line-4')
    ];
    const branchLine = document.getElementById('wf-line-severe');
    if (!btn || !desc || nodes.some((n) => !n) || lines.some((l) => !l) || !manualNode || !branchLine) return;

    const timers = [];
    let running = false;

    function safeTimeout(fn, ms) {
        const id = setTimeout(fn, ms);
        timers.push(id);
        return id;
    }

    function clearTimers() {
        while (timers.length) clearTimeout(timers.pop());
    }

    function resetStyles() {
        nodes.forEach((node) => node.classList.remove('active', 'done'));
        lines.forEach((line) => line.classList.remove('active'));
        branchLine.classList.remove('active');
        manualNode.classList.remove('active', 'done');
        manualNode.classList.add('muted-branch');
    }

    function paint(step) {
        resetStyles();

        if (step === 0) {
            desc.textContent = '点击开始，观察 Workflow 按序执行。';
            btn.textContent = '▶ 开始执行';
            btn.disabled = false;
            return;
        }

        if (step === 1) {
            nodes[0].classList.add('active');
            desc.textContent = 'Step 1：接收用户投诉数据';
            return;
        }

        if (step === 2) {
            nodes[0].classList.add('done');
            lines[0].classList.add('active');
            nodes[1].classList.add('active');
            desc.textContent = 'Step 2：按预定规则分类投诉类型';
            return;
        }

        if (step === 3) {
            nodes[0].classList.add('done');
            nodes[1].classList.add('done');
            lines[0].classList.add('active');
            lines[1].classList.add('active');
            nodes[2].classList.add('active');
            desc.textContent = 'Step 3：条件判断 → 走"一般"分支';
            return;
        }

        if (step === 4) {
            nodes[0].classList.add('done');
            nodes[1].classList.add('done');
            nodes[2].classList.add('done');
            lines[0].classList.add('active');
            lines[1].classList.add('active');
            lines[2].classList.add('active');
            nodes[3].classList.add('active');
            desc.textContent = 'Step 4：执行自动退款/道歉处理';
            return;
        }

        if (step === 5) {
            nodes[0].classList.add('done');
            nodes[1].classList.add('done');
            nodes[2].classList.add('done');
            nodes[3].classList.add('done');
            lines[0].classList.add('active');
            lines[1].classList.add('active');
            lines[2].classList.add('active');
            lines[3].classList.add('active');
            nodes[4].classList.add('active');
            desc.textContent = 'Step 5：邮件通知用户处理结果';
            return;
        }

        if (step === 6) {
            nodes.forEach((node) => node.classList.add('done'));
            lines.forEach((line) => line.classList.add('active'));
            desc.textContent = '✅ Workflow 执行完毕！路径固定、结果可预测';
            btn.disabled = false;
            btn.textContent = '↺ 重新执行';
        }
    }

    function play() {
        if (running) return;
        running = true;
        btn.disabled = true;
        paint(1);
        safeTimeout(() => paint(2), 850);
        safeTimeout(() => paint(3), 1700);
        safeTimeout(() => paint(4), 2550);
        safeTimeout(() => paint(5), 3400);
        safeTimeout(() => {
            paint(6);
            running = false;
        }, 4250);
    }

    btn.onclick = function() {
        clearTimers();
        paint(0);
        play();
    };

    paint(0);
    window._slideCleanup = function() {
        clearTimers();
        running = false;
    };
};

/* ── S020: 决策矩阵 Tab 切换 ── */
window.slideHooks['S020-decision-matrix.html'] = function() {
    const tabs = Array.from(document.querySelectorAll('.decision-tab'));
    const panels = Array.from(document.querySelectorAll('.decision-panel'));
    if (!tabs.length || !panels.length) return;

    function showPanel(panelId) {
        tabs.forEach((tab) => {
            const active = tab.getAttribute('data-panel') === panelId;
            tab.style.borderColor = active ? 'rgba(37,99,235,0.45)' : 'var(--card-border)';
            tab.style.background = active ? 'rgba(37,99,235,0.10)' : 'var(--card-bg)';
            tab.style.color = active ? '#1d4ed8' : 'var(--text-primary)';
        });

        panels.forEach((panel) => {
            const activePanel = panel.id === panelId;
            if (!activePanel) {
                if (window.gsap) {
                    try { window.gsap.killTweensOf(panel); } catch (_) {}
                }
                panel.style.display = 'none';
                panel.style.opacity = '0';
                panel.style.transform = 'none';
                return;
            }

            panel.style.display = 'block';
            panel.style.transform = 'none';
            if (window.gsap) {
                window.gsap.set(panel, { opacity: 0, y: 8 });
                window.gsap.to(panel, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
            } else {
                panel.style.opacity = '1';
            }
        });
    }

    tabs.forEach((tab) => { tab.onclick = function() { showPanel(tab.getAttribute('data-panel')); }; });
    showPanel('panel-wf');
};

/* ── S022: 纯展示页（无 JS hook） ── */

/* ── S023: 六步流程步进 ── */
window.slideHooks['S023-fc-six-steps.html'] = function() {
    const steps = Array.from(document.querySelectorAll('.fc-step'));
    const btn = document.getElementById('fc-next-btn');
    const desc = document.getElementById('fc-step-desc');
    const roleUser = document.getElementById('role-user');
    const roleApp = document.getElementById('role-app');
    const roleLlm = document.getElementById('role-llm');
    if (!steps.length || !btn || !desc || !roleUser || !roleApp || !roleLlm) return;

    const msgs = [
        '当前步骤：点击下一步开始流程。',
        '步骤1：用户发起请求（👤 → 🖥️）。',
        '步骤2：LLM 判断是否需要工具（🖥️ → 🧠）。',
        '步骤3：LLM 生成 JSON 调用指令（🧠 → 🖥️）。',
        '步骤4：应用代码执行实际工具（🖥️）。',
        '步骤5：工具结果以 role:tool 回传（🖥️ → 🧠）。',
        '步骤6：LLM 生成最终自然语言回答（🧠 → 🖥️ → 👤）。'
    ];

    let idx = 0;

    function setRoleActive(user, app, llm) {
        roleUser.style.opacity = user ? '1' : '0.45';
        roleApp.style.opacity = app ? '1' : '0.45';
        roleLlm.style.opacity = llm ? '1' : '0.45';
    }

    function paint() {
        steps.forEach((s, i) => {
            if (i < idx - 1) {
                s.style.opacity = '0.65';
                s.style.borderColor = 'rgba(22,163,74,0.35)';
            } else if (i === idx - 1) {
                s.style.opacity = '1';
                s.style.borderColor = 'rgba(124,58,237,0.45)';
            } else {
                s.style.opacity = '0.42';
                s.style.borderColor = 'var(--card-border)';
            }
        });

        if (idx === 0) setRoleActive(true, true, true);
        if (idx === 1) setRoleActive(true, true, false);
        if (idx === 2 || idx === 3) setRoleActive(false, true, true);
        if (idx === 4 || idx === 5) setRoleActive(false, true, false);
        if (idx === 6) setRoleActive(true, true, true);

        desc.textContent = msgs[idx];
        btn.textContent = idx >= steps.length ? '↺ 重置' : '▶ 下一步';
    }

    btn.onclick = function() {
        idx += 1;
        if (idx > steps.length) idx = 0;
        paint();
    };

    paint();
};

/* ── S028: 串行 vs 并行进度竞赛 ── */
window.slideHooks['S028-serial-vs-parallel.html'] = function() {
    const startBtn = document.getElementById('sp-start-btn');
    const desc = document.getElementById('sp-desc');
    const sFills = Array.from(document.querySelectorAll('.serial-bar .bar-fill'));
    const pFills = Array.from(document.querySelectorAll('.parallel-bar .bar-fill'));
    if (!startBtn || !desc || !sFills.length || !pFills.length) return;

    let timers = [];
    function safeTimeout(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
    function clearTimers() { timers.forEach((id) => clearTimeout(id)); timers = []; }
    window._slideCleanup = clearTimers;

    function reset() {
        sFills.forEach((f) => { f.style.width = '0%'; });
        pFills.forEach((f) => { f.style.width = '0%'; });
        desc.textContent = '准备就绪：点击开始对比。';
        startBtn.textContent = '▶ 开始对比';
    }

    function fillBar(fillEl, duration, delay) {
        if (window.gsap) {
            window.gsap.set(fillEl, { width: '0%' });
            window.gsap.to(fillEl, { width: '100%', duration: duration, delay: delay, ease: 'none' });
        } else {
            safeTimeout(() => { fillEl.style.width = '100%'; }, delay * 1000);
        }
    }

    function run() {
        clearTimers();
        reset();
        desc.textContent = '对比中：并行组同时执行，串行组逐个执行。';
        startBtn.textContent = '↺ 重置后重播';

        fillBar(sFills[0], 0.8, 0.0);
        fillBar(sFills[1], 0.8, 0.85);
        fillBar(sFills[2], 0.8, 1.70);

        fillBar(pFills[0], 0.8, 0.0);
        fillBar(pFills[1], 0.8, 0.0);
        fillBar(pFills[2], 0.8, 0.0);

        safeTimeout(() => {
            desc.textContent = '结论：Parallel Function Calling 在多工具场景下可显著缩短总耗时。';
        }, 2650);
    }

    startBtn.onclick = run;
    reset();
};
