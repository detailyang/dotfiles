# dotfiles

Personal configs for macOS, Linux, WSL, and Windows.

## Install

```bash
./bootstrap.sh --no-pull --dry-run
./bootstrap.sh --no-pull
./bootstrap.sh --no-pull --home-manager  # requires Nix with Flakes
```

Only tracked `home/` files deploy to `$HOME`; replacements are backed up under
`~/.dotfiles-backup-*`. Installation can change the login shell and macOS defaults.
More options: `./bootstrap.sh --help`.

Windows: `.\bootstrap.ps1 -NoPull -Verbose`.

## Pi

Requires Pi and the Node.js version specified in [pi/package.json](pi/package.json).

```bash
npm --prefix pi install --no-package-lock
pi install "$(pwd)/pi"
```

`/help` lists commands; `/diff-view` configures diff display.
`bootstrap.sh --pi` installs external extensions, not this local package.

## Check

```bash
make check-dotfiles
make check-pi
make check  # both
```

## Layout

- [home/](home/): shell, application, Home Manager, and Mise configuration.
- [home/.agents/](home/.agents/): global instructions and workflow skills; `.agents` links here.
- [home/skills/](home/skills/): domain skills.
- [pi/](pi/): extensions, skills, prompts, and themes.

Repository rules: [AGENTS.md](AGENTS.md).
