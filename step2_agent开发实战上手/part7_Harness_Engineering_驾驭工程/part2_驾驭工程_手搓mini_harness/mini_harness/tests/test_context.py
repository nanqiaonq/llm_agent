"""Tests for context management."""

import pytest
from harness.context import compress_if_needed, estimate_tokens


def test_estimate_tokens():
    """Test token estimation."""
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello world"},
    ]

    tokens = estimate_tokens(messages)
    # Rough estimate: ~50 chars / 4 = ~12 tokens
    assert tokens > 0
    assert tokens < 100


def test_compress_no_compression_needed():
    """Test no compression when under threshold."""
    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "User message"},
        {"role": "assistant", "content": "Assistant response"},
    ]

    result = compress_if_needed(messages, threshold=10000)
    assert len(result) == len(messages)
    assert result == messages


def test_compress_too_few_messages():
    """Test no compression when too few messages."""
    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "User message"},
    ]

    # Force compression with low threshold
    result = compress_if_needed(messages, threshold=1)
    # Should not compress (too few messages)
    assert len(result) == len(messages)


def test_compress_with_compression():
    """Test compression when threshold exceeded."""
    # Create 20 messages
    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "User message"},
    ]

    # Add 16 middle messages
    for i in range(16):
        messages.append(
            {
                "role": "assistant",
                "content": f"Response {i}",
                "tool_calls": [
                    {
                        "id": f"call_{i}",
                        "function": {"name": "tool", "arguments": "{}"},
                    }
                ],
            }
        )
        messages.append({"role": "tool", "tool_call_id": f"call_{i}", "content": "ok"})

    # Add 2 recent messages
    messages.append({"role": "assistant", "content": "Recent response"})
    messages.append({"role": "user", "content": "Recent user message"})

    # Force compression
    result = compress_if_needed(messages, threshold=1)

    # Should have: 2 head + 1 summary + 6 tail = 9 messages
    assert len(result) < len(messages)
    assert len(result) == 9

    # Check structure
    assert result[0]["role"] == "system"
    assert result[1]["role"] == "user"
    assert result[2]["role"] == "system"  # Summary
    assert "[Context Summary]" in result[2]["content"]

    # Check tail preserved
    assert result[-1]["content"] == "Recent user message"


def test_compress_preserves_head_and_tail():
    """Test that compression preserves head and tail messages."""
    messages = [
        {"role": "system", "content": "System"},
        {"role": "user", "content": "User"},
    ]

    # Add 10 middle messages
    for i in range(10):
        messages.append({"role": "assistant", "content": f"Middle {i}"})

    # Add 6 tail messages
    for i in range(6):
        messages.append({"role": "user", "content": f"Tail {i}"})

    result = compress_if_needed(messages, threshold=1)

    # Check head
    assert result[0]["content"] == "System"
    assert result[1]["content"] == "User"

    # Check tail
    assert result[-1]["content"] == "Tail 5"
    assert result[-2]["content"] == "Tail 4"
