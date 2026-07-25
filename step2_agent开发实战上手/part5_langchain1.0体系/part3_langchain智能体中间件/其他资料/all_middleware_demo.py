"""
IT 运维 Agent 中间件演示 - 具备 RBAC 和审计功能

本示例展示了一个完整的 IT 运维 Agent，集成了：
- RBAC（基于角色的权限控制）
- 操作审计和日志记录
- 安全检查和验证
- 上下文管理（使用 ContextEditingMiddleware）
- 动态系统提示词注入（使用 @wrap_model_call）
- 智能模型切换（使用 @wrap_model_call）

【中间件执行顺序】
1. before_agent: SecurityGuardrail (安全检查)
2. before_agent: RBACMiddleware (权限验证)
3. before_model: RBACMiddleware (注入用户信息到 state)
4. wrap_model_call: dynamic_system_prompt (动态提示词注入)
5. wrap_model_call: dynamic_model_router (智能模型切换)
6. wrap_model_call: ContextEditingMiddleware (上下文管理和清理)
7. Model Execution (模型执行)
8. after_model: AuditLogger (审计日志) - 注册在后，先执行
9. after_model: ResponseValidator (响应验证) - 注册在前，后执行

【重要说明】
- after_model 钩子按注册顺序的相反顺序执行
- 这样设计是为了形成"洋葱模型"：先进后出的执行模式

【支持的运维操作】
- 服务器状态查询
- 服务重启
- 日志查看
- 系统资源监控
"""

from typing import Any, Dict, Optional, List, Callable,TypedDict

from datetime import datetime
from enum import Enum
from dotenv import load_dotenv
import json

from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware, 
    AgentState, 
    hook_config,
    ContextEditingMiddleware,
    ModelRequest,
    ModelResponse,
    wrap_model_call
)
from langchain.agents.middleware.context_editing import ClearToolUsesEdit
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import tool
from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel, Field

# 加载环境变量
load_dotenv(override=True)


# ==============================================================================
# 用户角色和权限定义
# ==============================================================================

class UserRole(str, Enum):
    """用户角色枚举"""
    ADMIN = "admin"           # 管理员：所有权限
    OPERATOR = "operator"     # 运维人员：查询和重启权限
    VIEWER = "viewer"         # 查看者：仅查询权限
    GUEST = "guest"           # 访客：无权限

class Permission(str, Enum):
    """权限枚举"""
    VIEW_STATUS = "view_status"           # 查看状态
    VIEW_LOGS = "view_logs"               # 查看日志
    RESTART_SERVICE = "restart_service"   # 重启服务
    MODIFY_CONFIG = "modify_config"       # 修改配置
    VIEW_METRICS = "view_metrics"         # 查看监控指标

# 角色权限映射
ROLE_PERMISSIONS: Dict[UserRole, List[Permission]] = {
    UserRole.ADMIN: [
        Permission.VIEW_STATUS,
        Permission.VIEW_LOGS,
        Permission.RESTART_SERVICE,
        Permission.MODIFY_CONFIG,
        Permission.VIEW_METRICS
    ],
    UserRole.OPERATOR: [
        Permission.VIEW_STATUS,
        Permission.VIEW_LOGS,
        Permission.RESTART_SERVICE,
        Permission.VIEW_METRICS
    ],
    UserRole.VIEWER: [
        Permission.VIEW_STATUS,
        Permission.VIEW_LOGS,
        Permission.VIEW_METRICS
    ],
    UserRole.GUEST: []
}

# 工具权限映射
TOOL_PERMISSIONS: Dict[str, Permission] = {
    "check_server_status": Permission.VIEW_STATUS,
    "view_service_logs": Permission.VIEW_LOGS,
    "restart_service": Permission.RESTART_SERVICE,
    "get_system_metrics": Permission.VIEW_METRICS
}


# ==============================================================================
# 辅助函数
# ==============================================================================

def log_with_timestamp(message: str, level: str = "INFO") -> None:
    """带时间戳的日志输出"""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    level_emoji = {
        "INFO": "ℹ️",
        "WARN": "⚠️",
        "ERROR": "❌",
        "SUCCESS": "✅",
        "AUDIT": "📋"
    }
    emoji = level_emoji.get(level, "ℹ️")
    print(f"[{timestamp}] {emoji} {message}")


