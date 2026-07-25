#!/usr/bin/env python3
"""Hermes 课件第一章 MVP - LangChain 1.x 三件套+Store 实战的可运行 Python 版本。

对应 lesson.ipynb §1.5 末尾「💻 阶段实战」的完整代码骨架。
演示 langchain 1.x 的 create_agent + AgentMiddleware + @tool + Store 三件套+一架构，
模拟 Hermes 默认记忆链路的**三件套骨架**（middleware 注入 + @tool + Store）。

教学边界：本 MVP 冷记忆侧仅复现 SQLite 持久化 + 朴素 LIKE 检索，
**不含** FTS5 双索引（见 §1.3 fts5 demo）与命中后 LLM 摘要
（见 §1.4 summarize_session_with_deepseek）。session_search 工具返回
raw preview，等价于真 Hermes 在 LLM 不可用时的 fallback 分支语义。

依赖（harness conda 环境）：
    langchain==1.2.15
    langchain-deepseek==1.0.1
    langgraph==1.1.10
    python-dotenv

运行：
    cd research
    python test_memory_mvp.py

环境变量：
    DEEPSEEK_API_KEY 从 ~/.claude/.env 自动加载
"""

# ===== Imports =====
# 标准库
import importlib.metadata
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any

# 第三方
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    ModelRequest,
    dynamic_prompt,
)
from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from langchain_deepseek import ChatDeepSeek
from langgraph.prebuilt import InjectedStore
from langgraph.store.base import (
    BaseStore,
    GetOp,
    Item,
    ListNamespacesOp,
    PutOp,
    SearchItem,
    SearchOp,
)

# ===== Step 1: 环境准备 =====
load_dotenv("/Users/mac/.claude/.env")  # 加载 DeepSeek API key
lc_ver = importlib.metadata.version("langchain")
lg_ver = importlib.metadata.version("langgraph")
print(f"langchain={lc_ver}  langgraph={lg_ver}")
print(
    "DEEPSEEK_API_KEY:",
    "已加载" if os.getenv("DEEPSEEK_API_KEY") else "未找到（请检查 .env）",
)

# 本次脚本运行的全局会话 ID — 对应 Hermes messages 表 session_id 列
# 每次脚本启动生成新值，让 session_history namespace 内不同次运行的消息隔离开
SESSION_ID = uuid.uuid4().hex[:8]
print(f"SESSION_ID={SESSION_ID}（本次会话标识）")


# ===== Step 2: SimpleSqliteStore（自实现 BaseStore 子类）=====


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


BIZ_NAMESPACES = {("user_profile",), ("session_history",)}


class SimpleSqliteStore(BaseStore):
    """最小可用的 SQLite BaseStore 子类，用于 MVP 演示记忆链路。"""

    def __init__(self, db_path: str = ":memory:") -> None:
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS store "
            "(namespace TEXT, key TEXT, value TEXT, "
            "created_at TEXT, updated_at TEXT, PRIMARY KEY(namespace, key))"
        )
        self.conn.commit()

    def batch(self, ops: list) -> list:
        """路由四种 Op 到对应的 SQLite 操作。"""
        results = []
        for op in ops:
            if isinstance(op, PutOp):
                ns = json.dumps(list(op.namespace), ensure_ascii=False)
                if op.value is None:
                    self.conn.execute(
                        "DELETE FROM store WHERE namespace=? AND key=?",
                        (ns, op.key),
                    )
                    self.conn.commit()
                    if op.namespace in BIZ_NAMESPACES:
                        print(f"   [SQL Delete] DELETE FROM store WHERE ns={list(op.namespace)} AND key={op.key!r}")
                    results.append(None)
                    continue
                val = json.dumps(op.value, ensure_ascii=False)
                now_str = _now().isoformat()
                self.conn.execute(
                    "INSERT OR REPLACE INTO store"
                    "(namespace, key, value, created_at, updated_at) VALUES (?,?,?,?,?)",
                    (ns, op.key, val, now_str, now_str)
                )
                self.conn.commit()
                if op.namespace in BIZ_NAMESPACES:
                    print(f"   [SQL Put] INSERT INTO store ns={list(op.namespace)} key={op.key!r}")
                results.append(None)
            elif isinstance(op, GetOp):
                ns = json.dumps(list(op.namespace), ensure_ascii=False)
                row = self.conn.execute(
                    "SELECT value, created_at, updated_at FROM store "
                    "WHERE namespace=? AND key=?",
                    (ns, op.key)
                ).fetchone()
                if row:
                    results.append(Item(
                        namespace=op.namespace,
                        key=op.key,
                        value=json.loads(row[0]),
                        created_at=datetime.fromisoformat(row[1]),
                        updated_at=datetime.fromisoformat(row[2]),
                    ))
                else:
                    results.append(None)
            elif isinstance(op, SearchOp):
                if op.namespace_prefix in BIZ_NAMESPACES:
                    print(f"   [SQL Search] SELECT * FROM store WHERE ns={list(op.namespace_prefix)} AND value LIKE '%{op.query}%' LIMIT {op.limit}")
                # LIKE 匹配 namespace 前缀
                ns_prefix = json.dumps(list(op.namespace_prefix), ensure_ascii=False)
                # 去掉末尾的 ] 做前缀 LIKE
                ns_like = ns_prefix.rstrip("]").rstrip() + "%"
                query = op.query or ""
                rows = self.conn.execute(
                    "SELECT namespace, key, value, created_at, updated_at "
                    "FROM store WHERE namespace LIKE ?",
                    (ns_like,)
                ).fetchall()
                matched = []
                for r_ns, r_key, r_val, r_ca, r_ua in rows:
                    if not query or query.lower() in r_val.lower():
                        matched.append(SearchItem(
                            namespace=tuple(json.loads(r_ns)),
                            key=r_key,
                            value=json.loads(r_val),
                            created_at=datetime.fromisoformat(r_ca),
                            updated_at=datetime.fromisoformat(r_ua),
                            score=None,
                        ))
                if op.namespace_prefix in BIZ_NAMESPACES:
                    print(f"   [SQL Search 结果] ns={list(op.namespace_prefix)} 命中 {len(matched[op.offset: op.offset + op.limit])} 条")
                results.append(matched[op.offset: op.offset + op.limit])
            elif isinstance(op, ListNamespacesOp):
                rows = self.conn.execute(
                    "SELECT DISTINCT namespace FROM store"
                ).fetchall()
                namespaces = [tuple(json.loads(r[0])) for r in rows]
                results.append(namespaces[op.offset: op.offset + op.limit])
            else:
                results.append(None)
        return results

    async def abatch(self, ops: list) -> list:
        """异步接口直接转发到同步 batch（教学最简实现）。"""
        return self.batch(ops)


