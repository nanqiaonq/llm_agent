"""Tests for ProgressTracker."""

import tempfile
from pathlib import Path

from harness.progress import ProgressTracker
from harness.hooks import HookManager


def test_progress_tracker_writes_session_start(tmp_path):
    """session_start hook 写入目标信息。"""
    log = tmp_path / "progress.md"
    tracker = ProgressTracker(str(log))
    tracker.on_session_start("重构 main.py 去重")

    content = log.read_text(encoding="utf-8")
    assert "Session" in content
    assert "started at" in content
    assert "重构 main.py 去重" in content


def test_progress_tracker_writes_tool_calls(tmp_path):
    """每次 post_tool_use 写入一条包含 tool 名和结果的日志。"""
    log = tmp_path / "progress.md"
    tracker = ProgressTracker(str(log))

    tracker.on_session_start("demo")
    tracker.on_post_tool_use("read_file", {"path": "a.txt"}, "hello world")
    tracker.on_post_tool_use("write_file", {"path": "b.txt", "content": "x"}, "ok")

    content = log.read_text(encoding="utf-8")
    assert "tool=read_file" in content
    assert "tool=write_file" in content
    assert "hello world" in content
    # entry count increments
    assert "step 1" in content
    assert "step 2" in content


def test_progress_tracker_truncates_long_results(tmp_path):
    """超长 result 必须截断，防止 progress.md 失控膨胀。"""
    log = tmp_path / "progress.md"
    tracker = ProgressTracker(str(log), max_content_len=50)

    long_result = "A" * 500
    tracker.on_post_tool_use("tool_x", {"key": "v"}, long_result)

    content = log.read_text(encoding="utf-8")
    # 全文 500 个 A 不应该整段写入
    assert "A" * 500 not in content
    assert "truncated" in content
    assert "total 500 chars" in content


def test_progress_tracker_session_stop_writes_summary(tmp_path):
    """session_stop 写入结束总结，包含 steps/tokens/errors。"""
    log = tmp_path / "progress.md"
    tracker = ProgressTracker(str(log))

    tracker.on_session_stop(
        answer="任务完成",
        metrics={"steps": 5, "tokens": 1234, "errors": ["err1"]},
    )

    content = log.read_text(encoding="utf-8")
    assert "ended at" in content
    assert "steps: 5" in content
    assert "tokens: 1234" in content
    assert "errors: 1" in content


def test_progress_tracker_integrates_with_hooks(tmp_path):
    """register_to 把 tracker 正确挂到 HookManager 三个事件。"""
    log = tmp_path / "progress.md"
    tracker = ProgressTracker(str(log))
    hooks = HookManager()
    tracker.register_to(hooks)

    hooks.trigger("session_start", "goal-1")
    hooks.trigger("post_tool_use", "read_file", {"p": "x"}, "file content")
    hooks.trigger("session_stop", "done", {"steps": 3, "tokens": 100, "errors": []})

    content = log.read_text(encoding="utf-8")
    assert "goal-1" in content
    assert "tool=read_file" in content
    assert "final answer: done" in content


def test_progress_tracker_read_recent_returns_last_session(tmp_path):
    """read_recent(1) 能拿到最后一个 session 的完整记录。"""
    log = tmp_path / "progress.md"

    tracker1 = ProgressTracker(str(log))
    tracker1.on_session_start("old goal")
    tracker1.on_session_stop("old done", {"steps": 1, "tokens": 10, "errors": []})

    tracker2 = ProgressTracker(str(log))
    tracker2.on_session_start("new goal")
    tracker2.on_post_tool_use("tool_y", {"x": 1}, "new result")
    tracker2.on_session_stop("new done", {"steps": 2, "tokens": 20, "errors": []})

    recent = tracker2.read_recent(n_sessions=1)
    # The last session should contain new markers
    assert "new goal" in recent or "tool_y" in recent or "new done" in recent


def test_progress_tracker_creates_parent_dir(tmp_path):
    """父目录不存在时 tracker 应自动创建。"""
    log = tmp_path / "nested" / "deeply" / "progress.md"
    tracker = ProgressTracker(str(log))
    tracker.on_session_start("goal")

    assert log.exists()
    assert "Session" in log.read_text(encoding="utf-8")
