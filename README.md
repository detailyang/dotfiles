# Dotfiles

![macOS](https://img.shields.io/badge/macOS-supported-blue?logo=apple)
![Linux](https://img.shields.io/badge/Linux-supported-blue?logo=linux)
![Windows](https://img.shields.io/badge/Windows-supported-blue?logo=windows)
![License](https://img.shields.io/badge/license-MIT-green)

Cross-platform development environment configuration for macOS/Linux/Windows with automated installation, modular shell configurations, and extensive tool integration.

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

- **Cross-platform**: macOS, Linux, and Windows support with platform-specific optimizations
- **Automated Installation**: Pre-flight checks, automatic backups, and dry-run mode
- **Modular Architecture**: Individual function files, dynamic sourcing, minimal coupling
- **Development-focused**: 44 Fish functions, 85 command snippets, 11 Alfred workflows
- **Backup & Rollback**: Automatic timestamped backups before every deployment
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
├── fish/              # Fish shell config (44 modular functions)
│   ├── fish_prompt.fish    # Two-line prompt with Git/K8s context
│   ├── proxy.fish          # 4-mode proxy management
│   ├── path.fish           # Centralized PATH (17 directories)
│   └── [tool].fish         # Tool-specific functions
├── bash/              # Bash shell configuration
│   └── nix-common.sh       # Shared Nix config (Fish + Bash)
├── snippet/           # Command snippets (85 files, 34 categories)
│   ├── bazel/              # Build system commands
│   ├── docker/             # Container management
│   ├── k8s/, kube/         # Kubernetes utilities
│   ├── ebpf/               # eBPF tracing scripts
│   └── [tool]/             # 30+ other categories
├── alfred/            # Alfred workflows (Go-based)
│   ├── workflows/          # 11 compiled workflows
│   └── Makefile            # Build automation
├── bin/               # Executable utilities
│   └── snippte             # fzf-powered snippet browser
├── .config/           # XDG application configs
│   ├── alacritty/          # Terminal emulator
│   ├── ghostty/            # Modern terminal
│   ├── wezterm/            # Cross-platform terminal
│   ├── karabiner/          # macOS keyboard remapping
│   ├── starship.toml       # Cross-shell prompt
│   └── [app]/              # Other app configs
├── .hammerspoon/      # macOS automation (Lua)
├── darwin/            # macOS-specific utilities
├── docker/            # CentOS7 dev environment
├── install.sh         # Unix/macOS installer
└── install.ps1        # Windows PowerShell installer
```

## Shell Configuration

### Fish Shell (Primary)

Fish is the primary shell with **44 modular functions** organized by tool/purpose:

- **Modular architecture**: One function per file for maintainability
- **Intelligent autocompletion**: Tool-aware completions (kubectl, docker, etc.)
- **History search**: fzf integration with `fd` backend (Ctrl+R)
- **Custom prompt**: Two-line design with Git branch, K8s context, and status
- **Proxy management**: 4-mode system (manual, auto, WSL, disable)

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

11 production workflows developed in Go (not JSON):

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

85 command snippets across 34 tool categories:

| Category | Examples |
|----------|----------|
| **bazel** (12) | `aquery`, `profile`, `label` analysis |
| **docker** (4) | `stats`, `clean`, `history` management |
| **k8s** (3) / **kube** (7) | Pod debugging, node info, events |
| **ebpf** (8) | `cgroup.bt`, `vfs_read.bt` tracing |
| **openssl** (5) | `generate_rsa`, `parse_pem` crypto |
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

### Installation Issues

#### Disk Space
```bash
df -h ~               # Check available disk space
```

#### Permissions
```bash
ls -ld ~              # Verify home directory ownership
ls -l install.sh      # Verify installer is executable
```

#### Preview Changes
```bash
./install.sh --dry-run    # See what would be deployed
```

### Shell Issues

#### Fish Prompt Not Showing
```fish
# Check prompt file exists
ls -l ~/.config/fish/functions/fish_prompt.fish

# Reload Fish configuration
source ~/.config/fish/config.fish

# Check for errors
fish --version
```

#### Bash Not Loading Configs
```bash
# Check .bash_profile exists and is sourced
cat ~/.bash_profile

# Reload Bash
source ~/.bash_profile

# Verify shell
echo $SHELL
```

#### Starship Prompt Issues
```bash
# Verify starship is installed
which starship

# Check config for errors
starship --explain

# Re-initialize
eval "$(starship init bash)"
eval "$(starship init fish)"
```

### Tool-Specific Issues

#### fzf Integration Missing
```bash
# Install fzf
brew install fzf      # macOS
# or
apt install fzf       # Ubuntu/Debian

# Check fzf bindings
fish_fzf_key_bindings  # Fish
```

#### Alfred Workflows Not Building
```bash
# Check Go installation
go version

# Update Go modules
cd alfred
go mod download

# Build with verbose output
make -n              # Dry-run
```

#### Docker Environment Issues
```bash
# Check Docker daemon
docker info

# Rebuild image
docker-compose build
```

## Maintenance

### Updating Configuration

```bash
cd ~/dotfiles
git pull
./install.sh              # Deploy latest changes
```

### Adding New Fish Functions

1. Create file: `fish/yourfunction.fish`
2. Write function:
   ```fish
   function yourfunction
       # Your logic here
   end
   ```
3. Function auto-loads on next shell start
4. Reload immediately: `source ~/.config/fish/config.fish`

### Modifying Nix Configuration

Edit `bash/nix-common.sh` — shared between Bash and Fish.

Changes apply to both shells after re-sourcing.

### Adding Snippets

1. Create directory: `snippet/yourtool/`
2. Add executable commands:
   ```bash
   # snippet/yourtool/command.sh
   #!/bin/bash
   # Your command here
   ```
3. Make executable: `chmod +x snippet/yourtool/command.sh`
4. Access via `s` command or `~/dotfiles/bin/snippte`

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Author**: [@detailyang](https://github.com/detailyang)
**Inspired by**: Best practices from various dotfiles repositories
