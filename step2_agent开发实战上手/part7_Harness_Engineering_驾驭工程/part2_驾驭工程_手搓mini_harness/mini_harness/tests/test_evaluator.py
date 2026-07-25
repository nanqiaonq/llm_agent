"""Tests for evaluator."""

import json
from unittest.mock import Mock, patch
import pytest

from harness.evaluator import evaluate
from harness.config import HarnessConfig


def test_evaluate_no_candidates():
    """Test evaluation with no candidates."""
    config = HarnessConfig(api_key="test", base_url="http://test")
    result = evaluate([], config=config)

    assert result["best_index"] == -1
    assert result["scores"] == []


def test_evaluate_single_candidate():
    """Test evaluation with single candidate."""
    config = HarnessConfig(api_key="test", base_url="http://test")
    result = evaluate(["Solution A"], config=config)

    assert result["best_index"] == 0
    assert result["scores"] == [1.0]


@patch("harness.evaluator.OpenAI")
def test_evaluate_multiple_candidates(mock_openai_class):
    """Test evaluation with multiple candidates."""
    # Mock OpenAI client
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Mock LLM response
    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = json.dumps(
        {
            "scores": [0.8, 0.9, 0.6],
            "best_index": 1,
            "reasoning": "Candidate 2 is most correct",
        }
    )
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    # Run evaluation
    config = HarnessConfig(api_key="test", base_url="http://test")
    candidates = ["Solution A", "Solution B", "Solution C"]
    result = evaluate(candidates, rubric="correctness", config=config)

    # Verify
    assert result["best_index"] == 1
    assert result["scores"] == [0.8, 0.9, 0.6]
    assert "Candidate 2" in result["reasoning"]


@patch("harness.evaluator.OpenAI")
def test_evaluate_with_custom_rubric(mock_openai_class):
    """Test evaluation with custom rubric."""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = json.dumps(
        {"scores": [0.7, 0.8], "best_index": 1, "reasoning": "More efficient"}
    )
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    config = HarnessConfig(api_key="test", base_url="http://test")
    candidates = ["Slow solution", "Fast solution"]
    result = evaluate(candidates, rubric="efficiency", config=config)

    # Check that rubric was used in prompt
    call_args = mock_client.chat.completions.create.call_args
    messages = call_args[1]["messages"]
    prompt = messages[1]["content"]
    assert "efficiency" in prompt.lower()


@patch("harness.evaluator.OpenAI")
def test_evaluate_invalid_json_response(mock_openai_class):
    """Test evaluation with invalid JSON response."""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    # Mock invalid JSON response
    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = "This is not valid JSON"
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    config = HarnessConfig(api_key="test", base_url="http://test")
    candidates = ["A", "B"]
    result = evaluate(candidates, config=config)

    # Should fallback gracefully
    assert result["best_index"] == 0
    assert len(result["scores"]) == 2
    assert "Failed to parse" in result["reasoning"]


@patch("harness.evaluator.OpenAI")
def test_evaluate_temperature_setting(mock_openai_class):
    """Test that evaluation uses lower temperature."""
    mock_client = Mock()
    mock_openai_class.return_value = mock_client

    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = json.dumps(
        {"scores": [0.5, 0.5], "best_index": 0, "reasoning": "Equal"}
    )
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    config = HarnessConfig(api_key="test", base_url="http://test", temperature=0.9)
    evaluate(["A", "B"], config=config)

    # Check that temperature was overridden to 0.3
    call_args = mock_client.chat.completions.create.call_args
    assert call_args[1]["temperature"] == 0.3
