"""Tests for core agent loop with mocked LLM."""

import json
from unittest.mock import Mock, patch
import pytest

from harness.core import run_agent, dispatch_tool
from harness.config import HarnessConfig


@patch("harness.core.OpenAI")
def test_agent_loop_basic(mock_openai_class):
    """Test basic agent loop with no tool calls."""
    # Mock OpenAI client
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Mock LLM response
    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = "任务完成"
    mock_message.tool_calls = None
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    # Run agent
    config = HarnessConfig(max_steps=5, api_key="test", base_url="http://test")
    result = run_agent("测试任务", {}, config)

    # Verify
    assert result["steps"] == 1
    assert "任务完成" in result["answer"]
    assert result["errors"] == []


@patch("harness.core.OpenAI")
def test_agent_loop_with_tool_call(mock_openai_class):
    """Test agent loop with single tool call."""
    # Mock OpenAI client
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Mock tool
    def mock_tool(query: str) -> str:
        return json.dumps({"result": f"搜索结果: {query}"})

    tools = {"search": mock_tool}

    # Mock LLM responses (2 turns)
    # Turn 1: call tool
    mock_tool_call = Mock()
    mock_tool_call.id = "call_123"
    mock_tool_call.function.name = "search"
    mock_tool_call.function.arguments = '{"query": "test"}'

    mock_response1 = Mock()
    mock_choice1 = Mock()
    mock_message1 = Mock()
    mock_message1.content = ""
    mock_message1.tool_calls = [mock_tool_call]
    mock_choice1.message = mock_message1
    mock_response1.choices = [mock_choice1]

    # Turn 2: final answer
    mock_response2 = Mock()
    mock_choice2 = Mock()
    mock_message2 = Mock()
    mock_message2.content = "搜索完成"
    mock_message2.tool_calls = None
    mock_choice2.message = mock_message2
    mock_response2.choices = [mock_choice2]

    mock_client.chat.completions.create.side_effect = [mock_response1, mock_response2]

    # Run agent
    config = HarnessConfig(max_steps=5, api_key="test", base_url="http://test")
    result = run_agent("搜索任务", tools, config)

    # Verify
    assert result["steps"] == 2
    assert "搜索完成" in result["answer"]
    assert result["errors"] == []


@patch("harness.core.OpenAI")
def test_agent_loop_tool_error(mock_openai_class):
    """Test agent loop with tool execution error."""
    # Mock OpenAI client
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Mock tool that raises error
    def failing_tool() -> str:
        raise ValueError("Tool failed")

    tools = {"failing_tool": failing_tool}

    # Mock LLM responses
    mock_tool_call = Mock()
    mock_tool_call.id = "call_123"
    mock_tool_call.function.name = "failing_tool"
    mock_tool_call.function.arguments = "{}"

    mock_response1 = Mock()
    mock_choice1 = Mock()
    mock_message1 = Mock()
    mock_message1.content = ""
    mock_message1.tool_calls = [mock_tool_call]
    mock_choice1.message = mock_message1
    mock_response1.choices = [mock_choice1]

    mock_response2 = Mock()
    mock_choice2 = Mock()
    mock_message2 = Mock()
    mock_message2.content = "处理错误"
    mock_message2.tool_calls = None
    mock_choice2.message = mock_message2
    mock_response2.choices = [mock_choice2]

    mock_client.chat.completions.create.side_effect = [mock_response1, mock_response2]

    # Run agent
    config = HarnessConfig(max_steps=5, api_key="test", base_url="http://test")
    result = run_agent("测试任务", tools, config)

    # Verify
    assert result["steps"] == 2
    assert len(result["errors"]) == 1
    assert "Tool execution failed" in result["errors"][0]


@patch("harness.core.OpenAI")
def test_agent_loop_max_steps(mock_openai_class):
    """Test agent loop reaches max steps."""
    # Mock OpenAI client
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Mock LLM always returns tool call
    mock_tool_call = Mock()
    mock_tool_call.id = "call_123"
    mock_tool_call.function.name = "dummy"
    mock_tool_call.function.arguments = "{}"

    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = ""
    mock_message.tool_calls = [mock_tool_call]
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]

    mock_client.chat.completions.create.return_value = mock_response

    # Run agent with max_steps=3
    config = HarnessConfig(max_steps=3, api_key="test", base_url="http://test")
    result = run_agent("测试任务", {"dummy": lambda: "ok"}, config)

    # Verify
    assert result["steps"] == 3
    assert "Max steps reached" in result["answer"]


def test_dispatch_tool_success():
    """Test successful tool dispatch."""
    def test_tool(x: int, y: int) -> str:
        return json.dumps({"sum": x + y})

    tools = {"test_tool": test_tool}
    result = dispatch_tool("test_tool", {"x": 1, "y": 2}, tools)

    result_obj = json.loads(result)
    assert result_obj["sum"] == 3


def test_dispatch_tool_not_found():
    """Test tool not found error."""
    result = dispatch_tool("nonexistent", {}, {})
    result_obj = json.loads(result)
    assert "error" in result_obj
    assert "not found" in result_obj["error"]


def test_dispatch_tool_execution_error():
    """Test tool execution error."""
    def failing_tool():
        raise RuntimeError("Boom")

    tools = {"failing_tool": failing_tool}
    result = dispatch_tool("failing_tool", {}, tools)

    result_obj = json.loads(result)
    assert "error" in result_obj
    assert "Boom" in result_obj["error"]
