# ai-todo 安装与运行

> **课程**:智能体接口设计与上线部署 — 接口设计篇配套源码

本机搭建运行环境并启动 ai-todo,共七步,正常 5 ~ 10 分钟跑通。

---

## 环境要求

- **Python 3.12**(最好一致，允许3.10/3.11/3.12/3.13)
- **OpenRouter API Key**(申请地址:[https://openrouter.ai/keys](https://openrouter.ai/keys),免费试用额度)
- 网络访问 PyPI 与 OpenRouter API

---

## 第一步:确认 Python 3.12 已安装

```bash
python3.12 --version
```

输出 `Python 3.12.x` 即通过,直接进入第二步。否则按下面方式安装。

### macOS(Homebrew)

```bash
# 未安装 Homebrew 时先执行这一句
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install python@3.12
python3.12 --version
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.12 python3.12-venv
python3.12 --version
```

### Windows

打开 [https://www.python.org/downloads/release/python-3120](https://www.python.org/downloads/release/python-3120),下载 `Windows installer (64-bit)`。安装时**必须勾选 "Add python.exe to PATH"**。安装完成后在新 PowerShell 验证:

```powershell
py -3.12 --version
```

后续所有 Windows 命令统一使用 `py -3.12`,精确指定版本。**不要**用 Microsoft Store 装 Python——其安装路径特殊,创建虚拟环境与文件读写存在权限问题。

---

## 第二步:进入项目目录,创建虚拟环境

### macOS / Linux

```bash
cd ai-todo
python3.12 -m venv .venv
source .venv/bin/activate
```

### Windows(PowerShell)

```powershell
cd ai-todo
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Windows(Git Bash)

```bash
cd ai-todo
py -3.12 -m venv .venv
source .venv/Scripts/activate
```

激活成功后命令行最左侧显示 `(.venv)` 前缀。验证 venv 使用的 Python 版本:

```bash
python --version       # 应输出 Python 3.12.x
```

PowerShell 首次激活若报"无法加载...因为在此系统上禁止运行脚本",先执行:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## 第三步:安装依赖

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

安装成功输出 `Successfully installed ...` 一长串。

国内网络若卡住或报 `ssl.SSLCertVerificationError`,改用清华源:

```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## 第四步:配置 `.env`

复制模板:

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
copy .env.example .env
```

编辑 `.env`,**必填 `OPENROUTER_API_KEY`**:

```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LLM_MODEL=z-ai/glm-5.1
LLM_BASE_URL=https://openrouter.ai/api/v1
PORT=12234
API_KEY=dev-local-key-change-me
```

key 申请流程:[https://openrouter.ai/keys](https://openrouter.ai/keys) → 注册 → "Create Key" → 复制粘贴到 `.env`。

> <font color=red>`.env` 不得复制他人或公开分享</font>。OpenRouter API key 一旦泄露,数小时内即可能被爬虫扫描并被恶意调用。

---

## 第五步:启动后端(终端 A)

先确认当前目录是 `ai-todo` 代码目录:

```bash
pwd
ls main.py frontend/index.html
```

若当前还在外层课件目录,先进入代码目录:

```bash
cd ai-todo
```

然后启动后端:

```bash
uvicorn main:app --reload --port 12234
```

启动成功的关键输出:

```
[lifespan] 加载配置 — model=z-ai/glm-5.1  port=12234
[lifespan] 构建 agent ...
[lifespan] agent 就绪
INFO:     Uvicorn running on http://0.0.0.0:12234 (Press CTRL+C to quit)
```

看到 `agent 就绪` + `Uvicorn running` 即后端启动完成,**保持这个终端不关**。

---

## 第六步:启动前端(终端 B)

新开一个终端,同样先进入 `ai-todo` 代码目录。关键是:执行下面命令时,当前目录下必须能看到 `frontend/index.html`。

```bash
# macOS / Linux
cd ai-todo
ls frontend/index.html
python3.12 -m http.server 12233 --directory frontend

# Windows PowerShell
cd ai-todo
dir frontend\index.html
py -3.12 -m http.server 12233 --directory frontend
```

如果你已经在外层课件目录,也可以不 `cd ai-todo`,直接这样启动:

```bash
python3.12 -m http.server 12233 --directory ai-todo/frontend
```

启动成功输出:

```
Serving HTTP on :: port 12233 (http://[::]:12233/) ...
```

---

## 第七步:浏览器访问

打开 [http://127.0.0.1:12233](http://127.0.0.1:12233)。

注意不要打开 `http://127.0.0.1:12234/` 当作页面入口。`12234` 是后端 API 服务,根路径 `/` 没有页面;浏览器界面在 `12233`。

界面正常显示三栏(左侧会话列表 / 中间对话区 / 右侧日历 + 待办)即部署成功。在中间对话框输入 `加一个明天写周报的任务` 回车,看到流式回复并在右侧出现新待办,验证后端 + LLM 链路全部跑通。

---

## 排错

**打开 `http://127.0.0.1:12233` 是 `404 File not found`**:前端静态服务目录启动错了。终端 B 必须在 `ai-todo` 代码目录下执行 `python3.12 -m http.server 12233 --directory frontend`,或在外层课件目录执行 `python3.12 -m http.server 12233 --directory ai-todo/frontend`。

**打开 `http://127.0.0.1:12234/` 是 `404 Not Found`**:这是正常的。`12234` 是后端 API 服务,不是前端页面。可用 `http://127.0.0.1:12234/health` 检查后端是否存活,页面入口是 `http://127.0.0.1:12233`。

**`401 Unauthorized`**:前端写死的 `API_KEY = "dev-local-key-change-me"` 必须与 `.env` 里 `API_KEY` 完全一致(默认就一致,改过其中一个就要同步另一个)。

**`Address already in use`**:端口 12234 / 12233 被占用。

```bash
lsof -i:12234              # macOS / Linux
netstat -ano | findstr :12234   # Windows
```

杀掉占用进程或换端口启动(换前端端口需保持后端仍在 12234,因 `frontend/app.js` 顶部 `BACKEND` 常量写死指向 `http://localhost:12234`)。

**OpenRouter 报 `401` / `insufficient credits`**:`.env` 里 `OPENROUTER_API_KEY` 填错或额度耗尽,回 [https://openrouter.ai/keys](https://openrouter.ai/keys) 重新生成 key 或充值。

**`pip install` 报 `ResolutionImpossible`**:确认 `requirements.txt` 中 `langchain[openai]==1.2.18`(只锁主包,langgraph 系列由 pip 自动解析)。如已修改请恢复,删除 `.venv` 重建后重试。

**PowerShell 激活脚本被禁用**:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
