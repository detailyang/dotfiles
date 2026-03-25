# Dotfiles Knowledge Base

**Generated:** 2026-03-24  
**Commit:** fe759f7  
**Branch:** master  

## OVERVIEW
Cross-platform dotfiles repository for personal environment setup and reusable development tooling. The repo targets macOS, Linux, WSL, and Windows, with Fish as the primary shell, Bash as fallback, rsync-based deployment, Go-based Alfred workflow development, and an executable snippet library.

## STRUCTURE
```text
dotfiles/
├── fish/               # 47 Fish modules, sourced from ~/fish/*.fish via Home Manager
├── bash/               # 11 Bash helper scripts; root .bash_profile is the entrypoint
├── snippet/            # 85 executable snippets across 34 categories
├── alfred/             # 7 Go workflow source dirs + 10 packaged .alfredworkflow exports
├── .agents/skills/     # 5 local AI skills
├── .config/            # XDG configs: alacritty, bat, ghostty, home-manager, karabiner, lazygit, nix, opencode, uv, wezterm
├── .hammerspoon/       # macOS automation with 7 Lua modules
├── docker/centos7/     # CentOS7 dev image
├── bin/                # Executables: diff-so-fancy, snippte
├── scripts/            # Validation helpers; validate.sh currently contains stale checks
├── install.sh          # Unix/macOS/WSL installer with phased deployment
├── install.ps1         # Windows installer via winget
├── .bash_profile       # Bash startup entrypoint
├── .zshrc              # Zsh startup config
├── .tmux.conf          # Tmux config
├── .vimrc / .vim/      # Vim config
└── go/ node/ python/ java/  # Per-language bin roots added to PATH when present
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Fish shell behavior | `fish/` | Primary shell implementation; one feature per file |
| Bash startup and parity | `.bash_profile`, `bash/` | Bash sources `bash/.path`, `bash/.aliases`, then selected helper scripts |
| PATH management | `fish/path.fish`, `bash/.path`, `bash/nix-common.sh` | Additive and guarded by existence checks |
| Snippet browser | `bin/snippte`, `fish/snippte.fish`, `bash/snippte.sh`, `snippet/` | Uses three-layer fallback path resolution |
| Proxy behavior | `fish/proxy.fish`, `bash/proxy.sh` | Fish has `proxy`, `unproxy`, `autoproxy`, `wslproxy`; Bash only has `proxy` and `unproxy` |
| Kubernetes context switch | `fish/k8s.fish`, `bash/k8s.sh` | Reads `~/.k8s` lines in `name|kubeconfig-path` format |
| Alfred workflows | `alfred/*/*.go`, `alfred/Makefile`, `alfred/workflows/` | Go source is authoritative; packaged `.alfredworkflow` files are exports |
| Installation and deployment | `install.sh`, `install.ps1`, `.exclude` | Deployment uses rsync excludes, not symlinks |
| Home Manager loading | `.config/home-manager/apps/fish.nix` | Sources `~/fish/*.fish` directly |
| macOS automation | `.hammerspoon/modules/`, `darwin/`, `.config/karabiner/` | Lua automation plus platform-specific helpers |
| Agent-related assets | `.agents/skills/`, `.agent-browser/`, `.config/opencode/` | Repo also stores local AI skill data |
| Validation | `scripts/validate.sh` | Legacy script; does not fully match current tree |

## CONVENTIONS
- **Fish-first**: New interactive shell behavior usually lands in Fish first, with Bash parity kept for core workflows.
- **One feature per Fish file**: The `fish/` directory is modular and loaded as a flat set of files.
- **Three-layer fallback**: Executable wrappers usually resolve binaries in this order: `~/...` -> `~/dotfiles/...` -> repo-relative path.
- **Rsync deployment**: Installation copies files with `.exclude` filters instead of symlinking the repo into place.
- **Markdown is not deployed**: `.exclude` contains `/*.md`, so `AGENTS.md` and `README.md` are documentation only.
- **Root dotfiles matter**: Files like `.bash_profile`, `.zshrc`, `.tmux.conf`, `.gitconfig`, and `.inputrc` are part of the managed state.
- **Alfred is source-first**: The source of truth is the Go code under `alfred/`, not the packaged workflow artifacts.
- **PATH updates are conditional**: Both Fish and Bash only append directories that actually exist.

## ANTI-PATTERNS (THIS PROJECT)
- **Do NOT edit packaged Alfred exports directly**: Change `alfred/*/*.go` and `alfred/Makefile`, then rebuild.
- **Do NOT assume `make` at repo root builds the Docker image**: The root default target is help; use `make centos7`.
- **Do NOT hardcode a single repo path in wrapper functions**: Follow the existing fallback pattern used by `fish/snippte.fish`, `fish/docker.fish`, `fish/nix.fish`, and `bash/snippte.sh`.
- **Do NOT re-enable Fish kubectl completion casually**: `fish/kubectl.fish` leaves it commented out for startup/perf reasons.
- **Do NOT update only one shell for shared workflows**: Core commands like `proxy`, `unproxy`, `k`, and snippet access have both Fish and Bash entrypoints.
- **Do NOT treat `scripts/validate.sh` as authoritative without reading it**: It still references removed files such as `bash/.functions` and fails early.
- **Do NOT edit deployed files under `$HOME` as the primary fix**: The repo is the source of truth; installation copies outward from here.
- **Do NOT forget `.exclude` behavior**: `.sisyphus/`, markdown files, and several repo-only files are intentionally excluded from deployment.

## UNIQUE STYLES
- **Prompt layering**: The repo keeps both a custom Fish prompt in `fish/fish_prompt.fish` and conditional Starship init in `fish/starship.fish`.
- **Asymmetric proxy support**: Fish owns the advanced proxy workflow, including `autoproxy` and `wslproxy`; Bash keeps a lighter subset.
- **Data-driven Kubernetes switching**: `k` reads a user-maintained `~/.k8s` registry and exports both `KUBENAME` and `KUBECONFIG`.
- **Wrapper-over-script design**: Commands like `s` and `docker-clean` are shell wrappers over executable files, not large shell implementations.
- **Dotfiles plus agent assets**: The repo is not only shell config; it also stores local skills and agent/browser integration data.
- **Per-language bin roots**: `go/bin`, `node/bin`, `python/bin`, and `java/bin` are expected to participate in PATH resolution.

## COMMANDS
```bash
# Installation
./install.sh
./install.sh --dry-run
./install.sh --no-pull
./install.sh --mac-apps --npx
./install.ps1 -NoPull -Verbose

# Development
make centos7
cd alfred && make
cd alfred && make fmt

# Validation
./scripts/validate.sh   # currently fails on stale bash/.functions checks

# Fish
proxy en0
autoproxy
unproxy
wslproxy
k
s
docker-clean

# Bash
sb
proxy
unproxy
```

## NOTES
- `alfred/` currently contains 7 Go source workflow directories: `ec`, `errno`, `hex`, `ip`, `sb`, `ts`, `tz`.
- `alfred/workflows/` contains 10 packaged `.alfredworkflow` exports, so source directories and packaged outputs are not one-to-one.
- `alfred/Makefile` still lists `bark` in the `all` target even though there is no `alfred/bark/` source directory or `bark` target in the file.
- `scripts/validate.sh` exits early on 2026-03-24 because it still expects `bash/.functions`, which no longer exists in this repo.
- Fish config is loaded by `.config/home-manager/apps/fish.nix`, which loops over `~/fish/*.fish`; this repo does not rely on `~/.config/fish/functions/` as the primary source.
- `.exclude` filters out markdown, so changes to `AGENTS.md` help contributors and agents but are not part of deployed runtime config.
