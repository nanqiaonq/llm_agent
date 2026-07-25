"""
Permission Gate — 权限守门

机制：⑨ Permission Gate
救死因：⑥ 没刹车（agent 误执行 rm -rf 无人拦截）
官方出处：Anthropic Claude Code pre_tool_use hook / OpenAI Codex sandbox policy

三条核心策略：
1. Deny-first：默认拒绝不明确、不安全、不可审计的动作
2. 危险命令检测：正则黑名单（简化版；生产建议 AST 解析）
3. Defer 审批：关键决策挂起等人类确认（本实现留钩子，课堂演示不强跑）

最小实现：
- 通过 hook 机制挂载到 pre_tool_use 事件
- 仅检查 run_bash / execute_shell 类工具的命令字符串
- 匹配到黑名单返回 (False, reason)，由 HookManager.trigger_gate 转为 veto
"""

import re
from typing import Any, Dict, List, Optional, Tuple


# 生产级建议：AST 解析 + allowlist-only，本实现为教学级黑名单
DEFAULT_DANGEROUS_PATTERNS: List[str] = [
    r"\brm\s+-rf\b",          # rm -rf 递归删除
    r"\brm\s+-fr\b",          # rm -fr 等价写法
    r"\bsudo\s+",             # 提权执行
    r"\bDROP\s+TABLE\b",      # SQL 删表（忽略大小写）
    r"\bDROP\s+DATABASE\b",   # SQL 删库
    r"\bTRUNCATE\s+TABLE\b",  # SQL 清表
    r">\s*/etc/",             # 写入系统目录
    r"\bchmod\s+777\b",       # 全权限
    r"curl\s+.+\|\s*(?:bash|sh|zsh)\b",  # curl | sh 远程执行
    r"wget\s+.+\|\s*(?:bash|sh|zsh)\b",  # wget | sh 同上
    r"\bdd\s+if=",            # dd 裸写磁盘
    r":\(\)\s*\{",            # fork bomb 起始 :(){
    r"\bmkfs\b",              # 格式化文件系统
    r">\s*/dev/sd[a-z]",      # 写入块设备
]

# 默认拦截的工具名（白名单模式）
DEFAULT_GUARDED_TOOLS = ("run_bash", "execute_shell", "bash", "shell", "sh")


class PermissionGate:
    """
    权限守门实现。

    使用方式：
        gate = PermissionGate()
        hooks = HookManager()
        gate.register_to(hooks)
        run_agent(goal, tools, config, hooks=hooks)

    扩展：
        自定义 patterns：PermissionGate(patterns=["my_regex"])
        自定义守卫工具：PermissionGate(guarded_tools=("run_bash", "execute"))
    """

    def __init__(
        self,
        patterns: Optional[List[str]] = None,
        guarded_tools: Optional[tuple] = None,
        extra_patterns: Optional[List[str]] = None,
    ):
        """
        Args:
            patterns: 完全替换默认的危险模式列表
            guarded_tools: 完全替换默认的守卫工具元组
            extra_patterns: 在默认列表基础上追加的额外模式
        """
        base_patterns = patterns if patterns is not None else DEFAULT_DANGEROUS_PATTERNS
        if extra_patterns:
            base_patterns = list(base_patterns) + list(extra_patterns)

        self.patterns = [re.compile(p, re.IGNORECASE) for p in base_patterns]
        self.guarded_tools = guarded_tools if guarded_tools is not None else DEFAULT_GUARDED_TOOLS
        self.blocked_log: List[Dict[str, Any]] = []

    def register_to(self, hooks) -> None:
        """挂载到 HookManager 的 pre_tool_use（gate 事件）。"""
        hooks.register("pre_tool_use", self.check)

    def check(
        self,
        tool_name: str = "",
        tool_args: Dict[str, Any] = None,
    ) -> Tuple[bool, str]:
        """
        检查 tool call 是否危险。

        Returns:
            (True, "ok") 放行
            (False, reason) 拦截，reason 包含匹配的模式便于定位
        """
        # 只守卫指定工具
        if tool_name not in self.guarded_tools:
            return True, "ok"

        # 提取命令字符串（兼容不同 arg key）
        cmd = ""
        if isinstance(tool_args, dict):
            for key in ("command", "cmd", "script", "code"):
                if key in tool_args:
                    cmd = str(tool_args[key])
                    break

        if not cmd:
            return True, "ok (empty command)"

        # 逐个匹配
        for p in self.patterns:
            if p.search(cmd):
                self.blocked_log.append({
                    "tool": tool_name,
                    "command": cmd,
                    "matched_pattern": p.pattern,
                })
                return False, f"[PERMISSION DENIED] 危险命令被拦截: {cmd[:100]} (matched pattern: {p.pattern})"

        return True, "ok"

    def stats(self) -> Dict[str, Any]:
        """返回统计信息，便于课件展示。"""
        return {
            "total_blocked": len(self.blocked_log),
            "patterns_count": len(self.patterns),
            "blocked_log": self.blocked_log,
        }
