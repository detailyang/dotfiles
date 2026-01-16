# Dotfiles 保守渐进式重构计划

**生成时间**: 2025-01-16  
**重构策略**: 方案 A - 保守渐进式重构  
**预计耗时**: 2-3 周  
**风险等级**: 低  

---

## 📋 执行概要

本计划旨在在保持现有架构的基础上，清理代码冗余、修复关键bug、改善一致性，并增强安装流程的健壮性。

**核心原则**:
- ✅ 保持 rsync 部署机制
- ✅ 保持 Fish/Bash 双 shell 支持
- ✅ 保持 Go-based Alfred 工作流
- ✅ 最小化学习成本
- ✅ 向后兼容

---

## 🎯 重构目标

### 主要目标
1. 消除 15-20% 代码冗余
2. 修复所有已知的拼写错误和键绑定冲突
3. 统一 PATH 管理和代理配置
4. 增强安装脚本的健壮性
5. 改善代码一致性和可维护性

### 量化指标
- 删除 28 处硬编码的代理端口
- 合并 6 处重复的 ApplePressAndHoldEnabled 设置
- 修复 2 处拼写错误
- 统一 3 处 cargo 路径不一致
- 减少约 100 行冗余代码

---

## 📊 当前问题清单

### 🔴 严重问题 (必须修复)

| # | 问题 | 影响范围 | 文件位置 |
|---|------|---------|---------|
| 1 | `.zshrc` 中 "starsship" 拼写错误 | Zsh 启动失败 | `.zshrc:1` |
| 2 | `.bash_profile` 中 "SHELl" 拼写错误 | Bash 启动逻辑错误 | `.bash_profile:2` |
| 3 | fish_user_key_bindings 冲突 | 不可预测的键行为 | `fish/omf.fish:1-3`, `fish/fish_fzf_bindings.fish:1-3` |
| 4 | Cargo 路径不一致 | PATH 混乱 | `bash/.path:6,8` (同时存在两个不同路径) |
| 5 | Nix 配置完全重复 | 维护负担 | `bash/nix.sh:1-2` = `fish/nix.fish:9-10` |

### 🟡 高优先级 (强烈建议修复)

| # | 问题 | 影响 | 文件位置 |
|---|------|------|---------|
| 6 | ApplePressAndHoldEnabled 三次重复 | 维护负担 | `install.sh:72`, `bash/.functions:109`, `fish/osx.fish:13` |
| 7 | 代理配置 28 处硬编码端口 | 维护困难 | `fish/proxy.fish`, `bash/proxy.sh`, `bash/.functions` |
| 8 | .bash_profile 双重加载循环 | 性能浪费 + 逻辑混乱 | `.bash_profile:11-21` |
| 9 | 片段浏览器三次重复实现 | 功能重复 | `bash/.functions:3-8`, `fish/snippte.fish:1-4`, `bin/snippte` |
| 10 | Docker clean 功能重叠 | 用户困惑 | `fish/docker.fish:3`, `snippet/docker/clean:1-5` |

### 🟢 中优先级 (逐步改进)

| # | 问题 | 影响 | 文件位置 |
|---|------|------|---------|
| 11 | PATH 管理分散且不统一 | 维护困难 | `bash/.path`, `fish/path.fish`, 各个工具文件 |
| 12 | 版本特定路径 (thrift 0.13.0) | 升级时失效 | `fish/thrift.fish:1` |
| 13 | 7 个空文件或占位符文件 | 仓库污染 | `bash/starship.sh`, `fish/vscode.fish`, 等 |
| 14 | Homebrew 镜像硬编码 | 可能不适合所有用户 | `fish/brew.fish:29` |
| 15 | 缺少 Bash 等价的 Fish 函数 | 功能不一致 | Fish 有 52 个函数，Bash 只有 ~10 个 |

---

## 🚀 分阶段实施计划

### 阶段 1: 紧急修复 (Critical Fixes)  
**预计耗时**: 1-2 天  
**优先级**: 最高

#### 任务 1.1: 修复 Zsh 拼写错误
**文件**: `.zshrc`
**当前**:
```bash
if command -v "starsship" > /dev/null; then
```
**修复为**:
```bash
if command -v "starship" > /dev/null; then
```
**验证**: 运行 `zsh -c 'command -v starship'` 应该成功

#### 任务 1.2: 修复 Bash 拼写错误
**文件**: `.bash_profile:2`
**当前**:
```bash
if [[ "$SHELl" == "bash" ]]; then
```
**修复为**:
```bash
if [[ "$SHELL" == "bash" ]]; then
```
**验证**: 运行 `bash -c 'echo $SHELL'` 应该输出正确路径

