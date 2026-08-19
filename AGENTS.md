# Repository Guidelines

## Project Structure & Module Organization

This is a personal dotfiles repository organized around one invariant: `home/` mirrors `$HOME`, and every tracked file under `home/` deploys to the same relative path in `$HOME`. Root dotfiles such as `home/.zshrc`, `home/.gitconfig`, `home/.tmux.conf`, and `home/.vimrc` sit at the top of the mirror. Shell config is split between `home/bash/` and `home/fish/`. Application config lives under `home/.config/` for WezTerm, Alacritty, Zed, yazi, Home Manager, and lazygit. Reusable command examples live in `home/snippet/`. Agent material is under `home/.agents/`, `home/skills/`, and `pi/`; the repository root `.agents` is a symlink into `home/.agents` for project-skill discovery. Installer phases live in `installer/`; validation lives in `tests/validate.sh` and `tests/validate/`. Platform setup scripts are `bootstrap.sh` and `install.ps1`.

## Build, Test, and Development Commands

- `./tests/validate.sh`: run consistency checks for shell functions, paths, install-script features, and expected removals.
- `./bootstrap.sh --dry-run`: exercise the Unix installer without applying changes.
- `./bootstrap.sh --mac-apps --npx --pi`: opt into macOS packages, npm, Go, and Pi extension setup.
- `./install.ps1 -NoPull -Verbose`: run Windows setup without pulling first.
- `make help`: list Makefile targets.

## Coding Style & Naming Conventions

Keep shell scripts Bash or Fish-specific according to their directory. Bash automation should use `set -euo pipefail` and indentation consistent with the touched file. Fish functions use `function name` and `end`, with lowercase hyphenated filenames such as `proxy.fish`. TypeScript under `pi/extensions/` uses ES modules and camelCase identifiers. Preserve existing dotfile formatting unless the change requires otherwise.

## Testing Guidelines

Run `./tests/validate.sh` after changes to shell config, install scripts, snippets, or dotfiles. For installer work, also run `./bootstrap.sh --dry-run` and avoid host-mutating commands unless explicitly requested. Add focused checks to `tests/validate.sh` for regressions detectable with grep or file-existence assertions.

## Commit & Pull Request Guidelines

Recent history mostly follows Conventional Commits, for example `feat(tmux-status): add animated spinner` and `fix(tmux-status): use TMUX_PANE for window id lookup`. Prefer `feat`, `fix`, `chore`, or `refactor` with an optional scope. Pull requests should explain the affected tool or shell, list validation commands, and call out host-impacting changes such as package installs, symlinks, macOS defaults, or credential-sensitive config.

## Security & Configuration Tips

Do not commit secrets, machine-specific tokens, or private hostnames. Treat `.ssh/`, package manager config, and install scripts as sensitive. Prefer placeholders and document required local values.

## Agent-Specific Instructions

Before editing agent material, read `.agents/AGENTS.md` and the relevant `SKILL.md` files. Keep prompt, skill, and extension changes scoped and verify generated paths with `rg --files`.