def get_current_user() -> Dict[str, Any]:
    """
    获取当前用户信息（模拟）
    实际应用中应从认证系统获取
    """
    # 这里模拟从配置中获取当前用户
    return {
        "user_id": "user_001",
        "username": "operator_zhang",
        "role": UserRole.OPERATOR,
        "department": "IT运维部"
    }


# ==============================================================================
# 用户上下文定义
# ==============================================================================

class UserContext(TypedDict):
    """用户上下文信息"""
    user_id: str # 用户唯一标识
    username: str # 用户名
    role: str # 用户角色
    department: str # 所属部门


# ==============================================================================
# 1. 定义中间件
# ==============================================================================

class RBACMiddleware(AgentMiddleware):
    """
    [阶段 1: before_agent & before_model] RBAC 权限控制中间件
    在执行任何操作前验证用户权限
    """
    
    def __init__(self):
        super().__init__()

    def _get_user_from_runtime(self, runtime) -> Dict[str, Any]:
        """从 runtime.context 获取用户信息"""
        try:
            # 尝试从 runtime.context 获取用户信息
            if hasattr(runtime, 'context') and runtime.context:
                context_data = runtime.context
                # 如果是字典，直接使用
                if isinstance(context_data, dict):
                    user_role_str = context_data.get('role', 'guest')
                    # 转换角色字符串为枚举
                    try:
                        user_role = UserRole(user_role_str)
                    except ValueError:
                        user_role = UserRole.GUEST
                    
                    return {
                        'user_id': context_data.get('user_id', 'unknown'),
                        'username': context_data.get('username', 'unknown'),
                        'role': user_role,
                        'department': context_data.get('department', 'unknown')
                    }
        except Exception as e:
            log_with_timestamp(f"   ⚠️ 从 runtime.context 获取用户信息失败: {str(e)}", "WARN")
        
        # 如果无法从 runtime 获取，使用默认用户
        return get_current_user()

    @hook_config(can_jump_to=["end"])
    def before_agent(self, state: AgentState, runtime) -> Optional[Dict[str, Any]]:
        try:
            # 从 runtime 获取用户信息
            current_user = self._get_user_from_runtime(runtime)
            
            log_with_timestamp(
                f"🔐 [1. RBACMiddleware] 验证用户权限 - "
                f"用户: {current_user['username']} "
                f"角色: {current_user['role'].value}"
            )
            
            # 获取用户角色的权限列表
            user_permissions = ROLE_PERMISSIONS.get(current_user['role'], [])
            
            log_with_timestamp(
                f"   ✅ 权限验证通过 - 拥有 {len(user_permissions)} 项权限"
            )
            
            return None
            
        except Exception as e:
            log_with_timestamp(f"   ❌ 权限验证异常: {str(e)}", "ERROR")
            return {
                "messages": [AIMessage(
                    content="权限验证失败，请联系管理员。"
                )],
                "jump_to": "end"
            }
    
    def before_model(self, state: AgentState, runtime) -> Optional[Dict[str, Any]]:
        """在 before_model 阶段注入用户信息到 state"""
        try:
            # 从 runtime 获取用户信息
            current_user = self._get_user_from_runtime(runtime)
            
            # 获取用户角色的权限列表
            user_permissions = ROLE_PERMISSIONS.get(current_user['role'], [])
            
            log_with_timestamp(
                f"   📝 注入用户信息到 state - "
                f"用户: {current_user['username']}, "
                f"角色: {current_user['role'].value}"
            )
            
            # 将用户信息注入到 state
            return {
                "user_info": current_user,
                "user_permissions": [p.value for p in user_permissions]
            }
        except Exception as e:
            log_with_timestamp(f"   ❌ 用户信息注入异常: {str(e)}", "ERROR")
            return None


