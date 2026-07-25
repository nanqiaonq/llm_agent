# Windows 装 WSL2 跑 Docker Desktop 完整指南

> 本文是 container-deploy(Docker + Docker Compose)课件的 Windows 用户配套前置文档。我们假定读者已经走完 ai-todo 前置课,在 Windows 上需要把 Docker Desktop 正常跑起来——而 Docker Desktop 在 Windows 上几乎只能走 WSL2 后端。

> <font size=2>**【名词解释】<font color=red>WSL</font>(Windows Subsystem for Linux,适用于 Linux 的 Windows 子系统)** — 微软在 Windows 上原生跑 Linux 二进制的官方机制。WSL 1 用兼容层翻译系统调用;WSL 2 用一个轻量级真实 Linux 内核 + 微型虚拟机跑完整 Linux,文件系统、网络栈都是真的 Linux 体验。</font>

> <font size=2>**【名词解释】<font color=red>Hyper-V</font>(Hyper-V Hypervisor,微软原生虚拟化平台)** — Windows 自带的 Type-1 虚拟化平台。Docker Desktop 在 Windows 上无论选 WSL2 后端还是 Hyper-V 后端,底层都依赖 Hyper-V 提供的虚拟化能力。</font>

> <font size=2>**【名词解释】<font color=red>SLAT</font>(Second Level Address Translation,二级地址转换)** — CPU 内存虚拟化的硬件加速能力。Intel 平台叫 EPT,AMD 平台叫 RVI。WSL2 强依赖 SLAT,Intel Nehalem(第一代 Core)及更新、AMD Opteron 及更新都支持。</font>

> <font size=2>**【名词解释】<font color=red>VHDX</font>(Virtual Hard Disk v2,微软第二代虚拟硬盘格式)** — Hyper-V 用的虚拟磁盘格式。WSL2 的每个 Linux 发行版都用一个 `ext4.vhdx` 文件存所有数据,这文件按需扩容、但不会自动缩。</font>

---

## 一、WSL2 是什么、为什么 Docker Desktop 要靠它

Docker 引擎的核心是 Linux 内核能力(cgroups、namespaces、overlayfs),这套东西在 Windows 内核里没有原生对应。Docker Desktop 早年走 Hyper-V + MobyLinuxVM 路线,启动慢、占资源、跟 Hyper-V 设置耦合得很紧;2020 年起 Docker 官方把默认后端切到 WSL2,**理由是 WSL2 已经提供了一个开箱即用的轻量级 Linux 内核虚拟机,Docker 直接复用就行**。

