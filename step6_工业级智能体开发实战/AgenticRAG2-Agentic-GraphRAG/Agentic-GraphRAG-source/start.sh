#!/bin/bash

# ============================================================
# LangExtractApp - 一键启动脚本 (Conda 版本)
# ============================================================
# 使用方法:
#   chmod +x start.sh
#   ./start.sh              # 启动前后端
#   ./start.sh backend      # 仅启动后端
#   ./start.sh frontend     # 仅启动前端
#   ./start.sh stop         # 停止所有服务
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目配置
CONDA_ENV_NAME="langextract"
BACKEND_PORT=8000
FRONTEND_PORT=3000

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# PID 文件
PID_DIR="$SCRIPT_DIR/.pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

# 日志目录
LOG_DIR="$SCRIPT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# 显示 banner
show_banner() {
    echo -e "${CYAN}"
    echo "============================================================"
    echo "         LangExtractApp - 服务启动脚本 (Conda)              "
    echo "============================================================"
    echo -e "${NC}"
}

# 创建必要目录
setup_dirs() {
    mkdir -p "$PID_DIR"
    mkdir -p "$LOG_DIR"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 0
        fi
    elif command -v ss &> /dev/null; then
        if ss -tlnp | grep -q ":$port "; then
            return 0
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            return 0
        fi
    fi
    return 1
}

# 杀死占用端口的进程
kill_port() {
    local port=$1
    if check_port $port; then
        echo -e "${YELLOW}  端口 $port 被占用，正在清理...${NC}"
        if command -v lsof &> /dev/null; then
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        elif command -v fuser &> /dev/null; then
            fuser -k $port/tcp 2>/dev/null || true
        fi
        sleep 1
    fi
}