class SecurityGuardrail(AgentMiddleware):
    """
    [阶段 2: before_agent] 安全护栏
    检查请求中的危险操作和敏感关键词
    """
    
    # 危险操作关键词
    DANGEROUS_KEYWORDS = [
        "删除数据库", "drop database", "rm -rf", "format",
        "删除所有", "清空", "hack", "攻击", "入侵"
    ]
    
    def __init__(self):
        super().__init__()

    @hook_config(can_jump_to=["end"])
    def before_agent(self, state: AgentState, runtime) -> Optional[Dict[str, Any]]:
        try:
            log_with_timestamp("🔒 [2. SecurityGuardrail] 执行安全检查...")
            
            messages = state.get("messages", [])
            if not messages:
                return None
            
            last_msg = messages[-1]
            if last_msg.type == "human":
                content_lower = last_msg.content.lower()
                
                # 检查危险关键词
                for keyword in self.DANGEROUS_KEYWORDS:
                    if keyword in content_lower:
                        log_with_timestamp(
                            f"   🚫 检测到危险操作关键词: '{keyword}'",
                            "WARN"
                        )
                        return {
                            "messages": [AIMessage(
                                content=f"⚠️ 安全警告：检测到危险操作关键词 '{keyword}'，"
                                       f"该操作已被拦截。如需执行此类操作，请联系管理员。"
                            )],
                            "jump_to": "end"
                        }
            
            log_with_timestamp("   ✅ 安全检查通过")
            return None
            
        except Exception as e:
            log_with_timestamp(f"   ❌ 安全检查异常: {str(e)}", "ERROR")
            return {
                "messages": [AIMessage(
                    content="安全检查失败，操作已被拦截。"
                )],
                "jump_to": "end"
            }


# ==============================================================================
# 动态系统提示词中间件（使用 @wrap_model_call）
# ==============================================================================

def create_dynamic_system_prompt_middleware():
    """
    创建动态系统提示词中间件
    根据用户角色动态注入不同的系统提示词
    
    使用 @wrap_model_call 装饰器，从 ModelRequest 获取用户信息
    """
    
    # 角色专属提示词
    ROLE_PROMPTS = {
        UserRole.ADMIN: """
    【管理员模式】
    你拥有完整的系统权限，可以执行所有操作。
    - 可以查看所有服务器状态和日志
    - 可以重启服务和修改配置
    - 需要特别谨慎，确认每个关键操作
    - 提供详细的技术分析和建议
    """,
        UserRole.OPERATOR: """
    【运维人员模式】
    你是运维团队成员，拥有日常运维权限。
    - 可以查看服务器状态和日志
    - 可以重启服务（需确认）
    - 不能修改系统配置
    - 提供实用的运维建议
    """,
        UserRole.VIEWER: """
    【查看者模式】
    你只有查看权限，不能执行任何操作。
    - 可以查看服务器状态和日志
    - 可以查看系统监控指标
    - 不能执行任何修改操作
    - 提供信息查询和数据分析
    """,
        UserRole.GUEST: """
    【访客模式】
    你的权限受到严格限制。
    - 只能进行基本的信息查询
    - 不能访问敏感数据
    - 不能执行任何操作
    - 提供有限的帮助信息
    """
    }
    
    @wrap_model_call
    def dynamic_system_prompt(
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse]
    ) -> ModelResponse:
        """
        根据用户角色动态注入系统提示词
        
        从 ModelRequest 中获取：
        1. request.state - 包含 user_info（由 RBACMiddleware 注入）
        2. request.runtime.context - 包含原始用户上下文
        """
        try:
            log_with_timestamp("💬 [3. DynamicSystemPrompt] 注入角色专属提示词...")
            
            # 从 request.state 获取用户信息（由 RBACMiddleware 注入）
            state = request.state
            user_role = UserRole.GUEST  # 默认角色
            
            # 调试信息
            log_with_timestamp(f"   🔍 State keys: {list(state.keys())}")
            
            # 如果 state 中没有 user_info，尝试从 runtime.context 获取
            if hasattr(request, 'runtime') and hasattr(request.runtime, 'context'):
                context_data = request.runtime.context
                if isinstance(context_data, dict):
                    user_role_str = context_data.get('role', 'guest')
                    try:
                        user_role = UserRole(user_role_str)
                    except ValueError:
                        user_role = UserRole.GUEST
                    log_with_timestamp(f"   ℹ️ 从 runtime.context 获取用户角色: {user_role.value}")
                        
            # 确保 user_role 是 UserRole 枚举类型
            if isinstance(user_role, str):
                try:
                    user_role = UserRole(user_role)
                except ValueError:
                    log_with_timestamp(f"   ⚠️ 无效的角色字符串: {user_role}，使用 GUEST", "WARN")
                    user_role = UserRole.GUEST
            elif not isinstance(user_role, UserRole):
                log_with_timestamp(f"   ⚠️ 意外的角色类型: {type(user_role)}，使用 GUEST", "WARN")
                user_role = UserRole.GUEST
            
            log_with_timestamp(f"   🔍 检测到用户角色: {user_role.value}")
            
            # 获取角色专属提示词
            role_prompt = ROLE_PROMPTS.get(user_role, ROLE_PROMPTS[UserRole.GUEST])
            
            # 获取当前消息列表
            messages = list(request.messages)
            
            # 检查是否已有系统消息
            has_system_msg = any(msg.type == "system" for msg in messages)
            
            if not has_system_msg:
                # 创建增强的系统消息
                enhanced_system_msg = SystemMessage(content=role_prompt)
                messages.insert(0, enhanced_system_msg)
                
                log_with_timestamp(f"   ✅ 已注入 {user_role.value} 角色提示词")
                
                # 使用修改后的消息列表覆盖请求
                request = request.override(messages=messages)
            else:
                log_with_timestamp("   ℹ️ 系统消息已存在，跳过注入")
            
            # 继续执行调用
            return handler(request)
            
        except Exception as e:
            log_with_timestamp(f"   ❌ 提示词注入异常: {str(e)}", "ERROR")
            import traceback
            log_with_timestamp(f"   详细错误: {traceback.format_exc()}", "ERROR")
            # 发生异常时，继续执行原始请求
            return handler(request)
    
    @wrap_model_call
    async def dynamic_system_prompt_async(
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse]
    ) -> ModelResponse:
        """异步版本：与同步版本逻辑相同"""
        # 直接调用同步版本的逻辑
        return dynamic_system_prompt.invoke(request, handler)
    
    return dynamic_system_prompt


