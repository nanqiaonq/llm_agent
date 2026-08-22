@echo off
echo ============================================
echo LangExtractApp - 智能文本提取平台
echo ============================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未安装 Python
    pause
    exit /b 1
)

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未安装 Node.js
    pause
    exit /b 1
)

echo 启动后端服务...
cd backend
if not exist venv (
    echo 创建虚拟环境...
    python -m venv venv
)

call venv\Scripts\activate
pip install -r requirements.txt -q

REM 检查 .env 文件
if not exist .env (
    copy .env.example .env
    echo 请编辑 backend\.env 文件，填入 DEEPSEEK_API_KEY
    pause
    exit /b 1
)

start cmd /k "cd /d %~dp0backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

echo 启动前端服务...
cd ..\frontend
if not exist node_modules (
    echo 安装前端依赖...
    npm install
)

start cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================
echo 服务已启动:
echo   后端: http://localhost:8000
echo   前端: http://localhost:5173
echo   API文档: http://localhost:8000/docs
echo ============================================
echo.

pause