# 启动后端服务
start_backend() {
    echo -e "${BLUE}[Backend] 启动后端服务...${NC}"

    # 初始化 conda
    if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/miniconda3/etc/profile.d/conda.sh"
    elif [ -f "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
        source "$HOME/anaconda3/etc/profile.d/conda.sh"
    elif [ -f "/opt/conda/etc/profile.d/conda.sh" ]; then
        source "/opt/conda/etc/profile.d/conda.sh"
    else
        eval "$(conda shell.bash hook 2>/dev/null)" || {
            echo -e "${RED}错误: 无法初始化 Conda${NC}"
            exit 1
        }
    fi

    # 检查 conda 环境
    if ! conda env list | grep -q "^${CONDA_ENV_NAME} "; then
        echo -e "${RED}错误: Conda 环境 '${CONDA_ENV_NAME}' 不存在${NC}"
        echo -e "${YELLOW}请先运行 ./setup.sh 进行安装${NC}"
        exit 1
    fi

    # 检查 .env 文件
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        echo -e "${RED}错误: 未找到 .env 配置文件${NC}"
        echo -e "${YELLOW}请先复制 .env.example 为 .env 并配置 API Key${NC}"
        exit 1
    fi

    # 清理端口
    kill_port $BACKEND_PORT

    # 激活环境并启动
    cd "$BACKEND_DIR"
    conda activate "$CONDA_ENV_NAME"

    echo -e "${GREEN}  Python: $(which python)${NC}"
    echo -e "${GREEN}  启动 uvicorn 服务器...${NC}"

    # 后台启动
    nohup python -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload > "$BACKEND_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$BACKEND_PID_FILE"

    # 等待启动
    sleep 3

    if check_port $BACKEND_PORT; then
        echo -e "${GREEN}[OK] 后端启动成功 [PID: $pid]${NC}"
        echo -e "${GREEN}  地址: http://localhost:$BACKEND_PORT${NC}"
        echo -e "${GREEN}  API文档: http://localhost:$BACKEND_PORT/docs${NC}"
        echo -e "${GREEN}  日志: $BACKEND_LOG${NC}"
    else
        echo -e "${RED}[FAIL] 后端启动失败，请检查日志: $BACKEND_LOG${NC}"
        return 1
    fi
}

# 启动前端服务
start_frontend() {
    echo -e "${BLUE}[Frontend] 启动前端服务...${NC}"

    # 检查 node_modules
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${RED}错误: 未找到 node_modules${NC}"
        echo -e "${YELLOW}请先运行 ./setup.sh 进行安装${NC}"
        exit 1
    fi

    # 清理端口
    kill_port $FRONTEND_PORT

    # 启动
    cd "$FRONTEND_DIR"

    echo -e "${GREEN}  启动 Vite 开发服务器...${NC}"

    # 后台启动
    nohup npm run dev -- --host 0.0.0.0 > "$FRONTEND_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$FRONTEND_PID_FILE"

    # 等待启动
    sleep 3

    if check_port $FRONTEND_PORT; then
        echo -e "${GREEN}[OK] 前端启动成功 [PID: $pid]${NC}"
        echo -e "${GREEN}  地址: http://localhost:$FRONTEND_PORT${NC}"
        echo -e "${GREEN}  日志: $FRONTEND_LOG${NC}"
    else
        echo -e "${RED}[FAIL] 前端启动失败，请检查日志: $FRONTEND_LOG${NC}"
        return 1
    fi
}

# 停止服务
stop_services() {
    echo -e "${YELLOW}正在停止所有服务...${NC}"

    # 停止后端
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            kill $pid 2>/dev/null || true
            echo -e "${GREEN}[OK] 后端服务已停止 [PID: $pid]${NC}"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # 停止前端
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            kill $pid 2>/dev/null || true
            echo -e "${GREEN}[OK] 前端服务已停止 [PID: $pid]${NC}"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # 清理端口
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT

    echo -e "${GREEN}所有服务已停止${NC}"
}

# 显示状态
show_status() {
    echo -e "${BLUE}服务状态:${NC}"
    echo ""

    # 后端状态
    if check_port $BACKEND_PORT; then
        echo -e "  后端: ${GREEN}[运行中]${NC} - http://localhost:$BACKEND_PORT"
    else
        echo -e "  后端: ${RED}[未运行]${NC}"
    fi

    # 前端状态
    if check_port $FRONTEND_PORT; then
        echo -e "  前端: ${GREEN}[运行中]${NC} - http://localhost:$FRONTEND_PORT"
    else
        echo -e "  前端: ${RED}[未运行]${NC}"
    fi

    echo ""
}

# 显示帮助
show_help() {
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  (无参数)    启动前后端服务"
    echo "  backend     仅启动后端服务"
    echo "  frontend    仅启动前端服务"
    echo "  stop        停止所有服务"
    echo "  status      显示服务状态"
    echo "  restart     重启所有服务"
    echo "  logs        实时查看日志"
    echo "  help        显示帮助信息"
    echo ""
}

# 查看日志
show_logs() {
    echo -e "${BLUE}选择要查看的日志:${NC}"
    echo "  1) 后端日志"
    echo "  2) 前端日志"
    echo "  3) 同时查看"
    echo ""
    read -p "请选择 [1-3]: " choice

    case $choice in
        1)
            if [ -f "$BACKEND_LOG" ]; then
                tail -f "$BACKEND_LOG"
            else
                echo -e "${RED}后端日志不存在${NC}"
            fi
            ;;
        2)
            if [ -f "$FRONTEND_LOG" ]; then
                tail -f "$FRONTEND_LOG"
            else
                echo -e "${RED}前端日志不存在${NC}"
            fi
            ;;
        3)
            echo -e "${YELLOW}按 Ctrl+C 退出${NC}"
            tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null
            ;;
        *)
            echo -e "${RED}无效选择${NC}"
            ;;
    esac
}

# 显示启动完成信息
show_complete() {
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  所有服务已启动!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "  ${CYAN}前端:${NC}    http://localhost:$FRONTEND_PORT"
    echo -e "  ${CYAN}后端:${NC}    http://localhost:$BACKEND_PORT"
    echo -e "  ${CYAN}API文档:${NC} http://localhost:$BACKEND_PORT/docs"
    echo ""
    echo -e "  ${YELLOW}提示:${NC}"
    echo -e "  - 使用 ${GREEN}./start.sh status${NC} 查看服务状态"
    echo -e "  - 使用 ${GREEN}./start.sh logs${NC} 查看日志"
    echo -e "  - 使用 ${GREEN}./start.sh stop${NC} 停止所有服务"
    echo ""
}

# 主入口
main() {
    show_banner
    setup_dirs

    case "${1:-}" in
        "backend")
            start_backend
            ;;
        "frontend")
            start_frontend
            ;;
        "stop")
            stop_services
            ;;
        "status")
            show_status
            ;;
        "restart")
            stop_services
            sleep 2
            start_backend
            echo ""
            start_frontend
            show_complete
            ;;
        "logs")
            show_logs
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        "")
            # 默认启动所有服务
            start_backend
            echo ""
            start_frontend
            show_complete
            ;;
        *)
            echo -e "${RED}未知命令: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