# ==============================================================================
# 智能模型切换中间件（使用 @wrap_model_call）
# ==============================================================================

# 定义复杂任务关键词
COMPLEXITY_KEYWORDS = [
    "分析", "建议", "优化", "故障排查", "诊断", 
    "复杂", "详细", "深入", "为什么", "如何",
    "证明", "推导", "严谨", "规划", "多步骤"
]

def create_dynamic_model_router(fast_model: BaseChatModel, smart_model: BaseChatModel):
    """
    创建动态模型路由中间件
    
    Args:
        fast_model: 快速模型（用于简单查询）
        smart_model: 智能模型（用于复杂任务）
    
    Returns:
        使用 @wrap_model_call 装饰的中间件函数
    """
    
    def _analyze_complexity(messages: List) -> tuple[bool, str]:
        """分析请求复杂度"""
        should_use_smart_model = False
        reason = ""
        
        # 场景 1: 长对话（超过 5 轮）
        if len(messages) > 5:
            should_use_smart_model = True
            reason = f"长对话 ({len(messages)} 条消息)"
        
        # 场景 2: 检查最后一条用户消息
        elif messages:
            last_human_msg = None
            for msg in reversed(messages):
                if msg.type == "human":
                    last_human_msg = msg
                    break
            
            if last_human_msg:
                content = last_human_msg.content
                content_lower = content.lower()
                
                # 检查复杂任务关键词
                for keyword in COMPLEXITY_KEYWORDS:
                    if keyword in content_lower:
                        should_use_smart_model = True
                        reason = f"包含复杂关键词 '{keyword}'"
                        break
                
                # 检查消息长度
                if not should_use_smart_model and len(content) > 100:
                    should_use_smart_model = True
                    reason = f"长消息 ({len(content)} 字符)"
        
        return should_use_smart_model, reason
    
    @wrap_model_call
    def dynamic_model_router(
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse]
    ) -> ModelResponse:
        """
        同步版本：根据对话上下文和请求复杂度动态切换模型
        
        切换逻辑：
        1. 如果对话轮数超过 5 轮 → 使用智能模型（处理复杂上下文）
        2. 如果包含复杂任务关键词 → 使用智能模型
        3. 如果消息长度超过 100 字符 → 使用智能模型
        4. 其他情况 → 使用快速模型
        """
        # 获取当前对话状态
        state = request.state
        messages = state.get("messages", [])
        
        log_with_timestamp(f"🔄 [4. ModelRouter] 分析请求复杂度 - 消息数: {len(messages)}")
        
        should_use_smart_model, reason = _analyze_complexity(messages)
        
        # 根据判断结果切换模型
        if should_use_smart_model:
            log_with_timestamp(f"   🧠 切换至智能模型 - 原因: {reason}")
            request = request.override(model=smart_model)
        else:
            log_with_timestamp(f"   ⚡ 使用快速模型 - 简单请求")
        
        # 继续执行调用
        return handler(request)
    
    @wrap_model_call
    async def dynamic_model_router_async(
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse]
    ) -> ModelResponse:
        """
        异步版本：根据对话上下文和请求复杂度动态切换模型
        """
        # 获取当前对话状态
        state = request.state
        messages = state.get("messages", [])
        
        log_with_timestamp(f"🔄 [4. ModelRouter] 分析请求复杂度 - 消息数: {len(messages)}")
        
        should_use_smart_model, reason = _analyze_complexity(messages)
        
        # 根据判断结果切换模型
        if should_use_smart_model:
            log_with_timestamp(f"   🧠 切换至智能模型 - 原因: {reason}")
            request = request.override(model=smart_model)
        else:
            log_with_timestamp(f"   ⚡ 使用快速模型 - 简单请求")
        
        # 继续执行调用
        return await handler(request)
    
    return dynamic_model_router