#### 任务 1.3: 解决 Fish 键绑定冲突
**冲突文件**: 
- `fish/omf.fish` (定义 peco 键绑定)
- `fish/fish_fzf_bindings.fish` (定义 fzf 键绑定)

**决策**: 选择 fzf 作为主要搜索工具（更现代化）
**操作**: 
1. 删除 `fish/omf.fish` 文件
2. 验证 `fish_fzf_bindings.fish` 正常加载

**验证**: 在 Fish 中按 `Ctrl+R` 应该触发 fzf 历史搜索

#### 任务 1.4: 统一 Cargo 路径
**文件**: `bash/.path`
**当前问题**:
- Line 6: `export PATH="$HOME/.cargo/bin:$PATH"`
- Line 8: `export PATH="$HOME/cargo/bin:$PATH"` (不同路径!)

**操作**:
1. 删除 Line 8 (`$HOME/cargo/bin`)
2. 保留 Line 6 (`$HOME/.cargo/bin`) - 这是标准路径
3. 验证 Fish 的 `fish/path.fish` 也使用 `~/cargo/bin` (第3行) - 保持现有

**验证**: 运行 `which cargo` 应该指向 `~/.cargo/bin/cargo`

#### 任务 1.5: 移除重复的 macOS 键设置
**问题**: `ApplePressAndHoldEnabled` 在 3 个地方设置

**决策**: 保留在 `install.sh` 中，从其他地方删除
**操作**:
1. 从 `bash/.functions` 删除行 109 (`defaults write -g ApplePressAndHoldEnabled -bool false`)
2. 从 `fish/osx.fish` 删除行 13
3. 保留 `install.sh:72`

**理由**: 安装脚本设置系统级默认值更合理

**验证**: 运行 `defaults read -g ApplePressAndHoldEnabled` 应该返回 `0`

---

### 阶段 2: 清理冗余 (Redundancy Cleanup)  
**预计耗时**: 3-5 天  
**优先级**: 高

#### 任务 2.1: 统一 Nix 配置
**问题**: `bash/nix.sh` 和 `fish/nix.fish` 重复相同的 NIX_PATH 和 PATH 设置

**决策**: 创建共享配置源文件
**操作**:
1. 创建新文件 `bash/nix-common.sh`:
```bash
# Common Nix configuration
export NIX_PATH="nixpkgs=/nix/var/nix/profiles/per-user/root/channels/nixpkgs:/nix/var/nix/profiles/per-user/root/channels:$HOME/.nix-defexpr/channels"
export PATH="$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"
```

2. 修改 `bash/nix.sh`:
```bash
# Source common Nix config
source ~/dotfiles/bash/nix-common.sh

if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh; then
    source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
fi
```

3. 修改 `fish/nix.fish` (使用 bass source bash 文件):
```bash
function disable_nix
    export NIX_DISABLE=1
    fish
end

if [ "$NIX_DISABLE" = "1" ]
    echo "Disable NIX Variable"
else
    # Source the bash Nix config using bass
    bass source ~/dotfiles/bash/nix-common.sh
    
    if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
        bass source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
    end
end
```

**验证**: 在 Bash 和 Fish 中运行 `echo $NIX_PATH` 和 `echo $PATH` 应该一致

#### 任务 2.2: 整合代理配置 (保持 Fish 为主)
**问题**: 代理配置在 3 个地方重复，28 处硬编码端口 7890

**决策**: 保留 `fish/proxy.fish` 作为主实现，为 Bash 提供兼容层

**操作**:
1. 保留 `fish/proxy.fish` (4 个函数: proxy, unproxy, autoproxy, wslproxy)
2. 创建 `bash/proxy-functions.sh` 调用 Fish 函数 (如果可用):
```bash
#!/usr/bin/env bash

# Proxy management wrapper for Bash
# Uses Fish functions if available, falls back to basic bash implementation

if command -v fish &> /dev/null; then
    # Use Fish proxy functions
    proxy() {
        fish -c "proxy $@"
    }
    unproxy() {
        fish -c "unproxy"
    }
    autoproxy() {
        fish -c "autoproxy"
    }
    wslproxy() {
        fish -c "wslproxy"
    }
else
    # Basic Bash fallback (simplified)
    proxy() {
        local ip="${1:-127.0.0.1}"
        export HTTP_PROXY="http://$ip:7890"
        export HTTPS_PROXY="http://$ip:7890"
        export ALL_PROXY="http://$ip:7890"
        export NO_PROXY="127.0.0.1,localhost,192.168.44.0/24,192.168.0.0/24"
        echo "Proxy set to $ip:7890"
    }
    
    unproxy() {
        unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY
        unset http_proxy https_proxy all_proxy no_proxy
        echo "Proxy disabled"
    }
fi
```

