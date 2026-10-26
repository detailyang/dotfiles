# dotfiles

Personal configs for macOS, Linux, WSL, and Windows.

## Install

```bash
./bootstrap.sh --no-pull --dry-run
./bootstrap.sh --no-pull
./bootstrap.sh --no-pull --home-manager  # requires Nix with Flakes
```

Only tracked `home/` files deploy to `$HOME`; replacements are backed up under
`~/.dotfiles-backup-*`. Installation can change the login shell, system timezone,
and macOS defaults. More options: `./bootstrap.sh --help`.

Windows: `.\bootstrap.ps1 -NoPull -Verbose`.

## Pi

Requires Pi and the Node.js version specified in [home/.pi/pi-ybw/package.json](home/.pi/pi-ybw/package.json).

```bash
npm --prefix home/.pi/pi-ybw ci
pi install "$(pwd)/home/.pi/pi-ybw"
```

`/help` lists commands; `/diff-view` configures diff display.
[`/gsc`](home/.pi/pi-ybw/extensions/gsc/README.md)
guides you through GSC data and business context, then prioritizes SEO content work.
[`/continue 2h`](home/.pi/pi-ybw/extensions/continue/README.md) sends `continue`
after two hours; `/continue` sends it now.
[Domain proxy](home/.pi/pi-ybw/extensions/domain-proxy/README.md) routes configured hostnames
through `127.0.0.1:7890`; `/domain-proxy` shows its file-based settings.
[Translate](home/.pi/pi-ybw/extensions/translate/README.md) reviews prompts in the
language you're learning, teaches native-language prompts, and offers `/t` and
`/flashcards`.
`bootstrap.sh --pi` installs external extensions, not this local package.
For dependency changes, update `home/.pi/pi-ybw/package.json` and its lockfile together.

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
- [knowledge/](knowledge/README.md): curated learning links and notes; start with [GPU optimization](knowledge/gpu/README.md).
- [home/.pi/pi-ybw/](home/.pi/pi-ybw/): Pi extensions, skills, prompts, and themes.

Repository rules: [AGENTS.md](AGENTS.md).