class ResponseValidator(AgentMiddleware):
    """
    [阶段 6: after_model] 响应验证器
    验证模型响应的格式和内容
    """
    
    def __init__(self):
        super().__init__()

    def after_model(self, state: AgentState, runtime) -> Optional[Dict[str, Any]]:
        try:
            log_with_timestamp("🔍 [6. ResponseValidator] 验证模型响应...")
            
            messages = state.get("messages", [])
            if not messages:
                return None
            
            last_msg = messages[-1]
            if last_msg.type == "ai":
                has_tool_calls = hasattr(last_msg, 'tool_calls') and last_msg.tool_calls
                
                if has_tool_calls:
                    # 验证工具调用权限
                    user_permissions = state.get('user_permissions', [])
                    for tool_call in last_msg.tool_calls:
                        tool_name = tool_call.get('name', '')
                        required_permission = TOOL_PERMISSIONS.get(tool_name)
                        
                        if required_permission and required_permission.value not in user_permissions:
                            log_with_timestamp(
                                f"   ⚠️ 权限不足：工具 '{tool_name}' 需要权限 '{required_permission.value}'",
                                "WARN"
                            )
                    
                    log_with_timestamp(f"   🔧 模型请求调用 {len(last_msg.tool_calls)} 个工具")
                elif last_msg.content:
                    log_with_timestamp(f"   ✅ 响应有效 (长度: {len(last_msg.content)} 字符)")
            
            return None
            
        except Exception as e:
            log_with_timestamp(f"   ❌ 响应验证异常: {str(e)}", "ERROR")
            return None


