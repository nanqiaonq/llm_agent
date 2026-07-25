"""Integration example demonstrating core mechanisms."""

from unittest.mock import Mock, patch
import json

from harness.config import HarnessConfig
from harness.core import run_agent
from harness.planner import todo_tool, reset_todos
from harness.context import compress_if_needed
from harness.verifier import SYSTEM_PROMPT_WITH_VERIFICATION


def create_mock_response(content: str, tool_calls=None):
    """Helper to create mock LLM response."""
    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = content
    mock_message.tool_calls = tool_calls
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    return mock_response


@patch("harness.core.OpenAI")
def test_full_agent_workflow(mock_openai_class):
    """
    Integration test: Agent uses TODO tool to plan and execute task.

    Workflow:
    1. Agent creates TODO list
    2. Agent marks tasks as in_progress
    3. Agent completes tasks
    4. Agent returns final answer
    """
    reset_todos()

    # Mock OpenAI client
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Define tools
    tools = {"todo": todo_tool}

    # Mock conversation flow
    # Turn 1: Create TODO list
    mock_tool_call_1 = Mock()
    mock_tool_call_1.id = "call_1"
    mock_tool_call_1.function.name = "todo"
    mock_tool_call_1.function.arguments = json.dumps({
        "todos": [
            {"id": "1", "content": "分析需求", "status": "pending"},
            {"id": "2", "content": "设计方案", "status": "pending"},
            {"id": "3", "content": "实现代码", "status": "pending"},
        ],
        "merge": False
    })

    response_1 = create_mock_response("", tool_calls=[mock_tool_call_1])

    # Turn 2: Start first task
    mock_tool_call_2 = Mock()
    mock_tool_call_2.id = "call_2"
    mock_tool_call_2.function.name = "todo"
    mock_tool_call_2.function.arguments = json.dumps({
        "todos": [{"id": "1", "content": "分析需求", "status": "in_progress"}],
        "merge": True
    })

    response_2 = create_mock_response("", tool_calls=[mock_tool_call_2])

    # Turn 3: Complete first task
    mock_tool_call_3 = Mock()
    mock_tool_call_3.id = "call_3"
    mock_tool_call_3.function.name = "todo"
    mock_tool_call_3.function.arguments = json.dumps({
        "todos": [{"id": "1", "content": "分析需求", "status": "completed"}],
        "merge": True
    })

    response_3 = create_mock_response("", tool_calls=[mock_tool_call_3])

    # Turn 4: Final answer
    response_4 = create_mock_response("任务规划完成，已创建3个任务并完成第一个任务")

    mock_client.chat.completions.create.side_effect = [
        response_1,
        response_2,
        response_3,
        response_4,
    ]

    # Run agent
    config = HarnessConfig(max_steps=10, api_key="test", base_url="http://test")
    result = run_agent(
        user_goal="创建项目任务规划",
        tools=tools,
        config=config,
        system_prompt=SYSTEM_PROMPT_WITH_VERIFICATION,
    )

    # Verify results
    assert result["steps"] == 4
    assert "任务规划完成" in result["answer"]
    assert result["errors"] == []

    # Verify TODO state
    todos_result = todo_tool()
    todos = json.loads(todos_result)
    assert len(todos) == 3
    assert todos[0]["status"] == "completed"
    assert todos[1]["status"] == "pending"
    assert todos[2]["status"] == "pending"

    print("✓ Full workflow test passed")
    print(f"  Steps: {result['steps']}")
    print(f"  Answer: {result['answer']}")
    print(f"  TODOs: {len(todos)} tasks created")


@patch("harness.core.OpenAI")
def test_context_compression_integration(mock_openai_class):
    """
    Integration test: Context compression in long conversation.
    """
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Create long message history
    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "Initial request"},
    ]

    # Add 20 middle messages
    for i in range(20):
        messages.append({"role": "assistant", "content": f"Step {i}"})

    # Add recent messages
    messages.extend([
        {"role": "assistant", "content": "Recent step 1"},
        {"role": "user", "content": "Recent question"},
        {"role": "assistant", "content": "Recent answer"},
    ])

    # Test compression (use very low threshold to force compression)
    compressed = compress_if_needed(messages, threshold=1)

    # Verify compression happened
    assert len(compressed) < len(messages)

    # Verify structure preserved
    assert compressed[0]["role"] == "system"
    assert compressed[1]["role"] == "user"
    assert any("[Context Summary]" in msg.get("content", "") for msg in compressed)
    assert compressed[-1]["content"] == "Recent answer"

    print("✓ Context compression test passed")
    print(f"  Original: {len(messages)} messages")
    print(f"  Compressed: {len(compressed)} messages")
    print(f"  Reduction: {len(messages) - len(compressed)} messages")


if __name__ == "__main__":
    print("Running integration tests...\n")
    test_full_agent_workflow()
    print()
    test_context_compression_integration()
    print("\n✓ All integration tests passed!")