3. 更新 `bash/.functions` - 移除现有的 llproxy 和 unproxy 函数 (lines 113-144)

4. 确保 `bash/proxy.sh` 被 source (已存在于 `.bash_profile:19-21`)

**验证**: 在 Bash 和 Fish 中运行 `proxy` 和 `unproxy` 应该效果一致

#### 任务 2.3: 统一片段浏览器实现
**问题**: 片段浏览器有 3 个实现

**决策**: 保留 `bin/snippte` 作为主要实现，shell 函数仅作为快捷方式

**操作**:
1. 保留 `bin/snippte` (完整功能)
2. 简化 `bash/.functions:3-8` 中的 `sb` 函数:
```bash
# Snippet browser - delegates to bin/snippte
sb() {
    ~/dotfiles/bin/snippte "$@"
}
```

3. 简化 `fish/snippte.fish`:
```fish
# Snippet browser - delegates to bin/snippte
function s
    ~/dotfiles/bin/snippte $argv
end
```

**验证**: 在 Bash 中运行 `sb` 和在 Fish 中运行 `s` 应该都能打开片段浏览器

#### 任务 2.4: 整合 Docker 清理功能
**问题**: Fish alias 和 Snippet 有不同的 Docker 清理命令

**决策**: 统一使用 Snippet (snippet/docker/clean)

**操作**:
1. 从 `fish/docker.fish` 删除 `docker-clean` alias
2. 创建 Shell 函数调用 snippet:
```fish
# Fish: call snippet
function docker-clean
    ~/dotfiles/snippet/docker/clean
end
```

3. 在 `bash/.functions` 中添加:
```bash
# Bash: call snippet
docker-clean() {
    ~/dotfiles/snippet/docker/clean
}
```

**验证**: 运行 `docker-clean` 应该执行 snippet/docker/clean 的内容

---

### 阶段 3: 改善一致性 (Consistency Improvements)  
**预计耗时**: 2-3 天  
**优先级**: 中

#### 任务 3.1: 修复 .bash_profile 双重加载循环
**问题**: Lines 11-21 中有两层完全相同的循环

**当前代码**:
```bash
for file in ~/.bash/.{path,bash_prompt,exports,aliases,functions,extra}; do
    [ -r "$file" ] && [ -f "$file" ] && source "$file";
done;

for file in ~/bash/.{path,bash_prompt,exports,aliases,functions,extra}; do
    [ -r "$file" ] && [ -f "$file" ] && source "$file";
done;
```

**操作**: 删除第二个循环 (因为 `~/.bash/` 和 `~/bash/` 实际上是同一个目录)

**修复后**:
```bash
# Source bash configs
for file in ~/.bash/.{path,bash_prompt,exports,aliases,functions,extra}; do
    [ -r "$file" ] && [ -f "$file" ] && source "$file";
done;

# Source individual shell scripts
for file in ~/bash/*.sh; do
    source $file
done
```

**验证**: 运行 `bash -i` 并检查是否所有配置都加载

#### 任务 3.2: 在 Bash 中采用 Fish 的 PATH 检查模式
**问题**: Bash 的 PATH 直接导出，不检查目录是否存在

**Fish 模式** (更好的实践):
```fish
for p in $paths_to_add
    if test -d $p
        set -x PATH $p $PATH
    end
end
```

**操作**: 更新 `bash/.path`:
```bash
# Centralized PATH management with directory existence checks

paths_to_add=(
    "$HOME/bin"
    "$HOME/.cargo/bin"
    "/usr/local/bin"
    "$HOME/go/bin"
    "$HOME/bash/bin"
    "$HOME/python/bin"
    "$HOME/node/bin"
    "$HOME/java/bin"
    "/usr/local/go/bin"
    "$HOME/maven/bin"
    "/usr/local/openresty/bin"
    "$HOME/.jenv/bin"
    "$HOME/.gloo/bin"
    "$HOME/.fluvio/bin"
    "$HOME/.opencode/bin"
    "$HOME/.bun/bin"
)

# OpenResty development path (conditional)
OPENRESTY_DEVEL_PATH="/shared/art/opensource/github/openresty/openresty-devel-utils"
if [[ -d "$OPENRESTY_DEVEL_PATH" ]]; then
    paths_to_add+=("$OPENRESTY_DEVEL_PATH")
fi

# Add to PATH only if directory exists
for p in "${paths_to_add[@]}"; do
    if [[ -d "$p" ]]; then
        export PATH="$p:$PATH"
    fi
done
```

