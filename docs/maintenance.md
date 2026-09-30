# Maintenance ledger

Snapshot: 2026-09-30. Delivery: PR #21 in `detailyang/dotfiles` (open, not merged).

## Scope and baseline

- Base: `origin/master` at `c7e7e44f8019f22e371a78406bef25d05b2ce492`.
- Branch: `chore/maintenance-cleanup`; isolated under `.worktrees/maintenance-cleanup`.
- Existing work: PR #20 upgrades Undici; dependency upgrades are excluded here.
  All ten open Dependabot alerts target Undici and name 8.10.2 as the first fix
  (two high, five medium, three low). PR #20 targets that version; these alerts
  are not fixed or dismissed by this cleanup.
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
| Toolchain | Home Manager flake/lock owns CLI packages, platform/role modules; Mise owns runtimes; Homebrew supplies optional macOS casks | Active; all 13 Nix files parse and native Linux derivation evaluates offline. No closure build or activation performed. |
| Agent material | Shared instructions plus three skill roots; `tests/validate-agent-skills.py` owns inventory | Active; Python metadata/link/budget tests. Domain skills include external tool/device requirements. |
| Pi package | `pi/package.json` registers extensions, skills, prompts and themes; TypeScript/Node checks; local install distinct from installer external extensions | Active; peer Pi APIs, local session/config persistence, network and subprocess boundaries. Fresh dependency setup required. |
| ADR support | Pi ADR extension distributes toolkit and guide into repositories; local `docs/adr` is a consumer | Active tooling; no accepted decisions currently indexed. Confirm copy lifecycle before deleting any duplicates. |
| Snippets / vendored resources | Deployed references, themes, scripts and licenses loaded by user commands or apps | Usage not fully observable; retain absent positive replacement evidence. |

There is no tracked Bazel workspace, root package manager, CI workflow or module
registry. `Makefile`, Pi package metadata and existing validation groups are the
verification authorities; do not create a competing orchestration system.
GitHub reports four dynamic provider workflows (Claude, Copilot, Dependabot,
Dependency Graph), not repository-owned test jobs. Their status is not evidence
that the repository checks ran.

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

Commit `267574b` (`test(pi): align diff fixtures with classic marker defaults`) restores
the verification baseline without modifying runtime behavior. Commit `21d3e239`
intentionally selected classic markers; two integration assertions were not
migrated. The transition test now explicitly requests Bars, retaining its
Bars-to-None behavior check; the exact default-menu assertion expects `+ / -`.
Focused call-rendering, settings and marker suites: 41/41 passed; diff check passed.

## Evidence queue

| Location / problem | Evidence and expected benefit | Risk / dependency / acceptance | Status |
| --- | --- | --- | --- |
| `tests/validate.sh`: false-green invocation, hidden failures and skips | Wrong cwd/missing group returned success; check-level `exit` aborted aggregation. Anchor cwd, preflight groups, isolate checks and retain diagnostics/count skips. | Low; original five regressions and a self-review syntax-error regression reproduced before repair. All six now pass; 92 current dotfiles checks pass with 0 skipped. Group-loading failures also count toward the failing exit status. | Completed: `dc5e2c3`, followed by `8fe0b54` (group-loading regression) |
| Shell validation: host-dependent startup and proxy checks | Replace host login/HOME probes with existing isolated Python harness; four adapter probes become two shared contract tests. | Runtime unchanged; ten harness tests and 28 shell/integration checks pass, including all proxy spellings, WSL mode, failed-output non-evaluation and Fish loader order. | Completed: `2c81c43` |
| Multi-skills design still marked Draft | Active command implements the recorded two-stage interaction, but the old document still gives creation steps. Mark historical and link the actual extension/manifest; preserve rationale. | Documentation only; links checked. Does not claim terminal/IME acceptance or change extension behavior. | Completed: `79da11a` |
| ADR toolkit copies | `initializeAdrFiles` distributes eleven bundled resources plus generated guide to standalone consumers. Local toolkit copies are byte-identical. | Required distribution boundary, not dead code. Preserve scripts, licenses and legacy-marker migration for external consumers. | Retained; source: `pi/extensions/adr`, generated consumer: `docs/adr` |
| Pi inventory duplicates resource roots and assumes cwd | Script passed from the wrong directory and ignored missing registrations. Remove hardcoded roots; use `package.json` relative to script location, validate every registered resource. | Five regression tests cover wrong cwd, missing/moved resources, direct files, malformed declarations and extension factories; type checks pass. | Completed: `206fdb6` |
| Diff layout migration residue | Remove two private wrappers returning only their argument or zero, plus one compiler-reported unused import. All call sites preserve the same values. | 62 renderer/path tests passed before/after the no-op cleanup; unused-local/parameter compiler checks enabled over extensions and tests. No public API or rendering behavior changed. | Completed: `6d79ded` |
| Pi reproducibility | Track `pi/package-lock.json`; README uses `npm ci`. All 321 installed versions unchanged, plus nine optional platform variants locked. Registry URLs are public and credential-free. | Empty-cache `npm --prefix pi ci --cache <temporary-cache> --no-audit --no-fund`: exit 0; `make check-pi`: 285/285 passed, types/inventory passed. Undici stays 8.9.0; PR #20 must regenerate the new lockfile when rebased. | Completed: `582df1d` |