Docker 官方文档([docs.docker.com/desktop/features/wsl/](https://docs.docker.com/desktop/features/wsl/))里写得很直白:Docker Desktop 在 Windows 上的 WSL2 后端会用 WSL 提供的微型 VM 跑 Docker 守护进程,镜像和容器的存储也放在 WSL2 的虚拟磁盘里。换句话说,我们装 Docker Desktop 之前必须先把 WSL2 装好——Docker Desktop 的安装器会自检 WSL2,缺了直接报错退出。

下面整理一份完整路径:从前置检查到验证、到常见报错、再到性能调优。命令都贴了出处,我们一条条照着跑就行。

---

## 二、前置检查

### 2.1 Windows 版本

Docker Desktop 当前版本对 WSL2 后端的最低要求([docs.docker.com/desktop/setup/install/windows-install/](https://docs.docker.com/desktop/setup/install/windows-install/)):

- Windows 10 64-bit:**Enterprise / Pro / Education,22H2(build 19045)或更高**
- Windows 11 64-bit:**Enterprise / Pro / Education,23H2(build 22631)或更高**
- WSL 自身版本:**2.1.5 及以上**

> **提示**: Docker 文档现在只列 Enterprise / Pro / Education,但实际上 Home 版从 2020 年起也能跑 WSL2 + Docker Desktop,只是 Docker 官方支持矩阵不写 Home。我们个人电脑大多是 Home / Pro,只要满足 build 号下限,实操上都能装起来。

按 `Win + R` 输入 `winver` 回车,弹窗第二行就是版本号和 build 号——这是微软文档([learn.microsoft.com/en-us/windows/wsl/install](https://learn.microsoft.com/en-us/windows/wsl/install))给的判定方法。看清楚下面两个数字:

- 版本号(Version):≥ 22H2(Win10)或 ≥ 23H2(Win11)
- 内部版本号(OS Build):≥ 19045(Win10)或 ≥ 22631(Win11)

低于这个版本号,先去 Windows 更新里推到最新。

### 2.2 BIOS 虚拟化开关

WSL2 是个真实 Linux 内核跑在 Hyper-V 的微型 VM 里,Hyper-V 强依赖 CPU 的虚拟化指令集——Intel 叫 **VT-x**,AMD 叫 **AMD-V**(或 SVM)。这个开关默认很多 OEM 厂出厂是关的。

PowerShell 里跑下面这条命令快速判断:

```powershell
systeminfo | findstr /i "Hyper-V"
```

输出里能看到 4 行 `Hyper-V Requirements`,其中 **Virtualization Enabled In Firmware** 这一行如果是 `Yes`,说明 BIOS 里虚拟化已开;`No` 就得进 BIOS / UEFI 打开。

进 BIOS 路径:重启时按厂商热键(Dell / Lenovo 多是 F2,HP 多是 F10,华硕 / 微星多是 Del),找 CPU Configuration / Advanced 子菜单,把 `Intel Virtualization Technology` 或 `SVM Mode` / `AMD-V` 设为 Enabled,保存退出。

### 2.3 Hyper-V 状态(可选确认)

WSL2 不需要我们手动在"Windows 功能"里开 Hyper-V——它走的是更轻量的 **Virtual Machine Platform** 子集。但 `wsl --install` 会自动开 Virtual Machine Platform 功能,这一步我们后面会做。

跑这条命令能确认 hypervisor 是否启动([learn.microsoft.com/en-us/windows/wsl/troubleshooting](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting)):

```powershell
bcdedit /enum | findstr -i hypervisorlaunchtype
```

期望看到 `hypervisorlaunchtype    Auto`。如果显示 `Off`,管理员 PowerShell 跑:

```powershell
bcdedit /set hypervisorlaunchtype Auto
```

然后重启。

### 2.4 SLAT 支持

绝大多数 2010 年后买的 CPU 都支持 SLAT,但极老的设备(Intel Core 2 Duo 等)就不行。微软在故障排查文档里明确写:**WSL2 要求 CPU 支持 SLAT**,Intel Nehalem(第一代 Core)起、AMD Opteron 起才有。

PowerShell 里跑:

```powershell
systeminfo | findstr /i "Hyper-V"
```

四行 `Hyper-V Requirements` 里第三行 **Second Level Address Translation** 是 `Yes` 就过关。

---

## 三、一键安装路径(推荐 / 默认)

### 3.1 一条命令搞定

微软 2020 年起推荐的安装方式([learn.microsoft.com/en-us/windows/wsl/install](https://learn.microsoft.com/en-us/windows/wsl/install)):管理员身份打开 PowerShell(开始菜单 → PowerShell → 右键"以管理员身份运行"),跑:

```powershell
wsl --install
```

官方原话:"This command will enable the features necessary to run WSL and install the Ubuntu distribution of Linux."

这一条命令做了 4 件事:

1. 启用 **Windows Subsystem for Linux** 可选功能
2. 启用 **Virtual Machine Platform** 可选功能
3. 下载并安装 WSL2 的 Linux 内核
4. 安装默认 Ubuntu 发行版,设默认 WSL 版本为 2

跑完会要求**重启**。重启之后再开机会自动弹出 Ubuntu 控制台,提示创建 Linux 用户名和密码——这一步设的是 Linux 侧的账号,跟 Windows 账号无关。

### 3.2 想换发行版

默认是 Ubuntu(实际拉的版本随时间漂移,目前是 Ubuntu 24.04)。想指定具体发行版:

```powershell
wsl --install -d Ubuntu-24.04
```

看可选列表:

```powershell
wsl --list --online
```

我们这门容器课沿用 ai-todo 前置课的 Ubuntu 24.04 假设。建议保持 Ubuntu 24.04,跟课件命令一致。

### 3.3 跑完会发生什么

第一次启动新装的发行版,会弹一个控制台窗口提示"等几分钟解压文件",之后让我们输入 Linux 用户名 + 密码(具体步骤见下面 3.4 节)。再之后 PowerShell 里跑 `wsl` 就能进 Ubuntu,跑 `wsl -l -v` 能看到刚装好的发行版和它的 WSL 版本号(应该是 2)。

### 3.4 首次启动:设置 Linux 账号

来源:微软官方 [Set up a WSL development environment](https://learn.microsoft.com/en-us/windows/wsl/setup/environment)。

第一次开 Ubuntu 控制台,解压完毕会逐行提示:

```
Please create a default UNIX user account. The username does not need to match your Windows username.
For more information visit: https://aka.ms/wslusers
Enter new UNIX username: <光标停在这里>
```

**输入用户名要求**:

- 小写字母开头,只允许小写字母、数字、`-`、`_`
- 长度 1-32 字符,不允许空格
- 跟 Windows 账号**无关**——可以同名也可以完全不同名(微软原文:"This **User Name** and **Password** is specific to each separate Linux distribution that you install and has no bearing on your Windows user name.")

输入完按回车,接着提示设密码:

```
New password: <光标停在这里,但你打字屏幕上不会有任何回显>
Retype new password: <同样不回显,需要再敲一遍>
passwd: password updated successfully
Installation successful!
```

**密码这一步最容易翻车的点**——叫 **盲打(blind typing)**:微软原文 "whilst entering the **Password**, nothing will appear on screen. This is called blind typing. You won't see what you're typing, this is completely normal."

不是键盘坏了、不是终端卡了、不是密码没被接收——这是所有 Linux 系统输密码时的标准行为,目的是防止旁人看到密码长度。我们正常敲完按回车即可。两次输入要完全一致,否则会提示 `Sorry, passwords do not match` 让重来。

**这个账号自动获得 sudo 权限**:微软原文 "Once you've created a UNIX username and password, the account will be your default user for the distribution and **automatically sign-in on launch**. This account will be considered the Linux administrator, with the ability to run `sudo` (Super User Do) administrative commands."

也就是说,我们之后在 Ubuntu 里跑 `sudo apt update`、`sudo systemctl ...` 之类的特权命令时,输的就是这一步设的密码。

**每个发行版有独立账号**:如果之后再装一个发行版(比如 Debian),会再要求设一份独立的用户名 + 密码,不共用。

### 3.5 忘记密码 / 想改密码

**改密码**:在已经登录的 Ubuntu 终端里直接跑:

```bash
passwd
```

按提示输旧密码 + 新密码(都是盲打),完事。

**忘了密码**:微软文档给的官方恢复路径(来源 [setup/environment](https://learn.microsoft.com/en-us/windows/wsl/setup/environment) "If you forget the password of your Linux distribution"):

1. 在 Windows PowerShell 里用 root 身份打开发行版:

   ```powershell
   wsl -d Ubuntu-24.04 -u root
   ```

   `-u root` 是关键,这一步直接进 root shell,跳过密码验证。

2. 在 root shell 里改目标用户的密码:

   ```bash
   passwd <我们刚才忘了密码的用户名>
   ```

   两次盲打新密码,完事。

3. `exit` 退出 root shell。

下次 `wsl` 默认进的还是原来那个用户,但密码已经换成新的了。

---

## 四、手动安装路径(老 Windows 10 )

`wsl --install` 在 Windows 10 build 19041 以下、或者一些定制 LTSC / Server Core 版本上不可用——这时走传统 6 步老方法。出处:[learn.microsoft.com/en-us/windows/wsl/install-manual](https://learn.microsoft.com/en-us/windows/wsl/install-manual)。

### 4.1 启用 WSL 可选功能

管理员 PowerShell:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

这一步会注册 WSL 核心组件,**先别重启**——下一步还要再启一个功能,一起重启省一次。

### 4.2 确认满足 WSL2 要求

WSL2 要求(微软原文):

- x64 系统:**版本 1903 及以上,build 18362.1049 及以上**
- ARM64 系统:**版本 2004 及以上,build 19041 及以上**

低于此 build 号的不能跑 WSL2,只能跑 WSL1——这种情况建议直接走 Windows Update 升到最新再回来。

### 4.3 启用虚拟机平台功能

管理员 PowerShell:

```powershell
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

跑完**重启**机器。

### 4.4 下载 Linux 内核更新包

微软单独发了一个 MSI 安装 WSL2 用的 Linux 内核(因为旧版 Windows Update 不自动推送):

- x64:[wsl_update_x64.msi](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi)
- ARM64:[wsl_update_arm64.msi](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_arm64.msi)

双击运行 MSI(需要管理员权限确认)。

### 4.5 设默认 WSL 版本为 2

PowerShell:

```powershell
wsl --set-default-version 2
```

### 4.6 装 Ubuntu

打开 Microsoft Store 搜 "Ubuntu",选 **Ubuntu 24.04 LTS**(跟课件版本对齐),点 "Get / 获取"。等下载安装完,在开始菜单里启动 Ubuntu,设 Linux 用户名 + 密码(账号设置详见 3.4 节)。

最后跑这条验证 WSL 版本:

```powershell
wsl -l -v
```

输出里 NAME 是 Ubuntu-24.04、VERSION 是 2,这一步就过了。

---

## 五、装 Docker Desktop 配 WSL2 后端

### 5.1 下载安装器

Docker 官方下载页([docs.docker.com/desktop/setup/install/windows-install/](https://docs.docker.com/desktop/setup/install/windows-install/))的 x86_64 直链:

```
https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
```

下下来双击运行,**右键以管理员身份运行**确保权限齐全。

### 5.2 安装向导关键勾选

向导里有一个 Configuration 页,务必勾选 **"Use WSL 2 instead of Hyper-V"** ——这是 Docker 文档明确给的选项措辞。在支持 WSL2 的系统上这一项默认勾,但还是建议人眼确认一遍。

向导跑完会要求登出 Windows 重新登录或重启,完事后从开始菜单启动 Docker Desktop。

### 5.3 首次启动的 General 设置

Docker Desktop 启动后,点齿轮图标进 Settings:

1. **Settings → General**,勾选 **"Use WSL 2 based engine"**。Docker 官方原话:"If you have installed Docker Desktop on a system that supports WSL 2, this option is turned on by default."——也就是默认勾上,我们点进去确认一眼即可。

2. **Settings → Resources → WSL Integration**,把我们要让 Docker 在里面可用的 Linux 发行版逐个勾上(比如 Ubuntu-24.04)。这一步之后,在 Ubuntu 终端里跑 `docker version` / `docker compose` 才能用。

设置改完点 **Apply & Restart**,等 Docker Desktop 重启完成。

### 5.4 命令行安装(可选)

如果偏好脚本化安装,Docker 文档给的命令行方式:

```powershell
"Docker Desktop Installer.exe" install --accept-license --backend=wsl-2
```

常用 flag:`--accept-license`(跳协议确认)、`--backend=wsl-2`(指定 WSL2 后端)、`--quiet`(静默)。

---

## 六、验证三连

### 6.1 验证 WSL 版本

管理员 PowerShell:

```powershell
wsl --status
```

期望输出关键行:

```
Default Version: 2
```

```powershell
wsl -l -v
```

每一个发行版的 VERSION 列都应该是 `2`。

### 6.2 验证 Linux 内核已起

```powershell
wsl --version
```

会列出 WSL 版本、内核版本、WSLg 版本。这条命令要求 WSL 0.65.1+(Store 版),老版可能不存在,跑 `wsl -l -v` 兜底即可。

### 6.3 验证 Docker

在 Ubuntu 终端(WSL Integration 已勾上)里跑:

```bash
docker version
```

期望看到:

- **Client**:Docker Desktop 版本号
- **Server**:Linux/amd64,API 版本对应

```bash
docker run --rm hello-world
```

能拉镜像、跑出 "Hello from Docker!" 那一段欢迎语,Docker 链路就全通了。

---

## 七、常见报错

下面这些是装 WSL2 + Docker Desktop 路上的高频翻车场景。每一条都附微软 / Docker 官方源或 GitHub issue 链接,我们对照错误信息逐个排查。

### 7.1 `WslRegisterDistribution failed with error: 0x80370102`

完整信息:`The virtual machine could not be started because a required feature is not installed.`

来源:[learn.microsoft.com/en-us/windows/wsl/troubleshooting#error-0x80370102](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting)。

根因:**虚拟化未启用**(BIOS 关了 VT-x / SVM,或 Virtual Machine Platform 功能没开,或 hypervisor 没启动)。

微软官方修复路径:

1. 进 BIOS 打开 Intel VT-x 或 AMD SVM(参考 2.2 节)
2. PowerShell 管理员跑 `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all`,然后重启
3. 确认 hypervisor 已启动:

   ```powershell
   bcdedit /enum | findstr -i hypervisorlaunchtype
   ```

   如果是 `Off`,跑 `bcdedit /set hypervisorlaunchtype Auto` 然后重启
4. 第三方虚拟机软件(VirtualBox < 6、VMware < 15.5.5)会抢虚拟化,升级到支持 Hyper-V 模式的版本或关掉
5. 我们在 Hyper-V 嵌套虚拟机里跑 WSL2 时,要在外层先开嵌套虚拟化:

   ```powershell
   Set-VMProcessor -VMName <VMName> -ExposeVirtualizationExtensions $true
   ```

### 7.2 `Hyper-V is not available` / 装 Docker Desktop 时报 hypervisor 检测失败

完整信息:`Docker Desktop is unable to detect a Hypervisor. Hardware assisted virtualization and data execution protection must be enabled in the BIOS.`

来源:[docker/for-win#13590](https://github.com/docker/for-win/issues/13590)、[docker/for-win#13015](https://github.com/docker/for-win/issues/13015)。

根因和 7.1 类似——虚拟化没在 BIOS 启用,或 hypervisor 没启动。修复路径:

1. BIOS 里启用 Intel VT-x / AMD SVM
2. 启用 Hyper-V 全部子功能:`Windows 功能` 弹窗里勾上 Hyper-V 下所有子项(Hyper-V 平台 + Hyper-V 管理工具)
3. 启用 hypervisor launch:

   ```powershell
   bcdedit /set hypervisorlaunchtype auto
   ```

4. 重启

如果重启后还报,在控制面板把 Hyper-V 全部子项取消,重启,再全部勾上,重启——这是社区高频成功路径。

### 7.3 `0x800701bc` — WSL 2 requires an update to its kernel component

完整信息:`WslRegisterDistribution failed with error: 0x800701bc`,后跟一句 `For information please visit https://aka.ms/wsl2kernel`。

来源:[microsoft/WSL#5393](https://github.com/microsoft/WSL/issues/5393)、[learn.microsoft.com/en-us/windows/wsl/troubleshooting](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting)。

根因:`%SystemRoot%\system32\lxss\tools` 目录下缺 Linux 内核,或内核版本太老。修复路径(任选其一):

- 管理员 PowerShell 跑 `wsl --update`,自动拉最新内核
- 手动下载 [wsl_update_x64.msi](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi) 双击装一次

装完再跑 `wsl --set-default-version 2`,这时应该不再报错。

### 7.4 `Error 0x80072F7D` — 安装内核 / 装发行版时网络失败

来源:[microsoft/WSL issues](https://github.com/microsoft/WSL/issues) 多个相关条目,以及 [learn.microsoft.com/en-us/windows/wsl/troubleshooting](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting) 关于 Microsoft Store 网络问题的章节。

根因:TLS / 证书 / 网络代理问题,常出现在公司域控、有防火墙拦截的网络。

修复路径:

1. 临时切到家庭 / 手机热点重试 `wsl --install`
2. 如果一定要在公司网络装,用手动安装路径(第四章),提前下好 `wsl_update_x64.msi` 和 Ubuntu Appx 离线包,本地安装
3. 配过代理:

   ```powershell
   netsh winhttp show proxy
   ```

   排查 winhttp 是否拿到错误代理

### 7.5 `Docker Desktop - Unexpected WSL error`

完整信息一般类似:`An unexpected error occurred while executing a WSL command.`,有时附 `WSL Distribution docker-desktop is missing`。

来源:[docker/for-win#13845](https://github.com/docker/for-win/issues/13845)、[#14366](https://github.com/docker/for-win/issues/14366)、[#14540](https://github.com/docker/for-win/issues/14540)——这是 Docker for-win 仓库 2024 年起最高频报告之一。

根因聚类(按概率排):

1. WSL 内核 / 子系统进入异常状态
2. 域账户网络中断后 docker-desktop / docker-desktop-data 这两个 WSL 子分布无法访问
3. Windows 唤醒后 Hyper-V 服务异常

修复路径(按从轻到重):

```powershell
# 第一招:重启 WSL
wsl --shutdown
# 然后重启 Docker Desktop 应用本身

# 第二招:更新 WSL 到最新
wsl --update

# 第三招:重启整台机器

# 第四招:卸载并重装 WSL 模块
wsl --uninstall   # 注意这条命令在新版 WSL 才有
# 然后重新 wsl --install

# 第五招(终极):Docker Desktop 重置 / 卸载重装
```

具体重置 / 卸载流程见本文 9.2 节。

### 7.6 WSL2 把整台机器内存吃满

WSL2 默认会**最多吃到 Windows 总内存的 50%**(微软文档 [wsl-config](https://learn.microsoft.com/en-us/windows/wsl/wsl-config) `memory` 配置项原话:"50% of total memory on Windows")。机器 32 GB,WSL2 可能在编译大项目时一口气吃到 16 GB,挤垮其他 Windows 应用。

修复路径:**在 `%UserProfile%\.wslconfig` 写内存上限**——详见本文第八章。例:

```ini
[wsl2]
memory=4GB
```

### 7.7 `Docker Desktop requires the Server service to be enabled`

来源:[docker/for-win#12291](https://github.com/docker/for-win/issues/12291)、Docker 论坛 [solution](https://forums.docker.com/t/docker-desktop-2-2-0-3-installation-failed-server-service-cant-start/89238)。

根因:Windows 的 **Server 服务(LanmanServer)**被组策略关了或被禁用,Docker Desktop 用它做命名管道 / SMB 相关功能。

修复路径:

1. `Win + R` → 输入 `services.msc` 回车
2. 找 **Server** 服务(英文版叫 Server,中文版叫"服务器")
3. 右键 → 属性 → 启动类型改 **自动**
4. 点 **启动**,等状态变成"正在运行"
5. 如果服务被组策略锁死(企业域机器常见),需要联系 IT 管理员,因为这通常是组策略下发的禁用,本机改完会被推回去

公司域控环境如果 IT 不肯放开,Docker Desktop on Windows 这条路基本走不通,只能改用 Linux 虚拟机或本机 Linux。

### 7.8 BIOS 虚拟化报错 — DEP 也得打开

完整信息:`Hardware assisted virtualization and data execution protection must be enabled in the BIOS.`

来源:[docker/for-win#13590](https://github.com/docker/for-win/issues/13590)、[#13015](https://github.com/docker/for-win/issues/13015)。

根因:除了 VT-x / SVM,**Data Execution Prevention(DEP,数据执行保护)**也得在 BIOS 启用,这是 Hyper-V 的硬性要求之一。

修复路径:

1. 进 BIOS,确认下面三项都是 Enabled:
   - Intel VT-x / AMD SVM(虚拟化)
   - Intel VT-d / AMD IOMMU(IO 虚拟化,有些主板默认关)
   - **Execute Disable Bit / NX Bit / XD Bit**(数据执行保护,不同主板叫法不同)
2. 保存重启
3. PowerShell 跑 `bcdedit /set hypervisorlaunchtype Auto`,再次重启

### 7.9 ext4.vhdx 膨胀到几十 GB 怎么手动收回

WSL2 的 `ext4.vhdx` 是动态扩展的——往里塞东西会涨,但**删了东西文件本身不会自动缩**。跑久了一个 Ubuntu 子系统占几十 GB 是常见现象。

来源:微软官方 [How to manage WSL disk space](https://learn.microsoft.com/en-us/windows/wsl/disk-space)。

收回步骤(默认 Ubuntu 路径):

1. 先在 Linux 里清掉真正不要的数据(`docker system prune -a` 是大头)
2. 关掉 Docker Desktop,关掉所有 WSL 实例:

   ```powershell
   wsl --shutdown
   ```

3. 定位 `ext4.vhdx` 文件路径:

   ```powershell
   (Get-ChildItem -Path HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss | Where-Object { $_.GetValue("DistributionName") -eq 'Ubuntu-24.04' }).GetValue("BasePath") + "\ext4.vhdx"
   ```

   输出形如 `C:\Users\<user>\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu24.04LTS_79rhkp1fndgsc\LocalState\ext4.vhdx`

4. 管理员 cmd 跑 `diskpart`:

   ```cmd
   diskpart
   ```

5. diskpart 提示符下依次跑(把路径换成上一步拿到的):

   ```
   select vdisk file="C:\Users\<user>\AppData\Local\Packages\...\LocalState\ext4.vhdx"
   attach vdisk readonly
   compact vdisk
   detach vdisk
   exit
   ```

`compact vdisk` 这条会把 VHDX 的空洞收掉。Docker 容器层和镜像层占用大头,这一通通常能收回几 GB 到十几 GB。

### 7.10 公司域 / 组策略环境装不上

常见症状:

- `wsl --install` 跑完没下完内核,报网络错
- Docker Desktop 安装到一半提示 Server service 起不来(参见 7.7)
- WSL 装好但 Ubuntu 没网(参见 [troubleshooting 中关于 Windows Defender Firewall + 域策略](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting))

根因:企业域控通过组策略下发了一组限制——禁用 Hyper-V、禁用 Server 服务、Firewall rule merging 设为 No、Microsoft Store 不可用等。

修复路径:

1. 找 IT 申请放开下列项:
   - 启用 Hyper-V 和 Virtual Machine Platform 可选功能
   - Server 服务允许设为自动启动
   - Windows Defender Firewall 的本地规则合并允许 Yes
   - 允许从 Microsoft Store 装 Linux 发行版,或允许下载 `.msi` / `.appx` 离线包
2. 如果 IT 政策上完全锁死,我们只能选离线兜底:
   - 用第四章手动安装路径,提前在家把 `wsl_update_x64.msi` 和 Ubuntu 24.04 的 `.appx` / `.appxbundle` 离线包下好([learn.microsoft.com/en-us/windows/wsl/install-manual](https://learn.microsoft.com/en-us/windows/wsl/install-manual) 给了直链)
   - 上班机器上 `Add-AppxPackage .\Ubuntu2204.appx`
3. 如果以上都不行,改用一台个人电脑 / 自费 Linux 云主机来跑课件,这是最经济的"绕过"路径

---

## 八、`.wslconfig` 调优

WSL2 默认会按 Windows 总内存 50% 上限随便吃,跑 Docker 容器编译 / 镜像打包时容易把 Windows 本身挤卡。我们在 `%UserProfile%\.wslconfig` 写一份全局配置约束它。

来源:[learn.microsoft.com/en-us/windows/wsl/wsl-config](https://learn.microsoft.com/en-us/windows/wsl/wsl-config) `[wsl2]` 段所有 key。

### 8.1 文件位置

`.wslconfig` 默认不存在,需要我们手动新建。路径:

```
C:\Users\<我们的用户名>\.wslconfig
```

PowerShell 一键定位 + 打开:

```powershell
notepad $env:USERPROFILE\.wslconfig
```

### 8.2 推荐起步配置

下面这份对 16 GB 内存、8 核 CPU 的开发机偏稳妥:

```ini
# %UserProfile%\.wslconfig
[wsl2]
# WSL2 VM 最多用 6 GB,给 Windows 留出主战场内存
memory=6GB

# WSL2 VM 用 4 个逻辑核(容器编译够用,不挤 Windows)
processors=4

# swap 设为 2 GB,内存吃紧时溢出到磁盘
swap=2GB

# WSL2 虚拟磁盘最大容量上限(默认 1 TB),按盘空间调小
# 注意:这是上限,不是预分配;实际占用看 ext4.vhdx 文件大小
defaultVhdSize=128GB

# localhost 端口在 Windows 侧透出,Docker 默认端口暴露用得上
localhostForwarding=true
```

机器内存大(32 GB+)可以把 `memory` 提到 12-16 GB,小内存(8 GB)就压到 3-4 GB,看实际工作负载。

### 8.3 生效

`.wslconfig` 改完不是马上生效——WSL 必须完整关一次才会读新配置。微软文档给的"8 秒法则":关所有 WSL 实例后等 8 秒,WSL VM 才彻底停。手动加速:

```powershell
wsl --shutdown
```

然后再开 Ubuntu,新配置就生效了。在 Ubuntu 里跑 `free -h` 看到 `Mem: total` 已经是 `6.0G` 左右(略低于 6GB 是正常的,VM overhead 占一点),就说明读到了。

### 8.4 各字段含义速查

| 字段 | 默认值 | 说明 |
|---|---|---|
| `memory` | Windows 总内存 50% | WSL2 VM 内存上限,可写 `4GB` / `2048MB` |
| `processors` | Windows 逻辑核数 | WSL2 VM 可用 CPU 核数 |
| `swap` | Windows 内存 25% | 交换区,设 0 关闭 |
| `swapFile` | `%Temp%\swap.vhdx` | 交换区文件路径 |
| `defaultVhdSize` | 1 TB | 新建发行版的 VHDX 最大值 |
| `localhostForwarding` | true | WSL 端口在 Windows `localhost:port` 可达 |
| `guiApplications` | true | WSLg(图形应用)开关,Docker 上不用,可关 |
| `nestedVirtualization` | true(Win11) | WSL 内再起 VM 的能力,K8s 本机调试用 |

---

## 九、卸载或重装

### 9.1 注销并删除某个发行版

只想抹掉 Ubuntu 重装一遍(数据全清):

```powershell
wsl --unregister Ubuntu-24.04
```

`--unregister` 会把这个发行版的 `ext4.vhdx` 文件一并删掉,等于从零开始。删完再 `wsl --install -d Ubuntu-24.04` 重新装。

### 9.2 Docker Desktop 重置 / 卸载

**软重置(保留容器和镜像数据外的配置)**:Docker Desktop → Settings → Troubleshoot → **Clean / Purge data**,选择性清掉缓存。

**硬重置(回出厂)**:Settings → Troubleshoot → **Reset to factory defaults**——会清掉所有容器、镜像、卷、网络,Docker Desktop 回到刚装完的状态。

**彻底卸载**:Windows 设置 → 应用 → 找 Docker Desktop → 卸载。卸完手动清理残留:

```powershell
# 删 Docker Desktop 的 WSL 子分布
wsl --unregister docker-desktop
wsl --unregister docker-desktop-data

# 删用户目录残留
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Docker"
Remove-Item -Recurse -Force "$env:APPDATA\Docker"
Remove-Item -Recurse -Force "$env:APPDATA\Docker Desktop"
```

清理完重启,再下载新的 Docker Desktop 安装器从头装一遍,绝大多数顽固问题这一波都能解掉。

### 9.3 完全卸载 WSL 本身

最后的兜底,把 WSL 整个组件从 Windows 里拆掉:

```powershell
# 新版 WSL (Store 版) 直接:
wsl --uninstall

# 老版手动:
dism.exe /online /disable-feature /featurename:Microsoft-Windows-Subsystem-Linux /norestart
dism.exe /online /disable-feature /featurename:VirtualMachinePlatform /norestart
```

重启后 WSL 痕迹基本清干净,可以从第三章 `wsl --install` 重新走一遍。

---

## 十、确认上线

走完上面九章,我们手上应该有这些可观测产物:

- `wsl --status` 显示 Default Version: 2
- `wsl -l -v` 列出 Ubuntu-24.04,VERSION 是 2
- Ubuntu 终端里 `docker version` 显示 Server: Docker Engine,OS/Arch: linux/amd64
- `docker run hello-world` 跑出欢迎语
- `%UserProfile%\.wslconfig` 文件存在,内存上限已写

集齐这五条,Windows 这边的 Docker Desktop 环境就稳了,接下来可以回到 container-deploy 课件主线继续走。

---

## 附录:本文引用的官方源

下面这些是写本文时一手核对过的链接,遇到本文没覆盖的边界情况可直接翻原文。

**微软 WSL 官方文档**:

- [Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install) — `wsl --install` 一键安装路径
- [Manual installation steps for older versions of WSL](https://learn.microsoft.com/en-us/windows/wsl/install-manual) — 老 Windows 10 的 6 步手动安装
- [Troubleshooting Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting) — 0x80370102 / 0x800701bc / 0x80070003 等错误码官方解释
- [Advanced settings configuration in WSL](https://learn.microsoft.com/en-us/windows/wsl/wsl-config) — `.wslconfig` 全字段说明
- [How to manage WSL disk space](https://learn.microsoft.com/en-us/windows/wsl/disk-space) — `ext4.vhdx` 扩容 / 收缩 / 修复
- [Basic commands for WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands) — `wsl --update` / `--unregister` / `--list` 等命令参考

**Docker 官方文档**:

- [Install Docker Desktop on Windows](https://docs.docker.com/desktop/setup/install/windows-install/) — Docker Desktop 安装、系统要求、命令行 flag
- [Docker Desktop WSL 2 backend on Windows](https://docs.docker.com/desktop/features/wsl/) — WSL 2 后端原理、配置选项
- [Develop with Docker Desktop using WSL 2 on Windows](https://docs.docker.com/desktop/features/wsl/use-wsl/) — WSL Integration 开发流程
- [WSL 2 best practices for Docker Desktop on Windows](https://docs.docker.com/desktop/features/wsl/best-practices/) — 性能与稳定性最佳实践
- [Understand permission requirements for Windows](https://docs.docker.com/desktop/setup/install/windows-permission-requirements/) — `docker-users` 组、UAC、命名管道权限

**GitHub Issues(高赞解决方案出处)**:

- [docker/for-win#13590 — Docker Desktop is unable to detect a Hypervisor](https://github.com/docker/for-win/issues/13590)
- [docker/for-win#13015 — Hardware assisted virtualization and data execution protection must be enabled in BIOS](https://github.com/docker/for-win/issues/13015)
- [docker/for-win#13845 — Docker Desktop Unexpected WSL error / docker-desktop missing](https://github.com/docker/for-win/issues/13845)
- [docker/for-win#14366 — Docker Desktop Unexpected WSL error](https://github.com/docker/for-win/issues/14366)
- [docker/for-win#12291 — Group policy for Server service prevents installation](https://github.com/docker/for-win/issues/12291)
- [microsoft/WSL#5393 — WslRegisterDistribution failed with error: 0x800701bc](https://github.com/microsoft/WSL/issues/5393)
- [microsoft/WSL#5014 — WSL 2 requires an update](https://github.com/microsoft/WSL/issues/5014)
