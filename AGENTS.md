# Repository Guidelines

## Project Structure & Module Organization

This is a personal dotfiles repository. Root dotfiles such as `.zshrc`, `.gitconfig`, `.tmux.conf`, and `.vimrc` are installed directly or symlinked into `$HOME`. Shell config is split between `bash/` and `fish/`. Application config lives under `.config/` for WezTerm, Alacritty, Zed, yazi, Home Manager, and lazygit. Reusable command examples live in `snippet/`. Agent material is under `.agents/`, `skills/`, and `pi/`; `pi/extensions/` contains TypeScript extensions, while `pi/skills/`, `skills/`, and `.agents/skills/` contain skill prompts and references. Platform setup scripts are `install.sh` and `install.ps1`.

## Build, Test, and Development Commands

- `./scripts/validate.sh`: run consistency checks for shell functions, paths, install-script features, and expected removals.
- `./install.sh --dry-run`: exercise the Unix installer without applying changes.
- `./install.sh --mac-apps --npx --pi`: opt into macOS packages, npm, Go, and Pi extension setup.
- `./install.ps1 -NoPull -Verbose`: run Windows setup without pulling first.
- `make help`: list Makefile targets.
- `make centos7`: build, tag, and push the CentOS 7 development Docker image; use only when Docker and registry credentials are configured.

## Coding Style & Naming Conventions

Keep shell scripts Bash or Fish-specific according to their directory. Bash automation should use `set -euo pipefail` and indentation consistent with the touched file. Fish functions use `function name` and `end`, with lowercase hyphenated filenames such as `proxy.fish`. TypeScript under `pi/extensions/` uses ES modules and camelCase identifiers. Preserve existing dotfile formatting unless the change requires otherwise.

## Testing Guidelines

Run `./scripts/validate.sh` after changes to shell config, install scripts, snippets, or dotfiles. For installer work, also run `./install.sh --dry-run` and avoid host-mutating commands unless explicitly requested. Add focused checks to `scripts/validate.sh` for regressions detectable with grep or file-existence assertions.

## Commit & Pull Request Guidelines

Recent history mostly follows Conventional Commits, for example `feat(tmux-status): add animated spinner` and `fix(tmux-status): use TMUX_PANE for window id lookup`. Prefer `feat`, `fix`, `chore`, or `refactor` with an optional scope. Pull requests should explain the affected tool or shell, list validation commands, and call out host-impacting changes such as package installs, symlinks, macOS defaults, or credential-sensitive config.

## Security & Configuration Tips

Do not commit secrets, machine-specific tokens, or private hostnames. Treat `.ssh/`, package manager config, and install scripts as sensitive. Prefer placeholders and document required local values.

## Agent-Specific Instructions

Before editing agent material, read `.agents/AGENTS.md` and the relevant `SKILL.md` files. Keep prompt, skill, and extension changes scoped and verify generated paths with `rg --files`.
