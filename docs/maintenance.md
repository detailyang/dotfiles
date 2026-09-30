# Maintenance ledger

## Scope and baseline

- Base: `origin/master` at `c7e7e44f8019f22e371a78406bef25d05b2ce492`.
- Branch: `chore/maintenance-cleanup`; isolated under `.worktrees/maintenance-cleanup`.
- Existing work: PR #20 upgrades Undici; dependency upgrades are excluded here.
- Environment: Linux x86_64, Bash 5.1.16, Fish 3.3.1, Python 3.10.12,
  Node 22.22.3, npm 12.0.1. No host activation, deployment, or release.
- Rules: root AGENTS governs this checkout; `home/.agents/AGENTS.md` governs
  shared instructions; Codex routes there. No additional local AGENTS or
  accepted ADRs are tracked. Preserve deployed paths and `.agents` symlink.

## Repository map

| Surface | Ownership, entry and consumers | Lifecycle / verification boundary |
| --- | --- | --- |
| Unix installer | `bootstrap.sh` → `installer/*.sh`; deploys tracked `home/` paths, backs up replaced user files; optional package and host configuration | Active; Bash tests and non-mutating preview. macOS/WSL behavior needs those platforms. |
| Windows installer | `bootstrap.ps1`; narrower Windows application configuration deployment | Supported entry; runtime unverified on Linux. |
| Shell and application configs | Bash/Zsh/Fish startup, `home/bin`, terminal/editor configs; user-invoked functions and dynamically sourced modules | Active/configuration; startup, syntax and integration tests. No absence-of-use inference for personal commands. |
| Toolchain | Home Manager flake/lock owns CLI packages, platform/role modules; Mise owns runtimes; Homebrew supplies optional macOS casks | Active; static checks available. Activation/builds are separate from validation and not authorized here. |
| Agent material | Shared instructions plus three skill roots; `tests/validate-agent-skills.py` owns inventory | Active; Python metadata/link/budget tests. Domain skills include external tool/device requirements. |
| Pi package | `pi/package.json` registers extensions, skills, prompts and themes; TypeScript/Node checks; local install distinct from installer external extensions | Active; peer Pi APIs, local session/config persistence, network and subprocess boundaries. Fresh dependency setup required. |
| ADR support | Pi ADR extension distributes toolkit and guide into repositories; local `docs/adr` is a consumer | Active tooling; no accepted decisions currently indexed. Confirm copy lifecycle before deleting any duplicates. |
| Snippets / vendored resources | Deployed references, themes, scripts and licenses loaded by user commands or apps | Usage not fully observable; retain absent positive replacement evidence. |

There is no tracked Bazel workspace, root package manager, CI workflow or module
registry. `Makefile`, Pi package metadata and existing validation groups are the
verification authorities; do not create a competing orchestration system.

## Initial verification

Commands run from the isolated checkout unless noted. Large logs stay outside
Git in the task's temporary directory.

| Command | Exit / result | Classification |
| --- | --- | --- |
| `make check-dotfiles` | 0; 93 passed, 0 failed | Passed |
| `make check-pi` before dependency setup | 2; `tsc: not found` | Environment prerequisite |
| `npm --prefix pi install --no-package-lock --ignore-scripts --no-audit --no-fund` | 0; 321 packages installed | Setup; no dependency upgrades requested |
| `make check-pi` after dependency setup | 2; types/inventory passed, 278/280 tests passed | Existing failures: two obsolete Bars-default assertions |
| `timeout 45 bazel query //...` | 2; not a Bazel workspace | Not applicable; query was attempted, not a build pass |
| `./bootstrap.sh --no-pull --dry-run` | 0; tracked-file preview only | Passed; does not prove installation |

## Completed themes

### Pi baseline repair

Commit `test(pi): align diff fixtures with classic marker defaults` restores
the verification baseline without modifying runtime behavior. Commit `21d3e239`
intentionally selected classic markers; two integration assertions were not
migrated. The transition test now explicitly requests Bars, retaining its
Bars-to-None behavior check; the exact default-menu assertion expects `+ / -`.
Focused call-rendering, settings and marker suites: 41/41 passed; diff check passed.

## Evidence queue

| Location / problem | Evidence and expected benefit | Risk / dependency / acceptance | Status |
| --- | --- | --- | --- |
| `tests/validate.sh`: false-green invocation, hidden failures and skips | Wrong cwd/missing group returned success; check-level `exit` aborted aggregation. Anchor cwd, preflight groups, isolate checks and retain diagnostics/count skips. | Low; five regressions failed before repair and passed after; all 94 real checks passed with 0 skipped. | Completed: `fix(validation): reject incomplete runs and preserve diagnostics` |
| Shell validation: host-dependent startup and proxy checks | Replace host login/HOME probes with existing isolated Python harness; four adapter probes become two shared contract tests. | Runtime unchanged; ten harness tests and 28 shell/integration checks pass, including all proxy spellings, WSL mode, failed-output non-evaluation and Fish loader order. | Completed: `test(shell): validate checkout adapters without host dotfiles` |
| ADR toolkit copies | `initializeAdrFiles` distributes eleven bundled resources plus generated guide to standalone consumers. Local toolkit copies are byte-identical. | Required distribution boundary, not dead code. Preserve scripts, licenses and legacy-marker migration for external consumers. | Retained; source: `pi/extensions/adr`, generated consumer: `docs/adr` |
| Pi inventory duplicates resource roots and assumes cwd | Script passed from the wrong directory and ignored missing registrations. Remove hardcoded roots; use `package.json` relative to script location, validate every registered resource. | Five regression tests cover wrong cwd, missing/moved resources, direct files, malformed declarations and extension factories; type checks pass. | Completed: `fix(pi): derive inventory checks from package resources` |
| Pi reproducibility | Track `pi/package-lock.json`; README uses `npm ci`. All 321 installed versions unchanged, plus nine optional platform variants locked. Registry URLs are public and credential-free. | Empty-cache `npm --prefix pi ci --cache <temporary-cache> --no-audit --no-fund`: exit 0; `make check-pi`: 285/285 passed, types/inventory passed. Undici stays 8.9.0; PR #20 must regenerate the new lockfile when rebased. | Completed: `build(pi): lock the verified dependency graph` |

npm 12 reported blocking two dependency install hooks during the clean install:
`@google/genai` (no-op preinstall) and `protobufjs` (version-scheme diagnostic).
Their source was inspected; no allowlist or host policy was changed. The checks
above do not claim those hooks executed or that an interactive Pi session was tested.

## Resume

Baseline, dispatcher, shell isolation, manifest inventory and dependency locking
are complete. Remove proven no-op layout wrappers, then run clean-checkout combined
verification, inspect the full diff and create the review PR. Record final commits, PR, remaining evidence gaps
and combined verification here before delivery.
