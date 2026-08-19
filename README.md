# dotfiles

Personal development environment for macOS, Linux, WSL, and Windows. The
repository combines shell and application configuration, a manifest-driven
installer, a cross-platform Home Manager setup, and a Pi coding-agent package.

## Repository layout

The repository is organized around one invariant: **`home/` mirrors `$HOME`**.
Every tracked file under `home/` is deployed to the same relative path in
`$HOME`; nothing outside `home/` is deployed.

- `home/`: the `$HOME` mirror — shell configuration (`home/bash/`,
  `home/fish/`, root dotfiles), application configuration (`home/.config/`),
  Home Manager, Mise, and Nix settings, coding-agent workflow skills
  (`home/.agents/`), domain skills (`home/skills/`), and command examples
  (`home/snippet/`).
- `.agents`: a symlink to `home/.agents` so coding agents can discover
  project skills at the repository root.
- `bootstrap.sh` and `installer/`: Unix installer and its deployment,
  platform, package, and post-install phases. Not deployed.
- `tests/`: validation and test tooling. Not deployed.
- `docs/`: design documents. Not deployed.
- `pi/`: TypeScript extensions, skills, prompts, and themes for Pi.
- `install.ps1`: Windows setup.

## Unix installation

Preview the tracked files that would be deployed:

```bash
./bootstrap.sh --no-pull --dry-run
```

Run the standard installation:

```bash
./bootstrap.sh
```

Home Manager activation and optional components are explicit:

```bash
./installer/install-nix.sh
./bootstrap.sh --home-manager
./bootstrap.sh --home-manager --profile desktop
./bootstrap.sh --home-manager --mac-apps --toolchain --npx --pi
```

Run `./bootstrap.sh --help` for the complete option list.

The installer deploys only Git-tracked files under `home/`.
Replaced files are copied to a timestamped `$HOME/.dotfiles-backup-*`
directory. A non-dry-run installation may also change the login shell, macOS
defaults, installed packages, and Home Manager generations. By default it
attempts to fast-forward from `origin/master`; use `--no-pull` to install the
current checkout unchanged.

## Windows installation

Run from PowerShell:

```powershell
.\install.ps1 -NoPull -Verbose
```

The Windows installer currently has a smaller scope than the Unix installer
and primarily provisions Windows applications and selected configuration.

## Validation

Run the complete repository checks:

```bash
make check
```

This runs the shell, installer, deployment, Home Manager, and configuration
checks in `tests/validate.sh`, followed by Pi type checking, inventory
validation, and unit tests.

Run either validation group independently when working on only one area:

```bash
make check-dotfiles
make check-pi
```

For installer changes, also exercise the non-mutating deployment path:

```bash
./bootstrap.sh --no-pull --dry-run
```

## Development notes

- Keep secrets, private hostnames, tokens, and machine-specific credentials out
  of the repository.
- Anything tracked under `home/` is deployed; untracked files are
  intentionally excluded. Keep secrets untracked (see `.gitignore`).
- Home Manager owns common CLI packages, while Mise owns Node.js, Python, Go,
  and Rust toolchains.
- Homebrew is reserved for the remaining optional macOS applications.
- Run `make help` to list available Make targets.
