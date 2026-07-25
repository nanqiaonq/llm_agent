"""Generator-Evaluator 模式 —— 用 LLM 对多个候选答案打分并选出最优项。"""

import json
from typing import List, Dict
from openai import OpenAI

from .config import HarnessConfig


def evaluate(
    candidates: List[str],
    rubric: str = "correctness",
    config: HarnessConfig = None,
) -> Dict:
    """
    Evaluate multiple candidate solutions.

    Args:
        candidates: List of candidate solutions to evaluate
        rubric: Evaluation criteria (e.g., "correctness", "efficiency", "clarity")
        config: Harness configuration

    Returns:
        Dictionary with:
        - best_index: Index of best candidate
        - scores: List of scores (0-1 scale)
        - reasoning: Explanation of evaluation
    """
    if config is None:
        config = HarnessConfig.from_env()

    if not candidates:
        return {
            "best_index": -1,
            "scores": [],
            "reasoning": "No candidates provided",
        }

    # 单候选短路：无需调用 LLM，直接返回
    if len(candidates) == 1:
        return {
            "best_index": 0,
            "scores": [1.0],
            "reasoning": "Only one candidate available",
        }

    # 构建评估 prompt：将所有候选项拼接到同一个请求，减少 LLM 调用次数
    prompt = f"""Evaluate the following {len(candidates)} candidate solutions based on: {rubric}

"""
    for i, candidate in enumerate(candidates):
        prompt += f"Candidate {i + 1}:\n{candidate}\n\n"

    prompt += f"""
Please evaluate each candidate on a scale of 0-1 based on {rubric}.
Return your evaluation in JSON format:
{{
    "scores": [score1, score2, ...],
    "best_index": index_of_best,
    "reasoning": "explanation"
}}
"""

    # 调用 LLM 进行客观评估（temperature=0.3 确保评分稳定）
    client = OpenAI(api_key=config.api_key, base_url=config.base_url)

    response = client.chat.completions.create(
        model=config.model_name,
        messages=[
            {
                "role": "system",
                "content": "You are an expert evaluator. Provide objective assessments in JSON format.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,  # 评分务用低温度，确保结果一致性
    )

    result_text = response.choices[0].message.content

    # 解析 JSON 返回；失败时降级为第一个候选项（避免抛出异常）
    try:
        result = json.loads(result_text)
        return {
            "best_index": result.get("best_index", 0),
            "scores": result.get("scores", [0.5] * len(candidates)),
            "reasoning": result.get("reasoning", ""),
        }
    except json.JSONDecodeError:
        # 降级：返回第一个候选项、均分、错误原因
        return {
            "best_index": 0,
            "scores": [0.5] * len(candidates),
            "reasoning": f"Failed to parse evaluation result: {result_text}",
        }
