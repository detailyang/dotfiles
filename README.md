# Dotfiles

![macOS](https://img.shields.io/badge/macOS-supported-blue?logo=apple)
![Linux](https://img.shields.io/badge/Linux-supported-blue?logo=linux)
![Windows](https://img.shields.io/badge/Windows-supported-blue?logo=windows)
![License](https://img.shields.io/badge/license-MIT-green)

Cross-platform development environment for power users featuring modular shell configurations, 85+ command snippets, and automated deployment with intelligent backup.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Key Features](#key-features)
- [Philosophy & Conventions](#philosophy--conventions)
- [Directory Structure](#directory-structure)
- [Shell Configuration](#shell-configuration)
- [Tools Integration](#tools-integration)
- [Proxy Management](#proxy-management)
- [Installation Options](#installation-options)
- [Backup and Restore](#backup-and-restore)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)
- [License](#license)

## Quick Start

```bash
git clone https://github.com/detailyang/dotfiles.git
cd dotfiles

# Unix/macOS
./install.sh

# Windows
./install.ps1

# Preview deployment (dry-run)
./install.sh --dry-run
```

## Prerequisites

- **Unix/macOS**: Bash 4+, rsync
- **Windows**: PowerShell 5+
- **Optional**: Fish shell (default shell), Homebrew (macOS package manager)
- **Recommended**: Git, fzf (fuzzy finder), Starship (prompt)

The installer will attempt to install missing tools where possible.

## Key Features

- **Cross-platform**: macOS, Linux, and Windows with platform-specific optimizations
- **Automated Installation**: Pre-flight checks, automatic backups, dry-run mode
- **Modular Architecture**: 47 Fish shell functions, each in its own file with dynamic loading
- **Rich Tooling**: 85 command snippets across 34 categories, 10 Alfred workflows
- **Safe Deployment**: Automatic timestamped backups before every installation
- **XDG Compliant**: Application configs follow freedesktop.org standards

## Philosophy & Conventions

### Design Principles

- **Dual-platform shell**: Bash + Fish configurations maintained in parallel
- **Modular functions**: Each shell function in a separate file, sourced dynamically
- **Rsync deployment**: Uses `.exclude` patterns instead of symlinks for portability
- **Alfred-as-code**: Workflows developed in Go, not JSON editing
- **No CI/CD**: Manual testing with emphasis on reliability over automation

### Anti-Patterns to Avoid

- ❌ Edit Alfred workflows directly — Use Go source in `alfred/`
- ❌ Use `standalone` Bazel strategy — Deprecated, use `local` instead
- ❌ Commit sensitive Alfred settings — Critical settings from environment variables
- ❌ Ignore key binding conflicts — Fish has fzf vs peco conflict (Ctrl+R)

## Directory Structure

```
dotfiles/
├── fish/              # Fish shell (47 modular functions)
│   ├── fish_prompt.fish    # Two-line prompt with Git/K8s context
│   ├── proxy.fish          # Advanced 4-mode proxy management
│   ├── path.fish           # Centralized PATH (17 directories)
│   └── [tool].fish         # Tool-specific functions (kubectl, docker, go, etc.)
├── bash/              # Bash shell configuration
│   └── nix-common.sh       # Shared Nix config (Fish + Bash)
├── snippet/           # Command snippets (85 files, 34 categories)
│   ├── bazel/             # Build system (12 commands)
│   ├── docker/            # Container ops (4 commands)
│   ├── k8s/, kube/        # Kubernetes (9 commands)
│   ├── ebpf/              # eBPF tracing (9 scripts)
│   └── [tool]/            # 30+ other categories
├── alfred/            # Alfred workflows (Go-based)
│   ├── workflows/         # 10 compiled workflows
│   └── Makefile           # Build automation
├── bin/               # Executable utilities
│   └── snippte            # fzf-powered snippet browser
├── .config/           # XDG application configs
│   ├── alacritty/, ghostty/, wezterm/  # Terminal emulators
│   ├── karabiner/         # macOS keyboard remapping
│   └── starship.toml      # Cross-shell prompt config
├── .hammerspoon/      # macOS automation (Lua)
├── darwin/            # macOS-specific utilities
├── docker/            # CentOS7 dev environment
├── install.sh         # Unix/macOS installer
└── install.ps1        # Windows PowerShell installer
```

## Shell Configuration

### Fish Shell (Primary)

Fish is the primary shell with **47 modular functions** (one per file):

- **Modular architecture**: Single-responsibility functions with dynamic loading
- **Intelligent completion**: Tool-aware for kubectl, docker, go, etc.
- **History search**: fzf integration with fd backend (Ctrl+R)
- **Custom prompt**: Two-line design with Git branch, K8s context
- **Advanced proxy**: 4-mode system (manual, auto, WSL, disable)

#### Common Fish Commands

```fish
# Proxy management
proxy en0               # Set SOCKS5 proxy via interface IP
proxy 192.168.1.1       # Set via specific IP
autoproxy               # Read from macOS system settings
unproxy                 # Disable all proxies
wslproxy                # Set proxy in WSL environment

# Kubernetes
k <context>             # Fast context switch

# Tools
s                       # Open snippet browser (fzf-powered)
docker-clean            # Clean Docker resources
```

### Bash Shell (Fallback)

Bash provides essential compatibility:

- **PATH management**: Centralized with directory existence checks
- **Shared Nix config**: Delegates to `nix-common.sh` (also used by Fish)
- **Proxy functions**: Lightweight delegation to Fish functions

#### Bash Command Shortcuts

```bash
sb                      # Open snippet browser (Bash version)
```

## Tools Integration

### Alfred Workflows

10 production workflows developed in Go (not JSON):

| Workflow | Purpose |
|----------|---------|
| **ec** | Encode & decode utilities |
| **errno** | Error code lookup |
| **EudicSearch** | Eudic dictionary search |
| **Hex** | Hex encoding/decoding |
| **Hotkeys - Alacritty** | Alacritty terminal shortcuts |
| **IP 归属** | IP geolocation lookup |
| **sb** | Snippet browser integration |
| **SnippetsLab** | SnippetsLab search |
| **Timestamp** | Unix timestamp conversion |
| **Youdao Translator** | Youdao translation |

```bash
cd alfred
make              # Build all workflows
make clean        # Clean build artifacts
```

### Command Snippets

85 executable commands across 34 tool categories:

| Category | Examples |
|----------|----------|
| **bazel** (14) | `aquery`, `profile`, `label` analysis |
| **docker** (4) | `stats`, `clean`, `history` management |
| **k8s** (2) / **kube** (7) | Pod debugging, node info, events |
| **ebpf** (9) | `cgroup.bt`, `vfs_read.bt` tracing |
| **openssl** (4) | `generate_rsa`, `parse_pem` crypto |
| **nvidia** (4) | GPU/driver management |

```bash
# Browse snippets with fzf
~/dotfiles/bin/snippte

# Or use shortcuts
s       # Fish
sb      # Bash
```

### Terminal Configuration

Cross-platform terminal configs in `.config/`:

- **alacritty**: GPU-accelerated terminal emulator
- **ghostty**: Modern, feature-rich terminal
- **wezterm**: Cross-platform with multiplexing
- **starship.toml**: Cross-shell prompt configuration

### Docker Development Environment

CentOS7 container for consistent development:

```bash
make              # Build CentOS7 Docker image with Rust toolchain
```

## Proxy Management

Sophisticated proxy handling with 4 modes:

### 1. Manual Proxy (SOCKS5)
Default port: 7890

```fish
proxy en0               # Auto-detect IP from interface
proxy 192.168.1.1       # Use specific IP address
proxy en0 1080          # Custom port
```

### 2. Auto Proxy
Read from macOS system proxy settings:

```fish
autoproxy
```

### 3. WSL Proxy
Specialized for Windows Subsystem for Linux:

```fish
wslproxy
```

### 4. Disable Proxy

```fish
unproxy
```

**Note**: Proxy configuration is shell-aware and propagates to child processes.

## Installation Options

```bash
# Default installation (with git pull)
./install.sh

# Skip git pull (offline mode)
./install.sh --no-pull

# Preview changes without deploying
./install.sh --dry-run

# Combined options
./install.sh --no-pull --dry-run

# Windows PowerShell
.\install.ps1
```

### What Gets Installed

| Component | Files | Destination |
|-----------|-------|-------------|
| Fish config | `fish/*` | `~/.config/fish/` |
| Bash config | `bash/*` | `~/` + sourced in `.bash_profile` |
| Snippets | `snippet/*` | `~/snippet/` (reference only) |
| Alfred | `alfred/workflows/*.alfredworkflow` | `~/Library/Services/` |
| XDG configs | `.config/*` | `~/.config/` |
| Hammerspoon | `.hammerspoon/*` | `~/.hammerspoon/` |
| Utilities | `bin/*` | `~/bin/` |
| Git config | `.gitconfig`, `.gitignore` | `~/` |

## Backup and Restore

### Automatic Backup

Every installation creates a timestamped backup:

```bash
~/.dotfiles-backup-20250103_114505/
```

**Backup contents**: All existing dotfiles that would be overwritten.

### Manual Restore

```bash
# List available backups
ls -la ~/.dotfiles-backup-*

# Restore from specific backup
cp -r ~/.dotfiles-backup-20250103_114505/* ~/

# Or selectively restore
cp ~/.dotfiles-backup-20250103_114505/.gitconfig ~/
```

### Rollback Strategy

1. New backup created before each install
2. Old backups preserved indefinitely
3. Restore by copying backup contents to home directory

## Troubleshooting

### Installation

```bash
# Check disk space
df -h ~

# Verify permissions
ls -ld ~
ls -l install.sh

# Preview changes before deployment
./install.sh --dry-run
```

### Shell Configuration

**Fish prompt not showing:**
```fish
ls -l ~/.config/fish/functions/fish_prompt.fish
source ~/.config/fish/config.fish
```

**Bash not loading:**
```bash
cat ~/.bash_profile
source ~/.bash_profile
echo $SHELL
```

**Starship issues:**
```bash
which starship
starship --explain
eval "$(starship init bash)"  # or fish
```

### Tools

**fzf missing:**
```bash
brew install fzf              # macOS
apt install fzf               # Ubuntu/Debian
fish_fzf_key_bindings         # Verify bindings
```

**Alfred workflows:**
```bash
go version
cd alfred && go mod download
make -n                       # Dry-run build
```

**Docker environment:**
```bash
docker info
docker-compose build
```

## Maintenance

### Update Dotfiles

```bash
cd ~/dotfiles && git pull && ./install.sh
```

### Add Fish Function

Create `fish/yourfunction.fish`:
```fish
function yourfunction
    # Your logic here
end
```

Auto-loads on next shell start. Reload immediately: `source ~/.config/fish/config.fish`

### Add Snippet

```bash
mkdir -p snippet/yourtool
cat > snippet/yourtool/command.sh << 'EOF'
#!/bin/bash
# Your command here
EOF
chmod +x snippet/yourtool/command.sh
```

Access via `s` (Fish) or `~/dotfiles/bin/snippte`

### Modify Nix

Edit `bash/nix-common.sh` — shared by both Bash and Fish. Changes apply after re-sourcing.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Author**: [@detailyang](https://github.com/detailyang)
**Inspired by**: Best practices from various dotfiles repositories
