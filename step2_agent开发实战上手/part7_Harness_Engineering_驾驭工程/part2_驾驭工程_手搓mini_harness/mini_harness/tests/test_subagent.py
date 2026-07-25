"""Tests for subagent delegation."""

import json
from unittest.mock import Mock, patch
import pytest

from harness.subagent import delegate
from harness.config import HarnessConfig


@patch("harness.subagent.run_agent")
def test_delegate_basic(mock_run_agent):
    """Test basic subagent delegation."""
    # Mock subagent result
    mock_run_agent.return_value = {
        "answer": "Subtask completed",
        "steps": 2,
        "errors": [],
    }

    config = HarnessConfig(api_key="test", base_url="http://test")
    result_str = delegate("Complete subtask", config=config)

    result = json.loads(result_str)
    assert result["success"] is True
    assert "Subtask completed" in result["answer"]
    assert result["steps"] == 2


@patch("harness.subagent.run_agent")
def test_delegate_with_context(mock_run_agent):
    """Test delegation with context."""
    mock_run_agent.return_value = {
        "answer": "Done",
        "steps": 1,
        "errors": [],
    }

    config = HarnessConfig(api_key="test", base_url="http://test")
    result_str = delegate(
        goal="Analyze data",
        context="Previous results: [1, 2, 3]",
        config=config,
    )

    result = json.loads(result_str)
    assert result["success"] is True

    # Check that context was passed to run_agent
    call_args = mock_run_agent.call_args
    assert "Previous results" in call_args[1]["user_goal"]


@patch("harness.subagent.run_agent")
def test_delegate_with_tool_filtering(mock_run_agent):
    """Test delegation with tool filtering."""
    mock_run_agent.return_value = {
        "answer": "Done",
        "steps": 1,
        "errors": [],
    }

    # Available tools
    def tool1():
        return "tool1"

    def tool2():
        return "tool2"

    def tool3():
        return "tool3"

    available_tools = {"tool1": tool1, "tool2": tool2, "tool3": tool3}

    config = HarnessConfig(api_key="test", base_url="http://test")
    result_str = delegate(
        goal="Use specific tools",
        tools=["tool1", "tool2"],  # Only allow tool1 and tool2
        available_tools=available_tools,
        config=config,
    )

    result = json.loads(result_str)
    assert result["success"] is True

    # Check that only specified tools were passed
    call_args = mock_run_agent.call_args
    subagent_tools = call_args[1]["tools"]
    assert "tool1" in subagent_tools
    assert "tool2" in subagent_tools
    assert "tool3" not in subagent_tools


@patch("harness.subagent.run_agent")
def test_delegate_error_handling(mock_run_agent):
    """Test delegation error handling."""
    # Mock subagent failure
    mock_run_agent.side_effect = RuntimeError("Subagent failed")

    config = HarnessConfig(api_key="test", base_url="http://test")
    result_str = delegate("Failing task", config=config)

    result = json.loads(result_str)
    assert result["success"] is False
    assert "error" in result
    assert "Subagent failed" in result["error"]


@patch("harness.subagent.run_agent")
def test_delegate_with_errors(mock_run_agent):
    """Test delegation when subagent has errors."""
    # Mock subagent with errors
    mock_run_agent.return_value = {
        "answer": "Partial completion",
        "steps": 3,
        "errors": ["Tool X failed", "Retry succeeded"],
    }

    config = HarnessConfig(api_key="test", base_url="http://test")
    result_str = delegate("Task with errors", config=config)

    result = json.loads(result_str)
    assert result["success"] is True
    assert len(result["errors"]) == 2
    assert "Tool X failed" in result["errors"]