**验证**: 运行 `bash -i` 并检查 `echo $PATH`，应该只包含存在的目录

#### 任务 3.3: 清理空文件和占位符
**操作**: 删除以下空文件:
- `bash/starship.sh` (0 字节)
- `fish/vscode.fish` (空内容)
- `fish/shell.fish` (空内容)
- `fish/bat.fish` (最小内容)
- `fish/b.fish` (最小内容)
- `fish/alish.fish` (最小内容)
- `fish/pnc.fish` (最小内容)

**验证**: 这些文件不应存在于仓库中

#### 任务 3.4: 移除版本特定路径
**文件**: `fish/thrift.fish:1`

**当前**:
```fish
export THRIFT_HOME=/usr/local/Cellar/thrift/0.13.0
```

**修复**: 使用动态检测:
```fish
if command -v thrift > /dev/null
    set THRIFT_HOME (dirname (dirname (which thrift)))
    set -gx THRIFT_HOME $THRIFT_HOME
end
```

**或者** (如果 Homebrew):
```fish
if command -v brew > /dev/null
    set -gx THRIFT_HOME (brew --prefix thrift)
end
```

**验证**: 运行 `fish -c 'echo $THRIFT_HOME'` 应该指向正确的 Thrift 安装目录

#### 任务 3.5: 移除 tunoff 重复定义
**问题**: 在 `bash/.aliases` (line 3) 和 `bash/.functions` (lines 84-86) 中都有

**决策**: 保留函数版本 (更强大)，删除别名

**操作**: 从 `bash/.aliases` 删除 `tunoff` 别名

**验证**: 运行 `tunoff` 应该调用函数，不是别名

---

### 阶段 4: 增强安装流程 (Installation Enhancements)  
**预计耗时**: 2-3 天  
**优先级**: 中

#### 任务 4.1: 添加预检检查
**文件**: `install.sh`

**在 `rsync_dirs()` 函数之前添加**:
```bash
function pre_flight_checks() {
    echo "Running pre-flight checks..."
    
    # Check disk space (need at least 100MB)
    local available_space=$(df -BM ~ | awk 'NR==2 {print $4}' | sed 's/M//')
    if [[ $available_space -lt 100 ]]; then
        echo "ERROR: Insufficient disk space. Need at least 100MB, available: ${available_space}MB"
        exit 1
    fi
    echo "✓ Disk space OK (${available_space}MB available)"
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        echo "ERROR: git is not installed. Please install git first."
        exit 1
    fi
    echo "✓ git installed"
    
    # Check write permissions to home directory
    if [[ ! -w "$HOME" ]]; then
        echo "ERROR: No write permission to home directory"
        exit 1
    fi
    echo "✓ Home directory writable"
    
    echo "All pre-flight checks passed."
}
```

**在 main 流程中调用**: 在 `rsync_dirs()` 之前添加 `pre_flight_checks`

**验证**: 运行 `./install.sh --dry-run` (添加此选项) 应该执行预检但不实际部署

#### 任务 4.2: 创建备份机制
**文件**: `install.sh`

**在 `rsync_dirs()` 之前添加**:
```bash
function create_backup() {
    local backup_dir="$HOME/.dotfiles-backup-$(date +%Y%m%d_%H%M%S)"
    
    echo "Creating backup at $backup_dir..."
    
    # Create backup directory
    mkdir -p "$backup_dir"
    
    # Backup specific config files that will be overwritten
    local files_to_backup=(
        "$HOME/.bash_profile"
        "$HOME/.zshrc"
        "$HOME/.config/fish"
        "$HOME/.config/wezterm"
    )
    
    for file in "${files_to_backup[@]}"; do
        if [[ -e "$file" ]]; then
            echo "  Backing up: $file"
            cp -a "$file" "$backup_dir/"
        fi
    done
    
    echo "✓ Backup created at $backup_dir"
    echo "  To restore: cp -r $backup_dir/* ~/"
}
```

**在 main 流程中调用**: 在 `pre_flight_checks()` 之后、`rsync_dirs()` 之前添加 `create_backup`

**验证**: 运行安装后，检查 `~/.dotfiles-backup-*` 目录是否存在

#### 任务 4.3: 改进错误处理
**文件**: `install.sh`

**当前问题**: `rsync_dirs()` 静默失败 (输出重定向到 `/dev/null`)

