#!/bin/bash

# ============================================================
# LangExtractApp - 一键安装脚本 (Conda 版本)
# ============================================================
# 使用方法:
#   chmod +x setup.sh
#   ./setup.sh
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
CONDA_ENV_NAME="langextract"
PYTHON_VERSION="3.11"
NODE_VERSION="18"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo -e "${BLUE}"
echo "============================================================"
echo "     LangExtractApp - 一键安装脚本"
echo "============================================================"
echo -e "${NC}"

# 检查 conda 是否安装
check_conda() {
    echo -e "${YELLOW}[1/6] 检查 Conda 环境...${NC}"
    if ! command -v conda &> /dev/null; then
        echo -e "${RED}错误: 未找到 Conda，请先安装 Miniconda 或 Anaconda${NC}"
        echo "下载地址: https://docs.conda.io/en/latest/miniconda.html"
        exit 1
    fi
    echo -e "${GREEN}✓ Conda 已安装: $(conda --version)${NC}"
}

# 检查 Node.js 是否安装
check_node() {
    echo -e "${YELLOW}[2/6] 检查 Node.js 环境...${NC}"
    if ! command -v node &> /dev/null; then
        echo -e "${RED}错误: 未找到 Node.js，请先安装 Node.js ${NODE_VERSION}+${NC}"
        echo "下载地址: https://nodejs.org/"
        exit 1
    fi
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
        echo -e "${RED}错误: Node.js 版本过低，需要 v${NODE_VERSION}+，当前版本: $(node -v)${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js 已安装: $(node -v)${NC}"
    echo -e "${GREEN}✓ npm 已安装: $(npm -v)${NC}"
}

# 创建或激活 Conda 环境
setup_conda_env() {
    echo -e "${YELLOW}[3/6] 配置 Conda 虚拟环境...${NC}"

    # 初始化 conda (确保 conda activate 可用)
    eval "$(conda shell.bash hook)"

    # 检查环境是否已存在
    if conda env list | grep -q "^${CONDA_ENV_NAME} "; then
        echo -e "${GREEN}✓ Conda 环境 '${CONDA_ENV_NAME}' 已存在${NC}"
        echo -e "${BLUE}  正在激活环境...${NC}"
    else
        echo -e "${BLUE}  创建 Conda 环境 '${CONDA_ENV_NAME}' (Python ${PYTHON_VERSION})...${NC}"
        conda create -n "$CONDA_ENV_NAME" python="$PYTHON_VERSION" -y
        echo -e "${GREEN}✓ Conda 环境创建成功${NC}"
    fi

    # 激活环境
    conda activate "$CONDA_ENV_NAME"
    echo -e "${GREEN}✓ 已激活 Conda 环境: ${CONDA_ENV_NAME}${NC}"
    echo -e "${GREEN}  Python 路径: $(which python)${NC}"
    echo -e "${GREEN}  Python 版本: $(python --version)${NC}"
}

# 安装后端依赖
install_backend() {
    echo -e "${YELLOW}[4/6] 安装后端 Python 依赖...${NC}"

    if [ ! -f "$BACKEND_DIR/requirements.txt" ]; then
        echo -e "${RED}错误: 未找到 requirements.txt${NC}"
        exit 1
    fi

    cd "$BACKEND_DIR"

    # 升级 pip
    pip install --upgrade pip -q

    # 安装依赖
    echo -e "${BLUE}  正在安装 Python 依赖 (这可能需要几分钟)...${NC}"
    pip install -r requirements.txt

    echo -e "${GREEN}✓ 后端依赖安装完成${NC}"
}

# 安装前端依赖
install_frontend() {
    echo -e "${YELLOW}[5/6] 安装前端 Node.js 依赖...${NC}"

    if [ ! -f "$FRONTEND_DIR/package.json" ]; then
        echo -e "${RED}错误: 未找到 package.json${NC}"
        exit 1
    fi

    cd "$FRONTEND_DIR"

    echo -e "${BLUE}  正在安装 npm 依赖 (这可能需要几分钟)...${NC}"
    npm install

    echo -e "${GREEN}✓ 前端依赖安装完成${NC}"
}

# 配置环境变量
setup_env_file() {
    echo -e "${YELLOW}[6/6] 配置环境变量...${NC}"

    if [ ! -f "$BACKEND_DIR/.env" ]; then
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            echo -e "${GREEN}✓ 已从 .env.example 创建 .env 文件${NC}"
            echo -e "${YELLOW}⚠ 请编辑 backend/.env 文件，填入你的 API Key${NC}"
        else
            echo -e "${YELLOW}⚠ 未找到 .env.example，请手动创建 .env 文件${NC}"
        fi
    else
        echo -e "${GREEN}✓ .env 文件已存在${NC}"
    fi
}

# 显示完成信息
show_complete() {
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}     安装完成!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "${BLUE}启动服务:${NC}"
    echo -e "  ${YELLOW}./start.sh${NC}          # 一键启动前后端"
    echo ""
    echo -e "${BLUE}或手动启动:${NC}"
    echo -e "  ${YELLOW}# 后端 (终端1):${NC}"
    echo -e "  conda activate ${CONDA_ENV_NAME}"
    echo -e "  cd backend && python -m uvicorn app.main:app --reload --port 8000"
    echo ""
    echo -e "  ${YELLOW}# 前端 (终端2):${NC}"
    echo -e "  cd frontend && npm run dev"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo -e "  前端: ${GREEN}http://localhost:3000${NC}"
    echo -e "  后端: ${GREEN}http://localhost:8000${NC}"
    echo -e "  API文档: ${GREEN}http://localhost:8000/docs${NC}"
    echo ""
}

# 主流程
main() {
    check_conda
    check_node
    setup_conda_env
    install_backend
    install_frontend
    setup_env_file
    show_complete
}

main
