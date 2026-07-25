"""Tests for verifier."""

from harness.verifier import get_verification_prompt, SYSTEM_PROMPT_WITH_VERIFICATION


def test_get_verification_prompt():
    """Test getting verification prompt."""
    prompt = get_verification_prompt()

    assert isinstance(prompt, str)
    assert len(prompt) > 0
    assert "verification" in prompt.lower() or "verify" in prompt.lower()


def test_verification_prompt_content():
    """Test verification prompt contains key guidance."""
    prompt = SYSTEM_PROMPT_WITH_VERIFICATION

    # Check for key concepts
    assert "tool" in prompt.lower()
    assert "verify" in prompt.lower()
    assert "accurate" in prompt.lower() or "accuracy" in prompt.lower()


def test_verification_prompt_structure():
    """Test verification prompt has structured guidance."""
    prompt = SYSTEM_PROMPT_WITH_VERIFICATION

    # Should have multiple lines
    lines = prompt.strip().split("\n")
    assert len(lines) > 5

    # Should mention verification checklist
    assert "checklist" in prompt.lower() or "verify" in prompt.lower()
