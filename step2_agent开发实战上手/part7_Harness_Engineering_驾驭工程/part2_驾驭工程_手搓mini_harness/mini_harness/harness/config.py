"""Harness 框架配置管理 —— 集中管理 LLM 连接参数与运行上限。"""

from dataclasses import dataclass
from typing import Optional
import os


@dataclass
class HarnessConfig:
    """Harness Agent 运行核心配置。"""

    max_steps: int = 50           # Agent 最大迭代轮次（硬刹车）
    max_tokens: int = 100000      # 单次 LLM 调用最大 token 数
    context_threshold: int = 12000  # 超过此 token 估算值触发 context 压缩
    model_name: str = "deepseek/deepseek-chat"  # 通过 OpenRouter 调用的模型 ID
    api_key: Optional[str] = None   # OpenRouter API Key
    base_url: Optional[str] = None  # OpenRouter 接入点 URL
    temperature: float = 0.7        # 生成温度，0=确定性，>0.7 更发散

    @classmethod
    def from_env(cls) -> "HarnessConfig":
        """从环境变量加载配置（优先级：环境变量 > 默认值）。"""
        return cls(
            model_name=os.getenv("MODEL_NAME", "deepseek/deepseek-chat"),
            api_key=os.getenv("OPENROUTER_API_KEY"),       # 必须设置，否则 validate() 报错
            base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        )

    def validate(self) -> None:
        """校验配置合法性（调用 run_agent 前的前置检查）。"""
        if not self.api_key:
            raise ValueError("API key is required")
        if not self.base_url:
            raise ValueError("Base URL is required")
        if self.max_steps <= 0:
            raise ValueError("max_steps must be positive")
        if self.max_tokens <= 0:
            raise ValueError("max_tokens must be positive")
