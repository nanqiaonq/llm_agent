"""L2 测试：heal 单元测试 + 真调 DeepSeek 端到端冒烟。

运行：
    cd Harness-DeepAgents
    PYTHONPATH=. /opt/anaconda3/envs/harness/bin/python -m gstack_agent.tests.test_heal_and_e2e

测试覆盖：
    [Unit-1] 健康序列 → heal 不动作（幂等）
    [Unit-2] 损坏序列（孤儿 AI(tc) + 错位 Tool）→ heal 重建为合规序列
    [Unit-3] heal 之后再 heal → 0 改动（幂等）
    [Unit-4] 仅有孤立 ToolMessage（无对应 AI tool_calls）→ 丢弃孤立 Tool
    [E2E-1]  真调 DeepSeek，--no-hitl，简单写文件任务，跑完无 BadRequestError
    [E2E-2]  E2E-1 之后追加一轮，验证连续 turn 不撞 BadRequestError
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile
import traceback
import uuid
from pathlib import Path

# 关 HITL + 关 visualizer，让测试输出干净
os.environ["GSTACK_AGENT_HITL"] = "0"
os.environ["GSTACK_AGENT_VISUALIZER"] = "0"
# 给 workspace 一个临时目录，避免污染用户家目录
_TMP_WS = tempfile.mkdtemp(prefix="gstack-test-")
os.environ["GSTACK_AGENT_WORKSPACE"] = _TMP_WS


def _setup_path() -> None:
    """让 import gstack_agent 工作（不依赖 pip install）."""
    proj_root = Path(__file__).resolve().parent.parent.parent
    if str(proj_root) not in sys.path:
        sys.path.insert(0, str(proj_root))


_setup_path()


from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, END, MessagesState, StateGraph

from gstack_agent.cli import (
    _heal_orphan_tool_calls,
    _is_seq_compliant,
    _msg_kind,
    _msg_tool_call_id,
    _msg_tool_calls,
)


_passed: list[str] = []
_failed: list[tuple[str, str]] = []


def _check(name: str, cond: bool, detail: str = "") -> None:
    if cond:
        _passed.append(name)
        print(f"  [PASS] {name}")
    else:
        _failed.append((name, detail))
        print(f"  [FAIL] {name}: {detail}")


def _make_dummy_graph():
    """造一个最小 graph 用于测试 heal — 不真跑 LLM."""
    def passthrough(state):
        return {"messages": []}
    g = StateGraph(MessagesState)
    g.add_node("step", passthrough)
    g.add_edge(START, "step")
    g.add_edge("step", END)
    return g.compile(checkpointer=InMemorySaver())


def _ids(msgs):
    """把 messages 序列化为 (kind, tool_call_id_or_first_tc_id, content_head) 方便对比."""
    out = []
    for m in msgs:
        kind = _msg_kind(m)
        if kind == "ai":
            tcs = _msg_tool_calls(m)
            tc_ids = [tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None) for tc in tcs]
            out.append((kind, tc_ids, str(m.content)[:20]))
        elif kind == "tool":
            out.append((kind, _msg_tool_call_id(m), str(m.content)[:30]))
        else:
            out.append((kind, None, str(m.content)[:20]))
    return out


# ============================================================
# Unit-1: 健康序列 heal 应当不动作
# ============================================================
def test_unit_1_healthy_seq_noop() -> None:
    print("\n[Unit-1] 健康序列 heal 不动作")
    graph = _make_dummy_graph()
    cfg = {"configurable": {"thread_id": "u1"}}
    seq = [
        HumanMessage(content="写 hello.txt"),
        AIMessage(content="", tool_calls=[{"name": "write_file", "args": {}, "id": "call_X"}]),
        ToolMessage(tool_call_id="call_X", content="ok", name="write_file"),
        AIMessage(content="done"),
    ]
    graph.update_state(cfg, {"messages": seq})
    n = _heal_orphan_tool_calls(graph, cfg, verbose=False)
    _check("Unit-1.healed_count_zero", n == 0, f"expected 0, got {n}")
    after = graph.get_state(cfg).values["messages"]
    _check("Unit-1.compliant", _is_seq_compliant(after))
    _check("Unit-1.length_unchanged", len(after) == 4, f"expected 4, got {len(after)}")


# ============================================================
# Unit-2: 损坏序列（孤儿 AI(tc) + 错位 Tool）
# ============================================================
def test_unit_2_orphan_rebuilt() -> None:
    print("\n[Unit-2] 损坏序列重建为合规")
    graph = _make_dummy_graph()
    cfg = {"configurable": {"thread_id": "u2"}}
    # 模拟实际场景：AI(tc=A) + Tool(A) 健康配对 → 然后 AI(tc=B) 孤儿（流中断）
    # → 然后 User(继续) 又来一条 → 再 AI(tc=C) 孤儿 → 末尾追加 Tool(B)（之前 heal bug 留下的错位）
    bad_seq = [
        HumanMessage(content="task1"),
        AIMessage(content="", tool_calls=[{"name": "f", "args": {}, "id": "call_A"}]),
        ToolMessage(tool_call_id="call_A", content="A done", name="f"),
        AIMessage(content="", tool_calls=[{"name": "g", "args": {}, "id": "call_B"}]),
        # ← 这里缺 Tool(B)
        HumanMessage(content="继续"),
        AIMessage(content="", tool_calls=[{"name": "h", "args": {}, "id": "call_C"}]),
        # ← 这里缺 Tool(C)
        ToolMessage(tool_call_id="call_B", content="B late", name="g"),  # 错位末尾
    ]
    graph.update_state(cfg, {"messages": bad_seq})
    pre = graph.get_state(cfg).values["messages"]
    _check("Unit-2.pre_not_compliant", not _is_seq_compliant(pre))

    n = _heal_orphan_tool_calls(graph, cfg, verbose=False)
    after = graph.get_state(cfg).values["messages"]
    _check("Unit-2.post_compliant", _is_seq_compliant(after),
           f"after = {_ids(after)}")
    # 应当：保留所有非 Tool 消息原顺序；Tool(B) 移到 AI(tc=B) 后；Tool(C) 用占位
    # 期望序列: Human(task1) AI(tc=A) Tool(A,A_done) AI(tc=B) Tool(B,B_late) Human(继续) AI(tc=C) Tool(C,<aborted>)
    seq_ids = _ids(after)
    _check("Unit-2.length_8", len(seq_ids) == 8, f"expected 8 messages, got {len(seq_ids)}")
    if len(seq_ids) >= 8:
        _check("Unit-2.first_human", seq_ids[0][0] == "human" and "task1" in seq_ids[0][2])
        _check("Unit-2.tool_A_after_AI_A", seq_ids[1][0] == "ai" and seq_ids[2][0] == "tool" and seq_ids[2][1] == "call_A")
        _check("Unit-2.tool_B_after_AI_B", seq_ids[3][0] == "ai" and seq_ids[4][0] == "tool" and seq_ids[4][1] == "call_B")
        _check("Unit-2.B_content_preserved", "B late" in seq_ids[4][2], f"got {seq_ids[4][2]!r}")
        _check("Unit-2.continue_human", seq_ids[5][0] == "human" and "继续" in seq_ids[5][2])
        _check("Unit-2.tool_C_aborted_placeholder",
               seq_ids[6][0] == "ai" and seq_ids[7][0] == "tool" and seq_ids[7][1] == "call_C"
               and "aborted" in seq_ids[7][2])
    # 报告 healed = 1（Tool(C) 占位）+ 0（孤立 Tool 计数：Tool(B) 找到了归属，没被丢弃）= 1
    _check("Unit-2.healed_count_1", n == 1, f"expected 1, got {n}")


# ============================================================
# Unit-3: heal 幂等
# ============================================================
def test_unit_3_idempotent() -> None:
    print("\n[Unit-3] heal 幂等（连续两次同输出）")
    graph = _make_dummy_graph()
    cfg = {"configurable": {"thread_id": "u3"}}
    bad = [
        AIMessage(content="", tool_calls=[{"name": "f", "args": {}, "id": "call_X"}]),
        HumanMessage(content="follow up"),
    ]
    graph.update_state(cfg, {"messages": bad})
    n1 = _heal_orphan_tool_calls(graph, cfg, verbose=False)
    after1 = _ids(graph.get_state(cfg).values["messages"])
    n2 = _heal_orphan_tool_calls(graph, cfg, verbose=False)
    after2 = _ids(graph.get_state(cfg).values["messages"])
    _check("Unit-3.first_heal_fixes", n1 == 1)
    _check("Unit-3.second_heal_noop", n2 == 0, f"expected 0, got {n2}")
    _check("Unit-3.seq_unchanged", after1 == after2)


# ============================================================
# Unit-3.5: 顺序颠倒 (codex BLOCK) — AI(tc=[A,B]) 后 Tool(B) Tool(A) 必须判不合规
# ============================================================
def test_unit_3_5_order_reversed() -> None:
    print("\n[Unit-3.5] 顺序颠倒判定为不合规并修复")
    graph = _make_dummy_graph()
    cfg = {"configurable": {"thread_id": "u35"}}
    bad = [
        AIMessage(content="", tool_calls=[
            {"name": "f", "args": {}, "id": "call_A"},
            {"name": "g", "args": {}, "id": "call_B"},
        ]),
        ToolMessage(tool_call_id="call_B", content="B first", name="g"),  # 顺序颠倒
        ToolMessage(tool_call_id="call_A", content="A second", name="f"),
    ]
    graph.update_state(cfg, {"messages": bad})
    pre = graph.get_state(cfg).values["messages"]
    _check("U3.5.pre_not_compliant", not _is_seq_compliant(pre),
           f"reversed order should fail: {_ids(pre)}")
    n = _heal_orphan_tool_calls(graph, cfg, verbose=False)
    after = graph.get_state(cfg).values["messages"]
    _check("U3.5.post_compliant", _is_seq_compliant(after),
           f"after = {_ids(after)}")
    # 重建后应该是: AI(tc=[A,B]) Tool(A,A_second) Tool(B,B_first)
    seq_ids = _ids(after)
    _check("U3.5.length_3", len(seq_ids) == 3, f"expected 3, got {len(seq_ids)}")
    if len(seq_ids) >= 3:
        _check("U3.5.tool_A_first", seq_ids[1][1] == "call_A")
        _check("U3.5.tool_B_second", seq_ids[2][1] == "call_B")
        _check("U3.5.content_preserved", "A second" in seq_ids[1][2] and "B first" in seq_ids[2][2])


# ============================================================
# Unit-3.6: 重复 tool_call_id (codex BLOCK) — 不应复用同一 ToolMessage
# ============================================================
def test_unit_3_6_duplicate_tool_call_id() -> None:
    print("\n[Unit-3.6] 重复 tool_call_id 用占位而不是复用")
    graph = _make_dummy_graph()
    cfg = {"configurable": {"thread_id": "u36"}}
    bad = [
        AIMessage(content="", tool_calls=[{"name": "f", "args": {}, "id": "call_X"}]),
        ToolMessage(tool_call_id="call_X", content="real X", name="f"),
        # 跨 AI 复用 call_X：第二条 AI 声明 call_X 但不配新 Tool
        AIMessage(content="", tool_calls=[{"name": "g", "args": {}, "id": "call_X"}]),
    ]
    graph.update_state(cfg, {"messages": bad})
    n = _heal_orphan_tool_calls(graph, cfg, verbose=False)
    after = graph.get_state(cfg).values["messages"]
    seq_ids = _ids(after)
    # 期望: AI(tc=X) Tool(X,real X) AI(tc=X) Tool(X,<aborted>) — 第二个占位而非复用
    _check("U3.6.post_compliant", _is_seq_compliant(after),
           f"after = {_ids(after)}")
    _check("U3.6.length_4", len(seq_ids) == 4, f"expected 4, got {len(seq_ids)}")
    if len(seq_ids) >= 4:
        # 第一个 Tool 保留真实内容，第二个是占位
        _check("U3.6.first_real_content", "real X" in seq_ids[1][2])
        _check("U3.6.second_placeholder", "aborted" in seq_ids[3][2],
               f"expected aborted, got {seq_ids[3][2]!r}")


# ============================================================
# Unit-4: 孤立 ToolMessage（无对应 AI tool_call）应被丢弃
# ============================================================
def test_unit_4_orphan_tool_dropped() -> None:
    print("\n[Unit-4] 孤立 ToolMessage 被丢弃")
    graph = _make_dummy_graph()
    cfg = {"configurable": {"thread_id": "u4"}}
    bad = [
        HumanMessage(content="hi"),
        ToolMessage(tool_call_id="ghost_id", content="orphan tool", name="?"),
        AIMessage(content="hello back"),
    ]
    graph.update_state(cfg, {"messages": bad})
    n = _heal_orphan_tool_calls(graph, cfg, verbose=False)
    after = graph.get_state(cfg).values["messages"]
    _check("Unit-4.orphan_tool_count_1", n == 1, f"expected 1 (orphan dropped), got {n}")
    _check("Unit-4.compliant", _is_seq_compliant(after))
    _check("Unit-4.length_2", len(after) == 2, f"expected 2 (Human+AI), got {len(after)}")


# ============================================================
# Unit-5: allowlist 层级匹配 + 文件操作三工具共享
# ============================================================
def test_unit_5_allowlist() -> None:
    print("\n[Unit-5] allowlist 层级匹配与共享命名空间")
    from gstack_agent.cli import (
        _allowlist_pattern,
        _matches_allowlist,
        _add_to_allowlist,
    )

    allowlist: dict[str, set[str]] = {}

    # 1. write_file 加入 allowlist
    added = _add_to_allowlist("write_file", {"file_path": "/hello.txt"}, allowlist)
    _check("U5.write_file_added", added == "/", f"got {added!r}")
    # 三工具都应该有 "/"
    _check("U5.shared_write", "/" in allowlist.get("write_file", set()))
    _check("U5.shared_edit", "/" in allowlist.get("edit_file", set()))
    _check("U5.shared_read", "/" in allowlist.get("read_file", set()))

    # 2. 层级前缀：/workspace/foo.html 应命中 "/"
    m = _matches_allowlist("write_file", {"file_path": "/workspace/foo.html"}, allowlist)
    _check("U5.prefix_match_workspace", m)

    # 3. 深层子目录
    m2 = _matches_allowlist("write_file", {"file_path": "/a/b/c/d.txt"}, allowlist)
    _check("U5.prefix_match_deep", m2)

    # 4. edit_file 共享命中
    m3 = _matches_allowlist("edit_file", {"path": "/any.txt"}, allowlist)
    _check("U5.edit_file_shared", m3)

    # 5. read_file 共享命中
    m4 = _matches_allowlist("read_file", {"file_path": "/deep/x.md"}, allowlist)
    _check("U5.read_file_shared", m4)

    # 6. shell_exec 不共享
    m5 = _matches_allowlist("shell_exec", {"command": "ls -la"}, allowlist)
    _check("U5.shell_exec_isolated", not m5)

    # 7. task 子代理不共享
    m6 = _matches_allowlist("task", {"subagent_type": "designer"}, allowlist)
    _check("U5.task_isolated", not m6)

    # 8. 精确匹配仍然工作（同目录）
    m7 = _matches_allowlist("write_file", {"file_path": "/hello.txt"}, allowlist)
    _check("U5.exact_match", m7)


# ============================================================
# E2E-1: 真调 DeepSeek 跑简单 prompt
# ============================================================
def test_e2e_1_real_deepseek_write_file() -> None:
    print("\n[E2E-1] 真调 DeepSeek，写一个文件")
    if not os.environ.get("DEEPSEEK_API_KEY"):
        # 从项目 .env 加载
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("  [SKIP] 无 DEEPSEEK_API_KEY，E2E 跳过")
        return

    # 延迟 import：build_graph 触发 deepagents 装配，需要 env vars 已就绪
    from gstack_agent.agent import build_graph
    from gstack_agent.cli import _stream_invoke

    ckpt = InMemorySaver()
    graph = build_graph(checkpointer=ckpt)
    thread_id = f"e2e-{uuid.uuid4().hex[:8]}"
    cfg = {"configurable": {"thread_id": thread_id}}

    prompt = (
        "请用 write_file 工具在 /hello.txt 写入内容 'hello from e2e test'，"
        "完成后用一句话确认即可。不要读取任何 SKILL.md。"
    )
    payload = {"messages": [{"role": "user", "content": prompt}]}

    err: Exception | None = None
    try:
        _stream_invoke(graph, payload, cfg, session_allowlist=None)
    except Exception as e:  # noqa: BLE001
        err = e
        traceback.print_exc()

    _check("E2E-1.no_exception", err is None, f"got {type(err).__name__ if err else None}: {err}")

    # 验证 state 序列合规
    state = graph.get_state(cfg)
    msgs = state.values.get("messages", []) if state and state.values else []
    _check("E2E-1.state_compliant", _is_seq_compliant(msgs), f"messages: {_ids(msgs)}")

    # 验证文件落盘到 workspace
    target_file = Path(_TMP_WS) / "hello.txt"
    _check(
        "E2E-1.file_written",
        target_file.exists(),
        f"expected {target_file} to exist, dir contents: {list(Path(_TMP_WS).iterdir())}",
    )
    if target_file.exists():
        content = target_file.read_text()
        _check("E2E-1.file_content_has_hello", "hello" in content.lower(),
               f"got: {content!r}")

    # ---- E2E-2 紧接着追加一轮，验证连续 turn 没有 BadRequestError ----
    print("\n[E2E-2] 紧跟一轮 follow-up，验证消息序列连续性")
    follow_payload = {"messages": [{"role": "user", "content": "刚才的 hello.txt 写完了吗？一句话回答。"}]}
    err2: Exception | None = None
    try:
        _stream_invoke(graph, follow_payload, cfg, session_allowlist=None)
    except Exception as e:  # noqa: BLE001
        err2 = e
        traceback.print_exc()
    _check("E2E-2.follow_no_exception", err2 is None,
           f"got {type(err2).__name__ if err2 else None}: {err2}")

    state2 = graph.get_state(cfg)
    msgs2 = state2.values.get("messages", []) if state2 and state2.values else []
    _check("E2E-2.state_compliant", _is_seq_compliant(msgs2),
           f"messages_len={len(msgs2)}")


def main() -> int:
    print("=" * 60)
    print(f"workspace = {_TMP_WS}")
    print("=" * 60)
    try:
        test_unit_1_healthy_seq_noop()
        test_unit_2_orphan_rebuilt()
        test_unit_3_idempotent()
        test_unit_3_5_order_reversed()
        test_unit_3_6_duplicate_tool_call_id()
        test_unit_4_orphan_tool_dropped()
        test_unit_5_allowlist()
        test_e2e_1_real_deepseek_write_file()
    finally:
        # 清理临时 workspace
        try:
            shutil.rmtree(_TMP_WS, ignore_errors=True)
        except Exception:
            pass

    print("\n" + "=" * 60)
    print(f"PASSED: {len(_passed)} / FAILED: {len(_failed)}")
    if _failed:
        print("\n失败用例：")
        for name, detail in _failed:
            print(f"  - {name}: {detail}")
        return 1
    print("ALL PASS ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
