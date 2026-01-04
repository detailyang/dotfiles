# Dotfiles Knowledge Base

**Generated:** 2025-01-04  
**Commit:** N/A  
**Branch:** main  

## OVERVIEW
Cross-platform dotfiles repository with dual purpose: personal configuration management and development framework infrastructure. Supports macOS/Linux/Windows with modular shell configurations, Alfred workflow development, and extensive command snippet library.

## STRUCTURE
```
dotfiles/
├── fish/           # Fish shell framework (51 functions)
├── alfred/         # Go-based Alfred workflow development
├── snippet/        # 84+ command snippets by category
├── bash/           # Bash configurations and utilities
├── .hammerspoon/   # Lua automation (macOS)
├── .config/        # XDG application configs
├── darwin/         # macOS-specific utilities
├── install.sh      # Unix/macOS installer
└── install.ps1     # Windows PowerShell installer
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Shell setup | `fish/`, `bash/` | Fish preferred, Bash fallback |
| Alfred workflows | `alfred/` | Complete Go development environment |
| Command snippets | `snippet/` | 25+ categories, 84+ commands |
| macOS automation | `.hammerspoon/` | Window management, DNS utilities |
| Terminal config | `.config/alacritty/`, `.config/wezterm/` | Cross-platform terminal configs |
| Installation | `install.sh` / `install.ps1` | Platform-specific automation |
| Development env | `Makefile`, `docker/centos7/` | Dockerized CentOS7 with Rust |

## CONVENTIONS
- **Dual-platform**: Bash + Fish configurations maintained in parallel
- **Modular functions**: Each shell function in separate file, sourced dynamically  
- **Rsync deployment**: Uses `.exclude` patterns, not symlinks
- **No CI/CD**: Manual testing, minimal automation
- **Alfred-as-code**: Workflows developed in Go, not JSON editing

## ANTI-PATTERNS (THIS PROJECT)
- **Do NOT edit Alfred workflows directly** - Use Go source in `alfred/`
- **Do NOT use `standalone` Bazel strategy** - Deprecated, use `local` instead
- **Do NOT commit sensitive Alfred settings** - Critical settings from environment variables
- **Do NOT ignore key binding conflicts** - Fish has fzf vs peco conflict (Ctrl+R)

## UNIQUE STYLES
- **Fish-first**: Fish shell configurations more comprehensive than Bash
- **Proxy management**: Sophisticated proxy handling across all shells
- **Snippet system**: Command snippets organized by tool, not just personal aliases
- **Docker dev env**: CentOS7 container for consistent development
- **AI framework**: Contains development principles (`ai/AGENTS.md`)

## COMMANDS
```bash
# Installation
./install.sh          # macOS/Linux
./install.ps1         # Windows

# Development
make                  # Build CentOS7 Docker image
cd alfred && make      # Build Alfred workflows

# Shell functions (Fish)
proxy <host>          # Set proxy
autoproxy             # Auto-detect proxy
k <context>           # Kubernetes context switch
```

## fish/

### OVERVIEW
Comprehensive Fish shell framework with 52 modular functions covering development tools, proxy management, and terminal customization.

### STRUCTURE
```
fish/
├── fish_prompt.fish     # Custom two-line prompt with Git/K8s context
├── path.fish            # Centralized PATH management (17 directories)
├── proxy.fish           # Advanced proxy functions (4 modes)
├── fish_fzf_bindings.fish # fzf key bindings
├── [category].fish      # 48+ tool-specific functions
└── editorconfig         # Project-wide editor settings
```

### WHERE TO LOOK
| Task | File | Purpose |
|------|------|---------|
| Proxy setup | `proxy.fish` | `proxy`, `autoproxy`, `unproxy`, `wslproxy` |
| Custom prompt | `fish_prompt.fish` | Git/K8s context, two-line design |
| PATH management | `path.fish` | Centralized binary directories |
| fzf integration | `fzf.fish`, `fish_fzf_bindings.fish` | fd backend, copy shortcuts |
| Tool integrations | `[tool].fish` | kubectl, docker, go, python, etc. |

### CONVENTIONS (FISH-SPECIFIC)
- **One function per file**: Each `.fish` file contains single focused function
- **fzf-first search**: Uses `fd --type f` as default fzf command source
- **Proxy-first design**: Sophisticated proxy handling with network ranges
- **No completion loading**: Kubectl and other tools skip completion for speed
- **Dual prompt support**: Starship + custom Fish prompt (conditional)

### ANTI-PATTERNS (FISH)
- **Do NOT enable kubectl completion** - Disabled for performance
- **Do NOT override fzf Ctrl+R** - Conflicts with peco bindings
- **Do NOT hardcode paths** - All paths managed centrally in `path.fish`
- **Do NOT modify prompt directly** - Use `__fish_prompt_*` globals

## snippet/

### OVERVIEW
Command snippet library organized by tool with 84+ reusable commands across 35 categories.

### STRUCTURE
```
snippet/
├── bazel/          # Build system commands (12 files)
├── docker/         # Container management (4 files)  
├── k8s/            # Kubernetes utilities (3 files)
├── kube/           # Advanced K8s operations (7 files)
├── ebpf/           # eBPF tracing scripts (8 files)
├── openssl/        # Crypto utilities (5 files)
├── nvidia/         # GPU/driver commands (4 files)
└── [tool]/         # 25+ other tool categories
```

### WHERE TO LOOK
| Task | Location | Examples |
|------|----------|----------|
| Build analysis | `snippet/bazel/` | `aquery`, `profile`, `label` |
| Container monitoring | `snippet/docker/` | `stats`, `clean`, `history` |
| K8s debugging | `snippet/k8s/`, `snippet/kube/` | `node`, `event`, `pod`, `rollout` |
| System tracing | `snippet/ebpf/` | `cgroup.bt`, `vfs_read.bt` |
| Crypto operations | `snippet/openssl/` | `generate_rsa`, `parse_pem` |

### CONVENTIONS
- **Tool-first organization**: Snippets grouped by command, not use case
- **Executable files**: All snippets are directly executable commands
- **Tmux integration**: Use `snippte` binary for fzf-powered snippet browsing
- **Bazel deprecation**: Avoid `standalone` strategy, use `local` instead

## NOTES
- Repository serves both personal dotfiles AND team infrastructure
- Fix: `.zshrc` has "starsship" typo → "starship"  
- Alfred workflows compile to binaries, requires Go toolchain
- Snippets use tmux integration via `snippte` binary in `bin/`