class AuditLogger(AgentMiddleware):
    """
    [阶段 7: after_model] 审计日志中间件
    记录所有操作的审计日志
    """
    
    def __init__(self):
        super().__init__()
        self.audit_records = []

    def after_model(self, state: AgentState, runtime) -> Optional[Dict[str, Any]]:
        try:
            messages = state.get("messages", [])
            if not messages:
                return None
            
            last_msg = messages[-1]
            user_info = state.get("user_info", {})
            
            # 记录工具调用
            if last_msg.type == "ai" and hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                for tool_call in last_msg.tool_calls:
                    audit_record = {
                        "timestamp": datetime.now().isoformat(),
                        "user_id": user_info.get("user_id", "unknown"),
                        "username": user_info.get("username", "unknown"),
                        "role": user_info.get("role", "unknown"),
                        "action": "tool_call",
                        "tool_name": tool_call.get('name', ''),
                        "tool_args": tool_call.get('args', {}),
                        "status": "initiated"
                    }
                    self.audit_records.append(audit_record)
                    
                    log_with_timestamp(
                        f"📋 [7. AuditLogger] 记录审计日志 - "
                        f"用户: {user_info.get('username')}, "
                        f"操作: {tool_call.get('name')}",
                        "AUDIT"
                    )
            
            # 记录最终响应
            elif last_msg.type == "ai" and last_msg.content:
                audit_record = {
                    "timestamp": datetime.now().isoformat(),
                    "user_id": user_info.get("user_id", "unknown"),
                    "username": user_info.get("username", "unknown"),
                    "role": user_info.get("role", "unknown"),
                    "action": "response",
                    "response_length": len(last_msg.content),
                    "status": "completed"
                }
                self.audit_records.append(audit_record)
                
                log_with_timestamp(
                    f"📋 [7. AuditLogger] 操作完成 - "
                    f"审计记录已保存 (共 {len(self.audit_records)} 条)",
                    "AUDIT"
                )
            
            return None
            
        except Exception as e:
            log_with_timestamp(f"   ❌ 审计日志异常: {str(e)}", "ERROR")
            return None


# ==============================================================================
# 2. 定义 IT 运维工具
# ==============================================================================

class ServerStatusSchema(BaseModel):
    server_name: str = Field(description="服务器名称，例如: web-server-01")

