"""Tests for verify_by_pytest and verify_python_code (真执行验证层)."""

import textwrap

from harness.verifier import verify_by_pytest, verify_python_code


def test_verify_pytest_passes_for_good_tests(tmp_path):
    """所有断言通过时 passed=True, exit_code=0。"""
    test_file = tmp_path / "test_good.py"
    test_file.write_text(textwrap.dedent("""
        def test_one():
            assert 1 + 1 == 2

        def test_two():
            assert "hello".upper() == "HELLO"
    """), encoding="utf-8")

    result = verify_by_pytest(str(test_file))
    assert result["passed"] is True
    assert result["exit_code"] == 0
    assert result["passed_count"] == 2
    assert result["failed_count"] == 0


def test_verify_pytest_catches_failure(tmp_path):
    """断言失败时 passed=False，返回有用的 stdout。"""
    test_file = tmp_path / "test_bad.py"
    test_file.write_text(textwrap.dedent("""
        def test_one():
            assert 1 + 1 == 2

        def test_two():
            assert 0 == 1, "bad math"
    """), encoding="utf-8")

    result = verify_by_pytest(str(test_file))
    assert result["passed"] is False
    assert result["exit_code"] != 0
    assert result["passed_count"] == 1
    assert result["failed_count"] == 1
    assert "bad math" in result["stdout"] or "AssertionError" in result["stdout"]


def test_verify_pytest_catches_import_error(tmp_path):
    """测试文件本身有 import error 时也能捕获。"""
    test_file = tmp_path / "test_bad_import.py"
    test_file.write_text("import nonexistent_module_xyz_12345\n\ndef test_one(): pass", encoding="utf-8")

    result = verify_by_pytest(str(test_file))
    assert result["passed"] is False


def test_verify_pytest_timeout(tmp_path):
    """测试超时时返回 timeout 结果。"""
    test_file = tmp_path / "test_slow.py"
    test_file.write_text(textwrap.dedent("""
        import time
        def test_slow():
            time.sleep(10)
    """), encoding="utf-8")

    result = verify_by_pytest(str(test_file), timeout=2)
    assert result["passed"] is False
    assert result["exit_code"] == -1
    assert "timeout" in result["stderr"].lower() or "TIMEOUT" in result["summary"]


def test_verify_pytest_truncates_long_stdout(tmp_path):
    """stdout 超过 2000 字符应被截断，避免污染 LLM context。"""
    test_file = tmp_path / "test_noisy.py"
    test_file.write_text(textwrap.dedent("""
        def test_noisy():
            for i in range(1000):
                print(f"line {i} XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    """), encoding="utf-8")

    result = verify_by_pytest(str(test_file))
    assert len(result["stdout"]) <= 2000


def test_verify_python_code_runs_snippet():
    """verify_python_code 真跑一段代码并捕获 stdout。"""
    code = textwrap.dedent("""
        x = 1 + 2
        print(f"result={x}")
    """)
    result = verify_python_code(code)
    assert result["passed"] is True
    assert "result=3" in result["stdout"]


def test_verify_python_code_catches_exception():
    """verify_python_code 捕获运行时异常。"""
    code = "raise ValueError('expected failure')"
    result = verify_python_code(code)
    assert result["passed"] is False
    assert "ValueError" in result["stderr"]
    assert "expected failure" in result["stderr"]


def test_verify_python_code_syntax_error():
    """verify_python_code 能识别语法错误。"""
    code = "def (:\n    pass"
    result = verify_python_code(code)
    assert result["passed"] is False
    assert "SyntaxError" in result["stderr"]


def test_verify_pytest_supports_extra_args(tmp_path):
    """extra_args 能过滤特定测试。"""
    test_file = tmp_path / "test_filter.py"
    test_file.write_text(textwrap.dedent("""
        def test_a():
            assert 1 == 1

        def test_b():
            assert 1 == 1

        def test_c():
            assert 1 == 1
    """), encoding="utf-8")

    result = verify_by_pytest(str(test_file), extra_args=["-k", "test_b"])
    assert result["passed"] is True
    assert result["passed_count"] == 1  # 只跑了 test_b
