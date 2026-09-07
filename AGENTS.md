# Repository Guidelines

Read [global instructions](home/.agents/AGENTS.md), then only task-relevant skills.
Use [README.md](README.md) for layout, installation, and Pi usage; keep this file
focused on repository-specific constraints rather than duplicating global policy.

## Boundaries

- Unix deployment copies only Git-tracked `home/` files to the same paths under
  `$HOME`. Keep these paths stable; new untracked files are excluded from previews.
  Windows has a separate, narrower installer.
- Root `AGENTS.md` is repository-local; `home/.agents/AGENTS.md` is deployed global
  policy. Preserve `.agents -> home/.agents` as a symlink, not a copied directory.
- Home Manager owns shared CLI packages, Mise owns runtimes, and Homebrew supplies
  optional macOS casks. Linux login Fish must remain a stable system executable,
  not a Nix-generation path.
- `pi/package.json` owns Pi resources, dependencies, and test commands. The local
  Pi package is separate from the external extensions installed by `--pi`.

## Editing

Check `git status --short` and `git worktree list` before editing. Isolate parallel
work in separate branches under the ignored `.worktrees/`; preserve other tasks'
checkouts and changes. Use `git ls-files` for inventories, including hidden agent
paths. Verify claims against scripts and manifests, not just help or old docs.

Keep README a short personal quick reference, not a setup tutorial.
Keep existing Bash, Fish, and TypeScript conventions. Bash automation normally
uses `set -euo pipefail`; test dispatchers may aggregate failures. Read
[the ADR index](docs/adr/README.md) and relevant accepted decisions only for
architecture-affecting work; follow its workflow before adding an ADR.

## Verification

Run from the repository root; choose checks for the changed surface.

| Surface | Command |
| --- | --- |
| Documentation | `git diff --check`; inspect local links and documented commands |
| Agent instructions and all three skill roots | `bash tests/validate.sh agents` |
| Dotfiles and installer | `make check-dotfiles` |
| Deployment or installation instructions | `./bootstrap.sh --no-pull --dry-run` |
| Pi types, inventory, and unit tests | `make check-pi` |
| Both dotfiles and Pi | `make check` |

The dotfiles groups are `shell`, `installer`, `toolchain`, `integrations`, and
`agents`; add regression checks to `tests/validate/`, not the dispatcher. Pi
collects `tests/*.test.ts` through `npm --prefix pi test`; do not add per-suite
npm aliases. See the README for dependency setup. For a focused Pi suite,
run `node --test tests/<name>.test.ts` from `pi/`.

Always pair previews with `--no-pull`. Do not validate docs by installing packages,
activating Home Manager, changing login shells, or mutating OS defaults. Static
checks and dry runs do not prove installation success. Report unavailable tools,
baseline failures, and skipped checks separately from passes.

## Agent material

Skill roots: `home/.agents/skills/`, `home/skills/`, and `pi/skills/`. Keep entries
short and references on demand. `name` and `description` are one-line plain YAML
strings; names match directories and are unique across roots. Update the inventory
in `tests/validate-agent-skills.py` when adding or removing workflow skills.

The Python 3.9+ standard-library validator checks metadata, inventory, local links,
and entry budgets: 4 KiB for global AGENTS.md and 8 KiB per SKILL.md. These are
repository budgets, not client token limits; checks do not verify external URLs
or model behavior.

## Delivery

Never commit secrets, tokens, credentials, or private hostnames; `.gitignore` does
not protect tracked files. Treat SSH and installer configuration as sensitive.
When requested, use Conventional Commits and describe affected tools, verification,
and host or credential impact in PRs. Follow the global authorization boundaries.
