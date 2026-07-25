#!/usr/bin/env bash
# 一键启动 gstack-agent CLI（无需 pip install）。
#
# 用法：
#   ./gstack_agent/run.sh              # 默认启动
#   ./gstack_agent/run.sh --no-hitl    # 关闭 HITL 审批（仅 demo）
#   ./gstack_agent/run.sh --no-viz     # 关闭实时打印
#
# 自动处理：
#   1. cwd 切到 Harness-DeepAgents/
#   2. PYTHONPATH 包含项目根，让 `import gstack_agent` 可工作
#   3. 优先用 harness conda env（如有），否则用系统 python3
set -euo pipefail

PROJ_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$PROJ_ROOT"

# 优先用 harness conda env 的 python（与课件 Notebook 一致）
HARNESS_PY="/opt/anaconda3/envs/harness/bin/python"
if [[ -x "$HARNESS_PY" ]]; then
    PYTHON="$HARNESS_PY"
else
    PYTHON="$(command -v python3 || command -v python)"
fi

echo "[run.sh] cwd       = $PROJ_ROOT"
echo "[run.sh] python    = $PYTHON"
echo "[run.sh] launching gstack-agent CLI..."
echo ""

PYTHONPATH="$PROJ_ROOT:${PYTHONPATH:-}" exec "$PYTHON" -m gstack_agent "$@"
