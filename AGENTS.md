# Repository Guidelines

## Layout and scope

`home/` mirrors `$HOME`: only tracked files there deploy, at the same relative path.
Keep deployment paths stable. The root `.agents` symlink points to `home/.agents`;
do not replace it with a copied directory.

- `home/bash/`, `home/fish/`, root home dotfiles and `home/.config/`: shell/application configuration.
- `home/.agents/`: global instructions and nine workflow skills; `home/skills/`: domain skills.
- `pi/`: Pi extensions, prompts, skills and themes; skills share static validation, while runtime tests remain separate.
- `installer/`, `bootstrap.sh`, `bootstrap.ps1`: platform installation; `tests/validate/`: validation groups.

## Verification

Run from the repository root; use the checks for the changed surface.

| Surface | Command |
| --- | --- |
| Dotfiles and installer | `make check-dotfiles` |
| Agent instructions and all three skill roots | `bash tests/validate.sh agents` |
| Installer deployment | `./bootstrap.sh --no-pull --dry-run` |
| Pi | `make check-pi` |
| Both dotfiles and Pi | `make check` |

Use `make help` for other targets. Do not run an installation, package activation,
login-shell change or OS-default mutation just to validate documentation.
Add regression checks to the relevant `tests/validate/` group, not the dispatcher.
Report unavailable tools, baseline failures and skipped checks separately.

## Editing conventions

Keep the language and formatting of touched files. Bash automation normally uses
`set -euo pipefail`; test dispatchers may deliberately aggregate failures. Fish
functions use `function` / `end` and lowercase hyphenated filenames. Pi TypeScript
uses ES modules and camelCase. Preserve unrelated user changes.

Before changing agent material, read [global instructions](home/.agents/AGENTS.md)
and only the relevant skill entries. Keep entry points short and reference detail
on demand. In this repository, `name` and `description` are one-line plain YAML
strings; names match skill directories. Repository entry budgets are 4 KiB for the
global AGENTS.md and 8 KiB per SKILL.md, not client token limits. The validator checks local references,
not external URL availability or model behavior. It uses Python 3.9+ standard library.
For tracked-file inventory, prefer `git ls-files`; hidden agent paths must not be
accidentally excluded by default search settings.

## Delivery and safety

Use Conventional Commits. PRs explain affected tools, verification and any host or
credential impact; use a small ASCII flow when it clarifies the change. Never commit
secrets, machine tokens or private hostnames. Treat SSH and installer configuration
as sensitive. Read [the ADR index](docs/adr/README.md) and relevant accepted decisions
only for architecture-affecting work; follow its workflow before adding an ADR.