store = SimpleSqliteStore("./mvp_memory.db")
print("store ready:", type(store).__name__)


# ===== Step 3: hot_memory_inject 中间件（热记忆注入）=====
# 准备 MEMORY.md 文件
Path("MEMORY.md").write_text("# 用户画像\n（待 agent 填充）\n", encoding="utf-8")
print("MEMORY.md 已创建")


@dynamic_prompt
def hot_memory_inject(request: ModelRequest) -> SystemMessage:
    """两路热记忆注入：MEMORY.md + store user_profile namespace。"""
    # 路径一：读 MEMORY.md
    mem_file = Path("MEMORY.md")
    md_content = mem_file.read_text(encoding="utf-8") if mem_file.exists() else ""

    # 路径二：从 store 检索 user_profile
    profile_facts = ""
    if request.runtime and request.runtime.store:
        items = request.runtime.store.search(("user_profile",), query="", limit=20)
        if items:
            facts = [f"- {i.key}: {i.value.get('fact', '')}" for i in items]
            profile_facts = "\n[store 已知事实]\n" + "\n".join(facts)

    content = f"[hot mem] 用户画像\n{md_content}{profile_facts}"
    # 打印注入内容作为教学观察点——展示 middleware 确实在每轮触发
    print(f"[hot_memory_inject 触发] 注入内容前 80 字符: {repr(content[:80])}")
    return SystemMessage(content=content)


print("hot_memory_inject 已定义:", type(hot_memory_inject).__name__)


# ===== Step 4: SessionPersistenceMiddleware（会话持久化）=====


class SessionPersistenceMiddleware(AgentMiddleware):
    """会话持久化中间件——模拟 Hermes messages 表的自动同步 + session 隔离。

    每轮 agent 执行结束，把 HumanMessage 写到 store 的 session_history namespace。
    对应 §1.2 讲过的 SQLite messages 表 schema：
      - SESSION_ID 模拟 `session_id TEXT NOT NULL` 列（每次脚本启动一个新 session）
      - _seq 模拟 `id INTEGER PRIMARY KEY AUTOINCREMENT` 列（同 session 内自增）
      - key 格式 `{session_id}_seq_{n}` 让相同 content 跨 session/turn 不撞键
        ——append-only，与 Hermes 哲学一致（不去重，重复内容靠 session_id 隔离）。
    """

    def __init__(self):
        super().__init__()
        self._seq = 0  # 实例级 sequence —— 避免跨实例污染
        self._persisted_msg_ids: set[int] = set()  # 已持久化 message id 去重

    def after_agent(self, state, runtime):
        store = runtime.store
        if store is None:
            return None
        written = 0
        for msg in state["messages"]:
            if msg.type == "human":
                if id(msg) in self._persisted_msg_ids:
                    continue
                self._persisted_msg_ids.add(id(msg))
                self._seq += 1
                key = f"{SESSION_ID}_seq_{self._seq}"
                store.put(("session_history",), key, {
                    "session_id": SESSION_ID,
                    "seq": self._seq,
                    "content": msg.content,
                })
                written += 1
        print(f"[SessionPersist after_agent] session={SESSION_ID} 持久化 {written} 条 HumanMessage")
        return None


print("SessionPersistenceMiddleware 已定义:", SessionPersistenceMiddleware.__name__)


