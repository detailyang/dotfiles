# Dotfiles Knowledge Base

**Generated:** 2026-01-18  
**Commit:** d72a79f  
**Branch:** master  

## OVERVIEW
Cross-platform dotfiles repository serving dual purpose: personal configuration management and development framework infrastructure. Supports macOS/Linux/Windows with modular shell configurations, Go-based Alfred workflow development, and extensive command snippet library (85+ commands across 34 categories).

## STRUCTURE
```
dotfiles/
├── fish/           # Fish shell framework (51 modular functions, one per file)
├── snippet/        # 85+ executable command snippets (34 tool categories)
├── alfred/         # Go-based Alfred workflow development (9 workflows)
├── bash/           # Bash configurations (fallback shell, 7 files)
├── .config/        # XDG application configs (starship, wezterm, alacritty)
├── .hammerspoon/   # Lua automation modules (7 modules, macOS-specific)
├── darwin/         # macOS-specific utilities
├── docker/centos7/ # CentOS7 Docker dev environment with Rust
├── bin/            # Utilities (snippte browser, diff-so-fancy, opencode)
├── scripts/        # validate.sh with 32 automated checks
├── install.sh      # Unix/macOS installer with rsync deployment
└── install.ps1     # Windows PowerShell installer
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Shell setup | `fish/`, `bash/` | Fish primary, Bash fallback |
| Snippet browsing | `snippet/` | Tool-first organization (bazel, docker, k8s, ebpf, etc.) |
| Alfred workflows | `alfred/` | Go source + Makefile, not JSON editing |
| macOS automation | `.hammerspoon/` | 7 Lua modules (window, dns, volume, hotkey, reload) |
| Terminal config | `.config/alacritty/`, `.config/wezterm/` | Cross-platform terminals |
| Installation | `install.sh` / `install.ps1` | Platform-specific with backup/rollback |
| Validation | `scripts/validate.sh` | 32 checks (typos, paths, functions) |
| Dev environment | `Makefile`, `docker/centos7/` | Dockerized CentOS7 with Rust |

## CONVENTIONS
- **Dual-platform**: Bash + Fish maintained in parallel (Fish is primary)
- **Modular functions**: Each Fish function in separate `.fish` file, auto-loaded from `~/.config/fish/functions/`
- **Rsync deployment**: Uses `.exclude` patterns, NOT symlinks (unlike typical dotfiles)
- **Snippet system**: Tool-first organization, executable files browsable via `s` (Fish) or `sb` (Bash)
- **Alfred-as-code**: Workflows developed in Go (`make` in alfred/), not JSON editing
- **Backup strategy**: Automatic timestamped backups (`~/.dotfiles-backup-YYYYMMDD_HHMMSS/`) before deployment
- **No CI/CD**: Manual testing only, no GitHub Actions or automated pipelines
- **PATH management**: Centralized in `fish/path.fish` (Fish) and `bash/.path` (Bash) with existence checks

## ANTI-PATTERNS (THIS PROJECT)
- **Do NOT edit Alfred workflows directly** - Use Go source in `alfred/`, run `make` to build
- **Do NOT use `standalone` Bazel strategy** - Deprecated, use `local` instead
- **Do NOT commit sensitive Alfred settings** - Use environment variables for critical settings
- **Do NOT ignore key binding conflicts** - Fish has fzf vs peco Ctrl+R conflict (fzf chosen)
- **Do NOT enable kubectl completion** - Explicitly disabled in `fish/kubectl.fish` for performance
- **Do NOT hardcode paths** - All paths managed centrally with directory existence checks
- **Do NOT modify prompt directly** - Use `__fish_prompt_*` globals or Starship config

## UNIQUE STYLES
- **Fish-first**: Fish configurations more comprehensive than Bash (51 vs 7 files)
- **Proxy management**: Sophisticated 4-mode system (proxy, unproxy, autoproxy, wslproxy) with network range exclusions
- **Snippet system**: 34 categories (bazel, ebpf, k8s, docker, openssl, nvidia), browsable via fzf
- **Docker dev env**: CentOS7 container for consistent development
- **Go-based Alfred**: Complete Go development environment for Alfred workflows (not manual JSON)
- **Three-layer fallback**: Universal pattern for binary resolution (`~/bin/X` → `~/dotfiles/bin/X` → `$(relative)/bin/X`)

## COMMANDS
```bash
# Installation
./install.sh          # macOS/Linux (with --dry-run, --no-pull options)
./install.ps1         # Windows

# Development
make                  # Build CentOS7 Docker image
cd alfred && make     # Build all Alfred workflows

# Shell functions (Fish)
proxy <host>          # Set SOCKS5 proxy (default :7890)
autoproxy             # Auto-detect proxy from macOS settings
unproxy               # Disable proxy
k                     # Kubernetes context switch (fzf)
s                     # Snippet browser (fzf + bat preview)
docker-clean          # Clean Docker resources

# Validation
./scripts/validate.sh # Run 32 automated checks

# Rollback
cp -r ~/.dotfiles-backup-YYYYMMDD_HHMMSS/* ~/
```

## NOTES
- Repository serves both personal dotfiles AND team infrastructure
- Existing AGENTS.md in `.agents/` is Chinese, focuses on AI development principles (library-first, CLI-mandatory, TDD-strict)
- Known issues tracked in `.sisyphus/plans/dotfiles-conservative-refactor.md` (20+ hardcoded proxy ports, cargo PATH inconsistency, duplicate configs)
- Alfred workflows require Go toolchain, build to `~/.alfred/`
- Snippets integrate with tmux via `bin/snippte` binary
- Fish functions NOT in `~/.config/fish/config.fish` - sourced from `~/fish/*.fish` via Home Manager
