"""Context 压缩管理 —— 三段保护策略，超限后压缩中间消息。

设计思路：
  当 messages 积累过多时，token 数量会逼近模型上限。
  本模块采用"三段切割"策略：
    - head（前 2 条）：系统提示 + 首个用户消息，绝对不压缩
    - tail（后 6 条）：最近的上下文，保持完整以维持连贯性
    - middle（中间段）：有损压缩为一条摘要消息，节省 token
"""

import json
from typing import List, Dict


def compress_if_needed(
    messages: List[Dict], threshold: int = 12000
) -> List[Dict]:
    """
    当消息历史的估算 token 数超过阈值时，对中间段执行压缩。

    压缩策略（三段保护）：
      - head：前 2 条消息（system prompt + 首个 user）→ 完整保留
      - tail：后 6 条消息（最近上下文）         → 完整保留
      - middle：中间所有消息                    → 有损压缩为摘要

    Args:
        messages:  完整消息列表
        threshold: 触发压缩的 token 上限（默认 12000）

    Returns:
        压缩后的消息列表（未超限时原样返回）
    """
    # 先估算当前消息总 token 数
    token_count = estimate_tokens(messages)

    # 未超过阈值 → 无需压缩，直接返回原列表
    if token_count < threshold:
        return messages

    # 消息数 ≤ 8 时，中间段极短，压缩收益小于信息损失，放弃压缩
    if len(messages) <= 8:
        return messages

    # ── 三段切割 ────────────────────────────────────────────────
    # head：system prompt + 首个 user 消息（锚定任务背景，不可丢失）
    head = messages[:2]

    # tail：最近 6 条消息（保留 LLM 当前推理的直接上下文）
    tail = messages[-6:]

    # middle：两端之间的全部消息，作为有损压缩对象
    middle = messages[2:-6]

    # ── 生成摘要 ────────────────────────────────────────────────
    # 把 middle 压缩成一段统计摘要文本（工具名 + 调用次数）
    summary_content = _summarize_middle(middle)

    # 将摘要封装为 system 角色消息，插回消息链
    # 使用 system 角色是因为它不占 user/assistant 对话轮次，语义最贴切
    summary_msg = {
        "role": "system",
        "content": f"[Context Summary]\n{summary_content}",
    }

    # 拼装最终结果：head + 摘要 + tail
    return head + [summary_msg] + tail


def estimate_tokens(messages: List[Dict]) -> int:
    """
    估算消息列表的 token 数量（快速启发式，不调用 tokenizer）。

    计算方式：累加所有消息的 content + tool_calls 字符总数，除以 4。
    依据：英文平均 4 字符 ≈ 1 token（GPT tokenizer 经验值）。
    中文字符实际约 1~2 字符/token，此处统一用 4 作保守估计。

    Args:
        messages: 消息列表

    Returns:
        估算的 token 数（整数）
    """
    total_chars = 0
    for msg in messages:
        # content 是正文（str 或 None）
        content = msg.get("content", "")
        # tool_calls 是工具调用信息（list 或 None），转 str 后计算长度
        tool_calls = msg.get("tool_calls", "")
        total_chars += len(str(content)) + len(str(tool_calls))

    # 粗估启发式：4 字符 ≈ 1 token（英文尺度）
    return total_chars // 4


def _summarize_middle(middle: List[Dict]) -> str:
    """
    对中间段消息生成统计摘要（私有函数，仅供 compress_if_needed 调用）。

    有损压缩原则：
      - 保留：消息数量、工具调用次数、使用过的工具名称
      - 丢弃：工具的完整返回内容、对话原文（节省 token 的关键）

    Args:
        middle: 需要压缩的中间段消息列表

    Returns:
        格式化的摘要字符串
    """
    # 分类统计各角色的消息数量
    tool_calls = 0      # 工具调用总次数（一条 assistant 消息可含多个 tool_call）
    tool_results = 0    # 工具返回结果条数（role=tool 的消息数）
    assistant_msgs = 0  # assistant 消息总条数

    for msg in middle:
        role = msg.get("role")
        if role == "assistant":
            assistant_msgs += 1
            # tool_calls 字段是一个列表，len() 得到本条消息的调用次数
            if msg.get("tool_calls"):
                tool_calls += len(msg["tool_calls"])
        elif role == "tool":
            # role="tool" 表示工具调用的返回结果
            tool_results += 1

    # 拼装摘要头部：数量统计信息
    summary = f"""
    Previous conversation compressed ({len(middle)} messages):
    - Assistant messages: {assistant_msgs}
    - Tool calls executed: {tool_calls}
    - Tool results received: {tool_results}

    Key actions taken in compressed section:
    """

    # ── 提取工具名称列表（有损压缩的核心）──────────────────────
    # 只保留"用了哪些工具"，不保留工具的输入参数和返回内容
    # 使用 set 自动去重，sorted 保证输出顺序稳定
    tool_names = set()
    for msg in middle:
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                # tool_call 可能是 dict（原始格式）或对象，这里只处理 dict
                if isinstance(tc, dict):
                    # 取 function.name，不存在时 fallback 为 "unknown"
                    tool_names.add(tc.get("function", {}).get("name", "unknown"))

    # 若存在工具调用记录，追加工具名列表
    if tool_names:
        summary += "- Tools used: " + ", ".join(sorted(tool_names)) + "\n"

    # strip() 去掉首尾多余空白，保持摘要消息整洁
    return summary.strip()