# ===== Step 5: @tool 工具定义 =====


@tool
def memory_save_fact(
    fact: str,
    key: str,
    store: Annotated[BaseStore, InjectedStore()],
) -> str:
    """把用户提到的事实保存到长期记忆。

    Args:
        fact: 事实描述
        key: 唯一键（用英文短词）
    """
    print(f"[memory_save_fact 调用] key={key!r} fact={fact[:40]!r}")
    store.put(("user_profile",), key, {"fact": fact})
    print(f"[memory_save_fact 完成] 已写入 namespace=('user_profile',)")
    return f"已保存到 user_profile/{key}"


@tool
def session_search(
    query: str,
    store: Annotated[BaseStore, InjectedStore()],
) -> str:
    """在历史 session 中按关键字检索。

    Args:
        query: 检索关键字
    """
    print(f"[session_search 调用] query={query!r} namespace=('session_history',)")
    items = store.search(("session_history",), query=query, limit=3)
    print(f"[session_search 命中] 返回 {len(items)} 条:")
    for i, it in enumerate(items, 1):
        print(f"   [{i}] key={it.key} value={it.value}")
    # 教学简化：直接返回 raw 拼接，等价于真 Hermes 摘要不可用时的 fallback。
    # 5 元素 LLM 摘要见 §1.4 独立 demo summarize_session_with_deepseek。
    return "\n".join(f"- {i.value}" for i in items) or "（无命中）"


print("tools defined:", memory_save_fact.name, session_search.name)


# ===== Step 6: create_agent 组装 =====
agent = create_agent(
    model=ChatDeepSeek(model="deepseek-chat", temperature=0),
    tools=[memory_save_fact, session_search],
    middleware=[hot_memory_inject, SessionPersistenceMiddleware()],
    store=store,  # 复用 Cell 5 的 SimpleSqliteStore
)
print("agent ready:", type(agent).__name__)


# ===== Step 7: Round 1 + Round 2 演示 =====
def main():
    """Round 1（写入路径）+ Round 2（注入路径 + 检索路径）双轮对话演示。"""
    # Round 1：写入偏好
    print("=" * 50)
    print("Round 1：写入偏好")
    result1 = agent.invoke({
        "messages": [{"role": "user", "content": "我喜欢喝美式咖啡，记一下"}]
    })
    print("Round 1 回复:", result1["messages"][-1].content[:200])

    # 打印 store 内容，验证写入路径
    print("\n--- store 内容（验证写入路径）---")
    for ns in store.list_namespaces():
        items = store.search(ns, query="", limit=10)
        for item in items:
            print(f"  {ns}/{item.key}: {item.value}")

    # Round 2：验证注入路径
    # 注意：hot_memory_inject 会在每次模型调用前打印触发日志
    # 这就是"SystemMessage 注入"的可观测证据
    print("\n" + "=" * 50)
    print("Round 2：验证注入路径（观察 hot_memory_inject 触发日志）")
    result2 = agent.invoke({
        "messages": [{"role": "user", "content": "我之前说我喜欢喝什么？"}]
    })

    # 打印 messages 链
    # 说明：langchain 1.x 的 SystemMessage 通过 middleware 注入给模型，
    # 不存入 state.messages，因此 messages 链只含 Human/AI/Tool 消息。
    # 中间件注入的证据是上方打印的 [hot_memory_inject 触发] 日志。
    print("\n--- messages 链 ---")
    for msg in result2["messages"]:
        mtype = type(msg).__name__
        content_preview = str(msg.content)[:100]
        print(f"  [{mtype}] {content_preview}")

    print("\nRound 2 最终回复:", result2["messages"][-1].content[:300])

    # Round 3：模拟"另一个 session 来问相同主题"——强制走冷记忆 session_search 路径
    # 通过临时清空 user_profile namespace + 用一个全新 SESSION_ID，
    # 让 hot 路径无内容可注入，模型不得不调 session_search 检索 session_history
    print("\n" + "=" * 50)
    print("Round 3：跨 session 检索路径（强制触发 session_search）")

    # 临时清空 user_profile，让 hot_memory_inject 注入空内容
    for item in store.search(("user_profile",), query="", limit=100):
        store.delete(("user_profile",), item.key)
    print("已清空 user_profile namespace（迫使模型走冷记忆检索）")

    result3 = agent.invoke({
        "messages": [{"role": "user", "content": "前几天聊过咖啡偏好相关的话，你能用 session_search 工具查一下吗？"}]
    })
    print("\nRound 3 最终回复:", result3["messages"][-1].content[:300])

    # 验证 session_search 是否真的被调用
    tool_calls_seen = []
    for msg in result3["messages"]:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                if name:
                    tool_calls_seen.append(name)
    print(f"\nRound 3 工具调用记录: {tool_calls_seen}")
    if "session_search" in tool_calls_seen:
        print("✅ 冷记忆检索路径已触发")
    else:
        print("⚠️  session_search 未被触发，可能模型仍用对话历史回答；可调整 prompt 或用强制工具")


if __name__ == "__main__":
    main()