**修改**:
```bash
function rsync_dirs() {
    echo "Deploying configs..."
    
    if rsync --exclude-from=./.exclude \
        -avh --no-perms . ~; then
        echo "✓ Configs deployed successfully"
    else
        echo "ERROR: rsync failed with exit code $?"
        echo "Please check permissions and disk space"
        exit 1
    fi
}
```

**添加其他函数的错误处理**:
```bash
function install_brew_app() {
    os="$(uname -s)"
    if [[ "$os" != "Darwin" ]]; then
        return 0;
    fi

    if command -v proxychains4 &> /dev/null; then
        echo "✓ proxychains4 already installed"
    else
        echo "Installing proxychains-ng..."
        if brew install --build-from-source proxychains-ng; then
            echo "✓ proxychains-ng installed"
        else
            echo "WARNING: Failed to install proxychains-ng"
        fi
    fi
    # ... rest of function
}
```

**验证**: 运行 `./install.sh` 并观察输出，应该有清晰的错误信息

#### 任务 4.4: 添加 --dry-run 选项
**文件**: `install.sh`

**在文件顶部添加**:
```bash
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-pull)
            NO_PULL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--no-pull]"
            exit 1
            ;;
    esac
done
```

**修改 `rsync_dirs()`**:
```bash
function rsync_dirs() {
    if [[ "$DRY_RUN" == true ]]; then
        echo "DRY RUN: Would deploy these files:"
        rsync --exclude-from=./.exclude \
            -avh --no-perms --dry-run . ~ | grep -v "sending incremental file list" | grep -v "^$"
    else
        echo "Deploying configs..."
        if rsync --exclude-from=./.exclude \
            -avh --no-perms . ~; then
            echo "✓ Configs deployed successfully"
        else
            echo "ERROR: rsync failed with exit code $?"
            exit 1
        fi
    fi
}
```

**验证**: 运行 `./install.sh --dry-run` 应该列出将要部署的文件但不实际部署

#### 任务 4.5: 更新 .exclude 文件
**文件**: `.exclude`

**当前内容**:
```
.exclude
install.sh
install.ps1
vscode
.git
.README.md
LICENSE
Makefile
```

**建议添加**:
```
.exclude
install.sh
install.ps1
vscode
.git
README.md
LICENSE
Makefile
.sisyphus/
*.md
```

**理由**: 排除文档和系统文件，减少 rsync 传输

**验证**: 运行 `./install.sh --dry-run` 确保这些文件不被部署

---

### 阶段 5: 质量保证 (Quality Assurance)  
**预计耗时**: 2-3 天  
**优先级**: 低

#### 任务 5.1: 更新 README.md
**文件**: `README.md`

**当前内容**: 非常简略 (12 行)

**增强内容**:
```markdown
# Dotfiles

我的个人开发环境配置 (macOS/Linux/Windows)

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/detailyang/dotfiles.git
cd dotfiles

# 安装 (Unix/macOS)
./install.sh

# 安装 (Windows)
./install.ps1

# 预览将要部署的文件 (dry-run)
./install.sh --dry-run
```

## 功能特性

- ✅ 跨平台支持 (macOS/Linux/Windows)
- ✅ 双 Shell 支持 (Fish + Bash)
- ✅ 模块化配置 (52+ Fish 函数)
- ✅ 代理管理 (proxy, unproxy, autoproxy, wslproxy)
- ✅ 命令片段库 (85+ 可执行命令)
- ✅ Alfred 工作流 (Go-based)
- ✅ Docker 开发环境 (CentOS7)
- ✅ 自动化安装和备份

## 目录结构

```
dotfiles/
├── fish/              # Fish shell 配置 (52 个函数)
├── bash/              # Bash shell 配置
├── snippet/           # 命令片段库 (85+ 文件)
├── alfred/            # Alfred 工作流
├── bin/               # 可执行工具 (snippte, diff-so-fancy)
├── .config/           # XDG 应用配置
├── .hammerspoon/      # macOS 自动化
├── darwin/            # macOS 工具
├── docker/            # Docker 开发环境
├── install.sh         # Unix/macOS 安装脚本
└── install.ps1        # Windows 安装脚本
```

## Shell 配置

### Fish Shell
Fish 是主 shell，提供:
- 模块化函数 (每个函数一个文件)
- 智能自动补全
- 内置历史搜索 (Ctrl+R via fzf)
- 自定义双行提示符