npm 12 reported blocking two dependency install hooks during the clean install:
`@google/genai` (no-op preinstall) and `protobufjs` (version-scheme diagnostic).
Their source was inspected; no allowlist or host policy was changed. The checks
above do not claim those hooks executed or that an interactive Pi session was tested.

## Integrated verification

Code verified at `79da11aca78ad8161912b9ce40301da2e417af89` in a second clean
checkout, `.worktrees/maintenance-verification`. Later changes update only this
ledger. The original `master` checkout remains clean and unchanged.

| Check | Result / classification |
| --- | --- |
| Fresh `npm --prefix pi ci` in clean worktree | Passed, exit 0; also independently tested with an initially empty npm cache |
| `make check` in clean worktree | Passed, exit 0; 92 dotfiles checks, 285 Pi tests, types and inventory; 0 failed, 0 skipped |
| `./bootstrap.sh --no-pull --dry-run` | Passed, exit 0; preview only, not installation |
| From `/tmp`: checkout's `tests/validate.sh shell integrations` and `pi/scripts/check-inventory.mjs` | Passed, exit 0; 28 checks plus resource inventory |
| `nix-instantiate --parse` on every tracked `.nix` file | Passed, exit 0; 13 files |
| `nix --extra-experimental-features 'nix-command flakes' eval --offline --impure --no-write-lock-file --raw './home/.config/home-manager#homeConfigurations.linux-x86_64.activationPackage.drvPath'` | Passed, exit 0, with 60-second/1.5-GiB bounds; derivation evaluation, no build or activation |
| `npm pack --dry-run --json --ignore-scripts` in `pi/` | Passed, exit 0; 143 files, runtime resources and licenses present, no node_modules; no archive published |
| `git diff --check origin/master...HEAD` and focused document links | Passed; every task diff reviewed; generated lock graph compared with baseline |
| Baseline failures / introduced failures | Two obsolete Pi assertions repaired; no remaining failure in executed repository checks |

The dotfiles count changed 93 → 92 because one dispatcher check was added and
four host-dependent adapter probes became two broader isolated contract tests.
No test was skipped to get a passing result. Six dispatcher regressions and five
Pi inventory regressions demonstrate failures before implementation and pass after.

## Retained / blocked scope

- **Existing security work:** ten Undici advisories remain assigned to the already
  open PR #20. Do not duplicate that upgrade or claim security clearance here.
  Whichever PR merges second must reconcile `package.json` and the new lockfile,
  then rerun `npm ci` and domain-proxy/full Pi tests. No automatic merge requested.
- **Platform/runtime evidence:** macOS, Windows, WSL, PowerShell, Zsh, Lua compiler
  and real terminal/IME checks were unavailable. Windows already anchors cwd in
  `Main`; native-command exit propagation and replacement/recovery behavior need
  Windows fixtures before changes. GUI behavior needs the corresponding apps.
- **Not executed:** Nix closure builds, installation/activation, external proxy
  services, package publishing and production operations. Linux derivation
  evaluation and local TLS/CONNECT/WebSocket fixture tests are not substitutes.
- **Deletion evidence:** dynamic shell commands, personal app configs, vendored
  resources and ADR consumer migration logic still have external or unobservable
  users. Keep them until an explicit replacement/consumer inventory exists.
- **CI policy:** no repository test workflow exists; adding runners/platforms
  needs a resource and support-matrix decision, not another task orchestrator.

## Delivery and next action

PR #21 targets `master` directly; topic commits are sequentially integrated, not
a stack pretending to depend on merged work. Review the two validation fixes
together and the lockfile/README/ignore exception together. Revert the PR merge
commit for a complete rollback, or revert associated topics in reverse order.
No data migration or host rollback is required because nothing was deployed.

Default HTTPS push initially lacked Git credential integration (exit 128); a
command-local `gh auth git-credential` helper succeeded. No global credential
configuration changed. Both task-owned worktrees remain available for inspection;
large logs remain outside Git in `/tmp/dotfiles-maintenance.OOiR58/`.

Next action: review PR #21 and coordinate PR #20's security update/lockfile before
merging either order. No other identified high-confidence, locally verifiable
cleanup remains; retained items require the evidence/platform decisions above.
