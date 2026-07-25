"""Tests for planner (TODO management)."""

import json
import pytest

from harness.planner import todo_tool, reset_todos


def test_todo_query_empty():
    """Test querying empty TODO list."""
    reset_todos()
    result = todo_tool()
    todos = json.loads(result)
    assert todos == []


def test_todo_replace_mode():
    """Test replacing TODO list."""
    reset_todos()

    new_todos = [
        {"id": "1", "content": "Task 1", "status": "pending"},
        {"id": "2", "content": "Task 2", "status": "in_progress"},
    ]

    result = todo_tool(todos=new_todos, merge=False)
    todos = json.loads(result)

    assert len(todos) == 2
    assert todos[0]["id"] == "1"
    assert todos[1]["status"] == "in_progress"


def test_todo_merge_mode_add_new():
    """Test merging new todos."""
    reset_todos()

    # Initial todos
    initial = [{"id": "1", "content": "Task 1", "status": "pending"}]
    todo_tool(todos=initial, merge=False)

    # Merge new todo
    new_todos = [{"id": "2", "content": "Task 2", "status": "pending"}]
    result = todo_tool(todos=new_todos, merge=True)
    todos = json.loads(result)

    assert len(todos) == 2
    assert todos[0]["id"] == "1"
    assert todos[1]["id"] == "2"


def test_todo_merge_mode_update_existing():
    """Test merging updates existing todo."""
    reset_todos()

    # Initial todos
    initial = [
        {"id": "1", "content": "Task 1", "status": "pending"},
        {"id": "2", "content": "Task 2", "status": "pending"},
    ]
    todo_tool(todos=initial, merge=False)

    # Update task 1
    updates = [{"id": "1", "content": "Task 1 Updated", "status": "completed"}]
    result = todo_tool(todos=updates, merge=True)
    todos = json.loads(result)

    assert len(todos) == 2
    assert todos[0]["content"] == "Task 1 Updated"
    assert todos[0]["status"] == "completed"
    assert todos[1]["id"] == "2"  # Task 2 unchanged


def test_todo_status_transitions():
    """Test TODO status transitions."""
    reset_todos()

    # Create todo
    todos = [{"id": "1", "content": "Task", "status": "pending"}]
    todo_tool(todos=todos, merge=False)

    # Start task
    updates = [{"id": "1", "content": "Task", "status": "in_progress"}]
    todo_tool(todos=updates, merge=True)
    result = todo_tool()
    current = json.loads(result)
    assert current[0]["status"] == "in_progress"

    # Complete task
    updates = [{"id": "1", "content": "Task", "status": "completed"}]
    todo_tool(todos=updates, merge=True)
    result = todo_tool()
    current = json.loads(result)
    assert current[0]["status"] == "completed"


def test_todo_multiple_operations():
    """Test multiple TODO operations in sequence."""
    reset_todos()

    # Add 3 tasks
    todos = [
        {"id": "1", "content": "Task 1", "status": "pending"},
        {"id": "2", "content": "Task 2", "status": "pending"},
        {"id": "3", "content": "Task 3", "status": "pending"},
    ]
    todo_tool(todos=todos, merge=False)

    # Complete task 1, start task 2
    updates = [
        {"id": "1", "content": "Task 1", "status": "completed"},
        {"id": "2", "content": "Task 2", "status": "in_progress"},
    ]
    todo_tool(todos=updates, merge=True)

    # Verify
    result = todo_tool()
    current = json.loads(result)
    assert len(current) == 3
    assert current[0]["status"] == "completed"
    assert current[1]["status"] == "in_progress"
    assert current[2]["status"] == "pending"