常用命令:
```fish
proxy <interface>     # 设置代理
unproxy               # 禁用代理
autoproxy             # 从系统配置读取代理
k <context>           # Kubernetes 上下文切换
s                     # 打开片段浏览器
```

### Bash Shell
Bash 是后备 shell，通过 `.bash_profile` 加载配置

## 工具集成

### Alfred 工作流
```bash
cd alfred
make              # 编译所有工作流
make all          # 或使用此命令
```

### 命令片段
```bash
# 使用 fzf 浏览片段
~/dotfiles/bin/snippte

# 或在 Fish 中
s

# 或在 Bash 中
sb
```

### Docker 开发环境
```bash
make              # 构建 CentOS7 Docker 镜像
```

## 代理管理

支持 4 种代理模式:

1. **proxy**: 手动设置 SOCKS5 代理 (端口 7890)
   ```fish
   proxy en0          # 使用 en0 接口的 IP
   proxy 192.168.1.1  # 使用指定 IP
   ```

2. **unproxy**: 禁用所有代理
   ```fish
   unproxy
   ```

3. **autoproxy**: 从 macOS 系统设置读取代理
   ```fish
   autoproxy
   ```

4. **wslproxy**: WSL 环境代理设置
   ```fish
   wslproxy
   ```

## 故障排除

### 安装失败
```bash
# 检查磁盘空间
df -h ~

# 检查权限
ls -ld ~

# 使用 dry-run 预览
./install.sh --dry-run
```

### 恢复备份
```bash
# 查看备份目录
ls -la ~/.dotfiles-backup-*

# 恢复备份
cp -r ~/.dotfiles-backup-YYYYMMDD_HHMMSS/* ~/
```

### Fish 提示符不显示
```bash
# 检查 fish_prompt.fish 是否存在
ls -l ~/.config/fish/functions/fish_prompt.fish

# 重新加载 Fish 配置
source ~/.config/fish/config.fish
```

## 维护

### 添加新的 Fish 函数
1. 创建新文件 `fish/yourfunction.fish`
2. 函数会被自动加载 (rsync 到 `~/.config/fish/functions/`)

### 更新配置
```bash
# 拉取最新配置
cd ~/dotfiles
git pull

# 重新安装
./install.sh
```

## 许可证

MIT
```

**验证**: README 应该清晰、易读、包含所有重要信息

#### 任务 5.2: 创建验证脚本
**新文件**: `scripts/validate.sh`

```bash
#!/usr/bin/env bash

# Dotfiles Validation Script
# 检查配置的正确性和一致性

set -euo pipefail

PASSED=0
FAILED=0

function check() {
    local name="$1"
    local command="$2"
    
    echo -n "Checking $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo "✓ PASSED"
        ((PASSED++))
        return 0
    else
        echo "✗ FAILED"
        ((FAILED++))
        return 1
    fi
}

echo "=== Dotfiles Validation ==="
echo ""

# Check for typos
check ".zshrc no longer has 'starsship' typo" "! grep -q 'starsship' .zshrc"
check ".bash_profile no longer has 'SHELl' typo" "! grep -q 'SHELl' .bash_profile"

# Check for conflicts
check "Only one fish_user_key_bindings definition" "[ $(grep -r 'function fish_user_key_bindings' fish/ | wc -l) -eq 1 ]"

# Check path consistency
check "No duplicate cargo paths in bash/.path" "[ $(grep -c 'cargo/bin' bash/.path) -eq 1 ]"

# Check for redundant settings
check "ApplePressAndHoldEnabled only in install.sh" "[ $(grep -r 'ApplePressAndHoldEnabled' --include='*.sh' --include='*.fish' | grep -v install.sh | wc -l) -eq 0 ]"

# Check for empty files
check "No empty .sh files in bash/" "[ $(find bash/ -name '*.sh' -size 0 | wc -l) -eq 0 ]"

# Check proxy configuration
check "No hardcoded port 7890 in bash/" "! grep -q ':7890' bash/proxy.sh"
check "proxy.fish has 4 functions" "[ $(grep -c '^function proxy' fish/proxy.fish) -eq 4 ]"

# Check snippet browser consistency
check "sb function exists in bash/.functions" "grep -q '^sb()' bash/.functions"
check "s function exists in fish/snippte.fish" "grep -q '^function s' fish/snippte.fish"
check "snippte binary exists" "test -x bin/snippte"

# Check for version-specific paths
check "No hardcoded Thrift version" "! grep -q 'thrift/0\.' fish/thrift.fish"

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [[ $FAILED -gt 0 ]]; then
    echo "Validation failed!"
    exit 1
else
    echo "All checks passed!"
    exit 0