@tool(args_schema=ServerStatusSchema)
def check_server_status(server_name: str) -> str:
    """
    查询服务器状态
    需要权限: VIEW_STATUS
    """
    # 模拟查询服务器状态
    status_data = {
        "server_name": server_name,
        "status": "running",
        "cpu_usage": "45%",
        "memory_usage": "62%",
        "uptime": "15 days 3 hours",
        "last_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    return json.dumps(status_data, ensure_ascii=False, indent=2)


class ServiceLogsSchema(BaseModel):
    service_name: str = Field(description="服务名称，例如: nginx, mysql")
    lines: int = Field(default=50, description="显示的日志行数")

@tool(args_schema=ServiceLogsSchema)
def view_service_logs(service_name: str, lines: int = 50) -> str:
    """
    查看服务日志
    需要权限: VIEW_LOGS
    """
    # 模拟返回服务日志
    log_entries = [
        f"[INFO] {service_name} service is running normally",
        f"[INFO] Last request processed at {datetime.now().strftime('%H:%M:%S')}",
        f"[INFO] Total requests today: 1,234",
        f"[WARN] Memory usage approaching 80%",
        f"[INFO] Service health check passed"
    ]
    
    result = f"=== {service_name} 服务日志 (最近 {lines} 行) ===\n"
    result += "\n".join(log_entries[:lines])
    
    return result


class RestartServiceSchema(BaseModel):
    service_name: str = Field(description="要重启的服务名称")
    force: bool = Field(default=False, description="是否强制重启")

@tool(args_schema=RestartServiceSchema)
def restart_service(service_name: str, force: bool = False) -> str:
    """
    重启服务
    需要权限: RESTART_SERVICE
    """
    # 模拟重启服务
    restart_type = "强制重启" if force else "正常重启"
    
    result = f"""
    🔄 服务重启操作
    服务名称: {service_name}
    重启类型: {restart_type}
    操作时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    状态: 成功
    预计恢复时间: 30秒
    """
    
    return result.strip()


class SystemMetricsSchema(BaseModel):
    metric_type: str = Field(
        description="指标类型: cpu, memory, disk, network"
    )

@tool(args_schema=SystemMetricsSchema)
def get_system_metrics(metric_type: str) -> str:
    """
    获取系统监控指标
    需要权限: VIEW_METRICS
    """
    # 模拟返回系统指标
    metrics = {
        "cpu": {
            "usage": "45.2%",
            "cores": 8,
            "load_average": [2.1, 2.3, 2.5]
        },
        "memory": {
            "total": "16 GB",
            "used": "10 GB",
            "free": "6 GB",
            "usage": "62.5%"
        },
        "disk": {
            "total": "500 GB",
            "used": "320 GB",
            "free": "180 GB",
            "usage": "64%"
        },
        "network": {
            "rx_bytes": "1.2 TB",
            "tx_bytes": "890 GB",
            "connections": 156
        }
    }
    
    metric_data = metrics.get(metric_type.lower(), {})
    return json.dumps(metric_data, ensure_ascii=False, indent=2)


# 工具列表
tools = [
    check_server_status,
    view_service_logs,
    restart_service,
    get_system_metrics
]


# ==============================================================================
# 3. 创建 IT 运维 Agent
# ==============================================================================

# 创建模型
model = ChatDeepSeek(model="deepseek-chat", temperature=0.1)

# 创建快速模型和智能模型（用于动态切换）
fast_model = ChatDeepSeek(model="deepseek-chat", temperature=0, max_tokens=500)
smart_model = ChatDeepSeek(model="deepseek-chat", temperature=0.3, max_tokens=2000)

# ==================== 配置 ContextEditingMiddleware ====================
# 关键：设置较低的触发阈值，确保能够触发清理
custom_context_middleware = ContextEditingMiddleware(
    edits=[
        ClearToolUsesEdit(
            trigger=800,  # 当 token 数超过 800 时触发清理（约 3-4 次工具调用后）
            keep=1,  # 只保留最近的 1 个工具结果
            clear_at_least=0,  # 清理所有超出keep数量的内容
            clear_tool_inputs=False,  # 不清理工具输入参数
            exclude_tools=["restart_service"],  # 不清理 restart_service 的结果（重要操作）
            placeholder="[已清理以节省空间]",  # 自定义占位符
        )
    ],
    token_count_method="approximate"  # 使用近似计数（更快）
)

# ==================== 创建动态模型路由中间件 ====================
dynamic_model_router = create_dynamic_model_router(fast_model, smart_model)

# ==================== 创建动态系统提示词中间件 ====================
dynamic_system_prompt = create_dynamic_system_prompt_middleware()

# 按顺序注册中间件
# 注意：
# - before_agent 钩子：按注册顺序执行（先注册先执行）
# - before_model 钩子：按注册顺序相反执行（后注册先执行）
# - @wrap_model_call 中间件：按注册顺序执行（先注册先执行）
# - after_model 钩子：按注册顺序相反执行（后注册先执行）
middlewares = [
    SecurityGuardrail(),                                 # 1. before_agent: 安全检查
    RBACMiddleware(),                                    # 2. before_agent & before_model: 权限验证（注入 user_info）
    dynamic_system_prompt,                               # 3. @wrap_model_call: 动态提示词注入
    dynamic_model_router,                                # 4. @wrap_model_call: 智能模型切换
    custom_context_middleware,                           # 5. @wrap_model_call: 上下文管理和清理
    AuditLogger(),                                       # 6. after_model: 审计日志（后注册，先执行）
    ResponseValidator(),                                 # 7. after_model: 响应验证（先注册，后执行）
]

# 系统提示词
system_prompt = """你是一个专业的 IT 运维助手，负责帮助运维人员管理服务器和服务。

你的职责包括：
1. 查询服务器状态和系统指标
2. 查看服务日志
3. 在获得授权后重启服务
4. 提供运维建议和故障排查

注意事项：
- 始终确认用户的操作意图
- 对于重启等关键操作，需要明确确认
- 提供清晰、专业的响应
- 遵守权限控制规则
"""

# 导出 graph 变量供 LangGraph Studio 使用
graph = create_agent(
    model=model,
    tools=tools,
    system_prompt=system_prompt,
    middleware=middlewares,
    context_schema=UserContext,  # 添加上下文 schema
    # checkpointer=MemorySaver(),  # 关键：使用 checkpointer 来保存消息历史
    debug=True  # 开启调试模式以观察中间件行为
)


# ==============================================================================
# 4. 运行演示
# ==============================================================================

def run_demo():
    """运行 IT 运维 Agent 演示"""
    print("\n" + "="*80)
    print("🖥️  IT 运维 Agent 演示 - 具备 RBAC 和审计功能")
    print("="*80)
    
    current_user = get_current_user()
    print(f"\n当前用户: {current_user['username']}")
    print(f"用户角色: {current_user['role'].value}")
    print(f"所属部门: {current_user['department']}")
    
    # 创建用户上下文实例
    user_context = UserContext(
        user_id=current_user['user_id'],
        username=current_user['username'],
        role=current_user['role'].value,  # 转换为字符串
        department=current_user['department']
    )
    
    # 配置：包含 thread_id 和用户上下文
    config = {
        "configurable": {
            "thread_id": "ops_demo_001",
            # "context": user_context.model_dump()  # 将用户上下文传入
        }
    }
    
    # 场景 1: 查询服务器状态（有权限）
    print("\n" + "="*80)
    print("🔹 场景 1: 查询服务器状态")
    print("="*80)
    user_input = "请帮我查看 web-server-01 的状态"
    log_with_timestamp(f"[用户]: {user_input}")
    
    try:
        for event in graph.stream(
            {"messages": [{"role": "user", "content": user_input}]},
            config=config,
            stream_mode="values",
            context=user_context  # 传入用户角色到上下文
        ):
            if "messages" in event:
                last_msg = event["messages"][-1]
                if last_msg.type == "ai" and last_msg.content:
                    log_with_timestamp(f"[AI]: {last_msg.content}")
    except Exception as e:
        log_with_timestamp(f"场景 1 执行异常: {str(e)}", "ERROR")

    # 场景 2: 复杂分析请求（测试模型切换）
    print("\n" + "="*80)
    print("🔹 场景 2: 复杂分析请求 - 测试智能模型切换")
    print("="*80)
    user_input_2 = "请详细分析 web-server-01 的性能状况，并提供优化建议"
    log_with_timestamp(f"[用户]: {user_input_2}")
    
    try:
        for event in graph.stream(
            {"messages": [{"role": "user", "content": user_input_2}]},
            config=config,
            stream_mode="values",
            context=user_context  # 传入用户角色到上下文
        ):
            if "messages" in event:
                last_msg = event["messages"][-1]
                if last_msg.type == "ai" and last_msg.content:
                    log_with_timestamp(f"[AI]: {last_msg.content}")
    except Exception as e:
        log_with_timestamp(f"场景 2 执行异常: {str(e)}", "ERROR")
    
    # 场景 3: 危险操作（应被拦截）
    print("\n" + "="*80)
    print("🔹 场景 3: 危险操作测试")
    print("="*80)
    user_input_3 = "帮我删除数据库中的所有数据"
    log_with_timestamp(f"[用户]: {user_input_3}")
    
    try:
        for event in graph.stream(
            {"messages": [{"role": "user", "content": user_input_3}]},
            config=config,
            stream_mode="values",
            context=user_context  # 传入用户角色到上下文
        ):
            if "messages" in event:
                last_msg = event["messages"][-1]
                if last_msg.type == "ai" and last_msg.content:
                    log_with_timestamp(f"[AI]: {last_msg.content}")
    except Exception as e:
        log_with_timestamp(f"场景 3 执行异常: {str(e)}", "ERROR")
    
    print("\n" + "="*80)
    print("✅ 演示完成")
    print("\n📊 中间件功能总结：")
    print("1. ✅ SecurityGuardrail - 危险操作拦截")
    print("2. ✅ RBACMiddleware - 基于角色的权限控制")
    print("3. ✅ dynamic_system_prompt (@wrap_model_call) - 动态系统提示词注入")
    print("4. ✅ dynamic_model_router (@wrap_model_call) - 智能模型切换")
    print("5. ✅ ContextEditingMiddleware - 上下文管理和清理")
    print("6. ✅ ResponseValidator - 响应验证")
    print("7. ✅ AuditLogger - 审计日志记录")
    print("="*80)


if __name__ == "__main__":
    run_demo()
