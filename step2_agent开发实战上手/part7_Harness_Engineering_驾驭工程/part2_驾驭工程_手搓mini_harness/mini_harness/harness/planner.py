"""Agent 任务规划器 —— 提供 TODO 列表的增删查改工具，供 Agent 追踪子任务进度。"""

import json
from typing import List, Dict, Optional


# 全局 TODO 状态（进程内单例）；工具函数接口简洁，无需额外传参
TODOS: List[Dict] = []


def todo_tool(todos: Optional[List[Dict]] = None, merge: bool = False) -> str:
    """
    Manage TODO list for agent planning.

    Args:
        todos: List of todo items, each with {id, content, status}
              If None, returns current list
        merge: If True, merge with existing list; if False, replace

    Returns:
        JSON string of current TODO list

    Each todo item format:
    {
        "id": str,
        "content": str,
        "status": "pending" | "in_progress" | "completed"
    }
    """
    global TODOS

    if todos is None:
        # Query mode
        return json.dumps(TODOS, ensure_ascii=False, indent=2)

    # 更新模式
    if merge:
        # merge=True：按 id upsert（有则更新、无则追加），保留已有项
        existing_ids = {t["id"] for t in TODOS}
        for todo in todos:
            if todo["id"] in existing_ids:
                # 找到同 id 的项，原地替换
                for i, existing in enumerate(TODOS):
                    if existing["id"] == todo["id"]:
                        TODOS[i] = todo
                        break
            else:
                # 新 id，追加到末尾
                TODOS.append(todo)
    else:
        # merge=False：全量替换（Agent 重新规划时使用）
        TODOS = todos

    return json.dumps(TODOS, ensure_ascii=False, indent=2)


def reset_todos() -> None:
    """Reset TODO list (for testing)."""
    global TODOS
    TODOS = []