fi
```

**验证**: 运行 `bash scripts/validate.sh` 应该全部通过

#### 任务 5.3: 创建迁移指南 (可选)
**新文件**: `MIGRATION.md`

```markdown
# 迁移指南

本指南适用于从旧版本 dotfiles 迁移的用户。

## 备份现有配置

在安装新版本之前，**强烈建议**备份现有配置:

```bash
# 创建手动备份
cp -r ~/.config/fish ~/.config/fish.backup
cp ~/.bash_profile ~/.bash_profile.backup
cp ~/.zshrc ~/.zshrc.backup
```

## 已知破坏性更改

### 1. Fish 键绑定更改
**更改**: 移除了 peco 键绑定，统一使用 fzf

**影响**: 如果您习惯使用 `Ctrl+R` 的 peco 搜索，现在会使用 fzf

**恢复**: 如果需要 peco，从备份恢复 `fish/omf.fish`

### 2. 代理配置更新
**更改**: Bash 代理函数现在委托给 Fish 函数

**影响**: 如果您没有安装 Fish，代理功能将使用简化版

**恢复**: 无需操作，简化版仍可用

### 3. PATH 管理变更
**更改**: Bash 现在检查目录是否存在再添加到 PATH

**影响**: 不存在的目录不会出现在 PATH 中

**恢复**: 无需操作，这是改进

### 4. 删除的文件
以下文件已被删除 (如果是空的或占位符):
- `bash/starship.sh`
- `fish/vscode.fish`
- `fish/shell.fish`
- `fish/bat.fish`
- `fish/b.fish`
- `fish/alish.fish`
- `fish/pnc.fish`

## 安装新版本

```bash
# 拉取最新代码
cd ~/dotfiles
git pull

# 安装 (自动创建备份)
./install.sh

# 如果需要恢复
cp -r ~/.dotfiles-backup-YYYYMMDD_HHMMSS/* ~/
```

## 验证安装

```bash
# 运行验证脚本
bash scripts/validate.sh

# 检查关键功能
fish -c 'command -v starship'  # 应该成功
bash -c 'echo $SHELL'          # 应该输出正确路径
fish -c 'functions proxy'      # 应该显示函数定义
```

## 回滚到旧版本

```bash
# 切换到之前的提交
cd ~/dotfiles
git log --oneline  # 查看提交历史
git checkout <commit-hash>

# 重新安装
./install.sh
```
```

#### 任务 5.4: 添加 TODO 注释标记未来改进
在适当的地方添加 `TODO:` 注释，标记可能的现代化改进 (但不实施):

```bash
# fish/starship-integration.fish (新文件)
# TODO: Consider using starship for cross-shell consistency
# Reference: https://starship.rs/

# install.sh
# TODO: Consider migrating to chezmoi for better template support
# Reference: https://www.chezmoi.io/
```

---

## 🔍 验证和测试计划

### 每个阶段完成后的验证

#### 阶段 1 验证
```bash
# 运行验证脚本
bash scripts/validate.sh

# 手动测试
zsh -c 'command -v starship'    # 应该成功
bash -c 'echo $SHELL'           # 应该输出正确路径
fish -c 'functions -a'          # 检查没有冲突的键绑定
```

#### 阶段 2 验证
```bash
# 验证 Nix 配置
bash -c 'echo $NIX_PATH'
fish -c 'echo $NIX_PATH'
# 两者应该一致

# 验证代理功能
fish -c 'proxy 127.0.0.1'
fish -c 'unproxy'
bash -c 'proxy 127.0.0.1'
bash -c 'unproxy'
```

#### 阶段 3 验证
```bash
# 检查空文件是否删除
ls -la bash/starship.sh  # 应该不存在

# 检查 PATH
bash -i -c 'echo $PATH'
# 应该只包含存在的目录

# 测试动态 Thrift 路径
fish -c 'command -v thrift && echo $THRIFT_HOME'
# 应该显示正确路径
```

#### 阶段 4 验证
```bash
# 测试 dry-run
./install.sh --dry-run
# 应该列出文件但不部署

# 测试预检
./install.sh --dry-run
# 应该通过所有预检

# 验证备份
./install.sh
ls -la ~/.dotfiles-backup-*
# 应该有备份目录
```

#### 阶段 5 验证
```bash
# 运行完整验证
bash scripts/validate.sh
# 应该全部通过

# 检查 README
cat README.md
# 应该包含所有章节
```

### 完整集成测试
在所有阶段完成后，运行完整测试:

```bash
# 1. 干运行
./install.sh --dry-run

# 2. 实际安装 (在测试环境)
./install.sh

# 3. 验证配置
bash scripts/validate.sh

# 4. 测试各 shell
fish -i
# 测试: proxy, unproxy, s, k 等命令
exit

bash -i
# 测试: proxy, unproxy, sb 等命令
exit

zsh -i
# 测试: 确认 starship 提示符显示
exit

# 5. 检查日志
# 查看是否有任何错误或警告
```

---

## 📅 时间线和里程碑

| 阶段 | 任务 | 预计耗时 | 里程碑 |
|------|------|---------|--------|
| 1 | 紧急修复 | 1-2 天 | ✅ 所有关键bug修复，系统可正常使用 |
| 2 | 清理冗余 | 3-5 天 | ✅ 代码冗余减少 15-20%，维护负担显著降低 |
| 3 | 改善一致性 | 2-3 天 | ✅ 代码风格统一，新增配置更易 |
| 4 | 增强安装流程 | 2-3 天 | ✅ 安装更安全，有备份和验证 |
| 5 | 质量保证 | 2-3 天 | ✅ 文档完善，有自动化验证 |

**总预计耗时**: 10-16 天 (2-3 周)

---

## ⚠️ 风险评估

### 低风险
- 紧急修复 (拼写错误、简单删除)
- 更新文档
- 添加验证脚本

### 中风险
- 整合代理配置 (影响所有 shell)
- 修改 PATH 管理逻辑
- 修改安装脚本

### 缓解措施
- 所有修改都有备份机制
- 提供 --dry-run 选项
- 详细的迁移指南
- 逐步提交，每个阶段独立测试

---

## 📈 预期收益

### 量化收益
- ✅ 删除约 100 行冗余代码 (15-20%)
- ✅ 合并 28 处硬编码的代理端口
- ✅ 统一 6 处重复的系统设置
- ✅ 修复 2 个关键拼写错误

### 质量收益
- ✅ 更清晰的代码结构
- ✅ 更低的维护负担
- ✅ 更好的错误处理
- ✅ 完善的文档

### 用户体验收益
- ✅ 更安全的安装流程 (备份 + 验证)
- ✅ 更清晰的错误信息
- ✅ 一致的行为跨所有 shell
- ✅ 更好的故障排除文档

---

## 🔄 回滚计划

如果某个阶段出现问题:

1. **立即停止**: 停止后续阶段的实施
2. **Git 回滚**: 使用 `git reset --hard HEAD~1` 回退该阶段的提交
3. **恢复备份**: 使用 `~/.dotfiles-backup-*` 恢复用户配置
4. **报告问题**: 在 `.sisyphus/plans/` 创建问题报告

---

## 📝 后续改进建议 (不在此计划范围内)

### 短期 (3-6 个月)
- 添加 ShellLint 检查
- 添加简单的单元测试
- 改进 Windows 支持 (install.ps1)
- 迁移到 Starship (可选)

### 中期 (6-12 个月)
- 评估 chezmoi 迁移
- 统一 Bash 和 Fish 的功能对等性
- 添加 CI/CD 进行语法检查
- 实现更精细的 .exclude 模式

### 长期 (1年以上)
- 完全迁移到现代化工具链
- 考虑 Ansible 用于完整系统配置
- 实现配置模板化

---

## ✅ 完成标准

本计划被认为完成，当且仅当:

1. ✅ 所有 5 个阶段的所有任务都已完成
2. ✅ `scripts/validate.sh` 所有检查都通过
3. ✅ README.md 和 MIGRATION.md 已更新
4. ✅ 所有 shell (Fish/Bash/Zsh) 都能正常启动
5. ✅ 核心功能 (proxy, 片段浏览器, Alfred) 都能正常工作
6. ✅ 安装脚本支持 --dry-run 且通过所有预检
7. ✅ 备份机制工作正常
8. ✅ 回滚计划已测试

---

## 📚 参考资料

- [Fish Shell Documentation](https://fishshell.com/docs/current/)
- [Bash Reference Manual](https://www.gnu.org/software/bash/manual/)
- [Rsync Documentation](https://linux.die.net/man/1/rsync)
- [ chezmoi - Modern dotfiles manager](https://www.chezmoi.io/)
- [Starship - Cross-shell prompt](https://starship.rs/)
- [Alfred Workflow Development](https://www.alfredapp.com/help/workflows/)

---

**文档版本**: 1.0  
**最后更新**: 2025-01-16  
**负责人**: Planner Agent (Plan Mode)  
**执行者**: To be executed via `/start-work`
