#!/usr/bin/env bash

set -uo pipefail

PASSED=0
FAILED=0

function check() {
    local name="$1"
    local command="$2"

    echo -n "Checking $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo "✓ PASSED"
        ((PASSED++))
    else
        echo "✗ FAILED"
        ((FAILED++))
    fi
}

function check_if_available() {
    local tool="$1"
    local name="$2"
    local command="$3"

    if command -v "$tool" > /dev/null 2>&1; then
        check "$name" "$command"
    else
        echo "Skipping $name ($tool not available)"
    fi
}

echo "=== Dotfiles Validation ==="
echo ""

check "bash scripts parse before shell startup" "bash -n install.sh .bash_profile .bashrc bash/*.sh bin/proxy-env bin/codex scripts/*.sh"
check "Bash login shells delegate to the managed bashrc" "grep -Fq 'source \"\$HOME/.bashrc\"' .bash_profile"
check "managed bashrc loads deployed Bash modules" "grep -Fq '\$HOME/bash/.path' .bashrc && grep -Fq '\$HOME/bash/.aliases' .bashrc && cache_dir=\$(mktemp -d) && HOME=\"\$PWD\" XDG_CACHE_HOME=\"\$cache_dir\" bash --noprofile --rcfile .bashrc -ic 'declare -F proxy'; status=\$?; rm -rf \"\$cache_dir\"; [[ \$status -eq 0 ]]"
check "installer backs up the managed bashrc" "sed -n '/^readonly BACKUP_FILES=(/,/^)/p' install.sh | grep -Fq '\"\$HOME/.bashrc\"'"
check "ghostty herdr entry parses" "bash -n bin/ghostty-herdr-entry"
check_if_available fish "fish scripts parse before shell startup" "for f in fish/*.fish; do fish -n \"\$f\" || exit 1; done"
check "Fish FZF bindings are independent of the package manager" "grep -Fq 'fzf --fish | source' fish/fish_fzf_bindings.fish && ! grep -Fq '/opt/homebrew' fish/fish_fzf_bindings.fish"
check_if_available fish "Fish starts without fzf" "fish_path=\$(command -v fish); env PATH=/nonexistent \"\$fish_path\" --no-config -c 'source fish/fish_fzf_bindings.fish; fish_user_key_bindings'"
check_if_available fish "fish login starts without optional-tool errors" "! fish -lc true 2>&1 | grep -Eq 'Unknown command: bass|Homebrew installation not found|npm not found'"
check "installer advertises the Mise toolchain option" "./install.sh --help | grep -q -- '--toolchain     Install Node.js, Python, Go, and Rust with Mise (macOS only)'"
check "installer advertises Home Manager profiles" "./install.sh --help | grep -q -- '--profile NAME'"
check "installer advertises explicit Home Manager activation" "./install.sh --help | grep -q -- '--home-manager'"
check "installer accepts toolchain in dry-run mode" "./install.sh --no-pull --dry-run --toolchain"
check "installer accepts desktop profile in dry-run mode" "./install.sh --no-pull --dry-run --profile desktop"
check "installer accepts Home Manager activation in dry-run mode" "./install.sh --no-pull --dry-run --home-manager"
check "Nix installer has a non-mutating dry run" "test -x scripts/install-nix.sh && ./scripts/install-nix.sh --dry-run | grep -Fq 'Would install Nix'"
check "Nix installer prefers TUNA with official fallback" "grep -Fq 'https://mirrors.tuna.tsinghua.edu.cn/nix/latest/install' scripts/install-nix.sh && grep -Fq 'https://nixos.org/nix/install' scripts/install-nix.sh"
check "Nix installer configures Flakes without legacy channels" "grep -Fq -- '--no-channel-add' scripts/install-nix.sh && grep -Fq -- '--nix-extra-conf-file \"\$NIX_CONFIG_SOURCE\"' scripts/install-nix.sh"
check "Nix installer uses daemon mode for any systemd Linux" "mode_body=\$(sed -n '/^resolve_install_mode()/,/^}/p' scripts/install-nix.sh); grep -Fq 'is_linux && has_systemd' <<< \"\$mode_body\" && ! grep -Fq '! is_wsl' <<< \"\$mode_body\""
check "Nix installer configures existing multi-user daemons" "grep -Fq 'NIX_DAEMON_CONFIG_FRAGMENT=\"/etc/nix/nix.conf.d/dotfiles.conf\"' scripts/install-nix.sh && grep -Fq 'include \$NIX_DAEMON_CONFIG_FRAGMENT' scripts/install-nix.sh && grep -Fq 'restart_nix_daemon' scripts/install-nix.sh"
check "Home Manager installs Mise but leaves language runtimes to it" "grep -Fq 'pkgs.mise' .config/home-manager/modules/common.nix && ! grep -REn 'pkgs\\.(go(_[[:alnum:]_]*)?|rust[[:alnum:]_]*|cargo|nodejs(_[[:alnum:]_]*)?|python3(_[[:alnum:]_]*)?)([[:space:];)]|$)' .config/home-manager"
check "Mise manages the global polyglot toolchain" "grep -Eq '^node[[:space:]]*=' .config/mise/config.toml && grep -Eq '^python[[:space:]]*=' .config/mise/config.toml && grep -Eq '^go[[:space:]]*=' .config/mise/config.toml && grep -Eq '^rust[[:space:]]*=' .config/mise/config.toml"
check "interactive shells activate Mise" "grep -Fq 'mise activate bash' .bashrc && grep -Fq 'mise activate zsh' .zshrc && grep -Fq 'mise activate fish' fish/zz-mise.fish"
check "zsh exposes Go-installed CLI tools before activating Mise" "go_bin_line=\$(grep -n '\$HOME/go/bin' .zshrc | head -n 1 | cut -d: -f1); mise_line=\$(grep -n 'mise activate zsh' .zshrc | cut -d: -f1); [[ -n \"\$go_bin_line\" && -n \"\$mise_line\" && \$go_bin_line -lt \$mise_line ]]"
check "Bash loads Go-installed CLI tools before activating Mise" "grep -Fq '\"\$HOME/go/bin\"' bash/.path && path_line=\$(grep -n '\$HOME/bash/.path' .bashrc | cut -d: -f1); mise_line=\$(grep -n 'mise activate bash' .bashrc | cut -d: -f1); [[ -n \"\$path_line\" && -n \"\$mise_line\" && \$path_line -lt \$mise_line ]]"
check "Fish activates Mise after legacy PATH modules" "[[ \"\$(printf '%s\\n' fish/*.fish | tail -n 1)\" == 'fish/zz-mise.fish' ]]"
check "installer provisions language toolchains through Mise" "grep -Fq 'install_mise_toolchains' install.sh && grep -Fq 'mise install' install.sh && ! grep -Eq '^install_official_(go|node|rust|toolchains)\\(\\)' install.sh"
check "installer keeps Mise toolchains scoped to macOS" "block=\$(sed -n '/^install_mise_toolchains()/,/^}/p' install.sh); grep -Fq 'if ! is_macos; then' <<< \"\$block\""
check "installer activates Home Manager before Mise toolchains and npx tools" "block=\$(sed -n '/^phase_package_management()/,/^}/p' install.sh); home_manager_line=\$(grep -n 'setup_home_manager' <<< \"\$block\" | cut -d: -f1); mise_line=\$(grep -n 'install_mise_toolchains' <<< \"\$block\" | cut -d: -f1); npx_line=\$(grep -n 'install_npx_tools' <<< \"\$block\" | cut -d: -f1); [[ -n \"\$home_manager_line\" && -n \"\$mise_line\" && -n \"\$npx_line\" && \$home_manager_line -lt \$mise_line && \$mise_line -lt \$npx_line ]]"
check "npx tools execute inside the Mise environment" "block=\$(sed -n '/^install_npx_tools()/,/^}/p' install.sh); grep -Fq 'mise exec -- npx' <<< \"\$block\" && ! grep -Fq '/usr/bin/env npx' <<< \"\$block\" && ! grep -Fq 'check_command npx' <<< \"\$block\""
check "legacy language version managers are disabled" "! grep -Fqx '    \"nvm\"' install.sh && ! grep -REn '/usr/local/go/bin|\$HOME/(node|python)/bin|~/((node|python)/bin)' bash/.path fish/path.fish"
check "Home Manager leaves Fish unmanaged" "! grep -REn 'programs\\.fish|pkgs\\.fish' .config/home-manager && ! test -e .config/home-manager/apps/fish.nix"
check "Homebrew provides only the Fish executable" "fish_packages=\$(sed -n '/^readonly BREW_FISH_PACKAGES=(/,/^)/p' install.sh); [[ \$(grep -c '^    \"' <<< \"\$fish_packages\") -eq 1 ]] && grep -Fqx '    \"fish\"' <<< \"\$fish_packages\""
check "Home Manager provides the complete Fish runtime" "for package in eza fd fzf mcfly peco starship zoxide; do grep -Fq \"pkgs.\$package\" .config/home-manager/modules/common.nix || exit 1; done"
check "Home Manager installs delta through Git integration" "grep -Fq 'programs.delta.enable = true;' .config/home-manager/apps/git.nix && grep -Fq 'programs.delta.enableGitIntegration = true;' .config/home-manager/apps/git.nix && ! grep -Fq 'pkgs.delta' .config/home-manager/modules/common.nix"
check "Home Manager replaces removed silver-searcher with ripgrep" "grep -Fq 'pkgs.ripgrep' .config/home-manager/modules/common.nix && ! grep -Rq 'pkgs.silver-searcher' .config/home-manager"
check "Home Manager flake exposes supported platform targets" "test -f .config/home-manager/flake.lock && for target in macos-aarch64 macos-x86_64 linux-aarch64 linux-x86_64 wsl-aarch64 wsl-x86_64; do grep -Fq \"\$target\" .config/home-manager/flake.nix || exit 1; done"
check "Home Manager separates platform and role modules" "test -f .config/home-manager/modules/platform/darwin.nix && test -f .config/home-manager/modules/platform/linux.nix && test -f .config/home-manager/modules/platform/wsl.nix && test -f .config/home-manager/modules/role/development.nix && test -f .config/home-manager/modules/role/desktop.nix"
check "headless Linux profiles disable generic GPU integration" "grep -Fq 'targets.genericLinux.gpu.enable = false;' .config/home-manager/modules/platform/linux.nix"
check "Linux activation rejects generation-bound login shells" "grep -Fq 'home.activation.checkStableLoginShell' .config/home-manager/modules/platform/linux.nix && grep -Fq 'entryBefore [ \"writeBoundary\" ]' .config/home-manager/modules/platform/linux.nix && grep -Fq '\$HOME/.nix-profile/' .config/home-manager/modules/platform/linux.nix && grep -Fq '\$HOME/.local/state/nix/profiles/' .config/home-manager/modules/platform/linux.nix && grep -Fq '/nix/var/nix/profiles/' .config/home-manager/modules/platform/linux.nix && grep -Fq '/nix/store/' .config/home-manager/modules/platform/linux.nix"
check "desktop profile preserves configured developer fonts" "grep -Fq 'pkgs.jetbrains-mono' .config/home-manager/modules/role/desktop.nix && grep -Fq 'pkgs.fira-code' .config/home-manager/modules/role/desktop.nix"
check "standard macOS install provisions the Fish executable" "sed -n '/^phase_package_management()/,/^}/p' install.sh | grep -Fq 'if ! install_homebrew_fish; then'"
check "standard Linux install provisions the Fish executable" "sed -n '/^phase_package_management()/,/^}/p' install.sh | grep -Fq 'if ! install_linux_fish; then'"
check "Linux Fish installation supports common package managers" "grep -Fq 'check_command apt-get' install.sh && grep -Fq 'check_command dnf' install.sh && grep -Fq 'check_command yum' install.sh && grep -Fq 'check_command pacman' install.sh && grep -Fq 'check_command zypper' install.sh && grep -Fq 'check_command apk' install.sh"
check "Arch Fish installation avoids a partial system upgrade" "grep -Fq 'run_as_root pacman -S --needed --noconfirm fish' install.sh && ! grep -Fq 'pacman -Sy' install.sh"
check "Homebrew package checks verify formula ownership" "grep -Fq 'brew list --formula \"\$package\"' install.sh"
check "installer selects Homebrew Fish as login shell" "grep -Fq 'fish_path=\"\$(brew --prefix)/bin/fish\"' install.sh && grep -Fq 'sudo chsh -s \"\$fish_path\" \"\$USER\"' install.sh"
check "installer selects Linux Fish as login shell" "grep -Fq 'fish_path=\"\$(find_system_fish)\"' install.sh && grep -Fq 'configure_fish_login_shell \"\$fish_path\"' install.sh && ! grep -Fq 'configure_fish_login_shell \"\$(command -v fish)\"' install.sh"
check "Linux login shell rejects generation-bound Fish paths" "grep -Fq '\$HOME/.nix-profile/' install.sh && grep -Fq '\$HOME/.local/state/nix/profiles/' install.sh && grep -Fq '/nix/store/' install.sh"
check "native Fish config loads repository modules" "grep -Fq 'for file in ~/fish/*.fish' .config/fish/config.fish"
check "native Fish config loads the Home Manager profile" "grep -Fq '~/.nix-profile/bin' fish/path.fish"
check "installer activates the locked Home Manager flake" "grep -Fq 'nix run \"\$home_manager_dir#home-manager\"' install.sh && grep -Fq -- '--flake \"\$home_manager_dir#\$target\" switch' install.sh"
check "Home Manager activation is verbose and memory bounded" "grep -Fq -- '--impure -v --option max-jobs 1 --option cores 2' install.sh"
check "Home Manager activation is explicit" "package_phase=\$(sed -n '/^phase_package_management()/,/^}/p' install.sh); grep -Fq 'if [[ \"\$activate_home_manager\" == true ]]' <<< \"\$package_phase\" && grep -Fq 'setup_home_manager \"\$home_manager_profile\"' <<< \"\$package_phase\""
check "installer defaults to skipping Home Manager activation" "grep -Fq 'local activate_home_manager=false' install.sh && grep -Fq 'phase_package_management \"\$install_mac_apps\" \"\$install_npx\" \"\$install_pi\" \"\$install_toolchain\" \"\$activate_home_manager\" \"\$home_manager_profile\"' install.sh"
check "legacy Home Manager channels are no longer used" "! grep -Eq 'nix-channel|nix-shell.*home-manager' install.sh"
check "Nix prefers the TUNA binary cache with official fallback" "grep -Fq 'substituters = https://mirrors.tuna.tsinghua.edu.cn/nix-channels/store https://cache.nixos.org/' .config/nix/nix.conf && ! grep -Eq 'mirror.sjtu|mirrors.ustc' .config/nix/nix.conf"
check "Nix trusts the official cache signing key" "grep -Fq 'trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=' .config/nix/nix.conf && ! grep -Fq 'kb9Kaaa' .config/nix/nix.conf"
check "installer disables automatic macOS updates" "grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool false' install.sh && grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false' install.sh && grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false' install.sh"

check "herdr resolves Fish from PATH" "grep -q '^default_shell = \"fish\"$' .config/herdr/config.toml"
check "Ghostty Herdr entry resolves Fish from PATH" "grep -q '^fish_shell=\"\$(command -v fish || true)\"$' bin/ghostty-herdr-entry && grep -Fq 'Fish is not installed or not available in PATH' bin/ghostty-herdr-entry"
check "Fish launchers avoid platform-specific paths" "! grep -Eq '/opt/homebrew/bin/fish|/usr/local/bin/fish' install.sh .config/herdr/config.toml bin/ghostty-herdr-entry"
check "herdr starts fish as a login shell" "grep -q '^shell_mode = \"login\"$' .config/herdr/config.toml"

check "proxy-env is the executable proxy env module" "test -x bin/proxy-env"
check "proxy-env bash adapter output sets the default proxy endpoint" "[[ \"\$(./bin/proxy-env bash proxy)\" == *'export HTTP_PROXY=http://192.168.33.1:7890'* ]]"
check "proxy-env fish adapter output sets the default proxy endpoint" "[[ \"\$(./bin/proxy-env fish proxy)\" == *\"set -gx HTTP_PROXY 'http://192.168.33.1:7890'\"* ]]"
check "proxy-env keeps NO_PROXY rules local to the deep module" "bash -lc 'eval \"\$(./bin/proxy-env bash proxy)\" >/dev/null; [[ \"\$NO_PROXY\" == 127.0.0.1,localhost,192.168.44.0* ]]'"
check "proxy-env exposes WSL host mode consistently" "[[ \"\$(./bin/proxy-env bash wslproxy)\" == *'export HTTP_PROXY=http://127.0.0.1:7890'* ]]"
check "proxy-env clears every proxy spelling plus GOPROXY" "[[ \"\$(./bin/proxy-env bash unproxy)\" == *'unset GOPROXY'* ]]"
check "autoproxy supports Linux system and environment proxy sources" "bash scripts/test-proxy-autoproxy.sh"

check "bash proxy adapter applies the shared proxy env interface" "bash -lc 'source bash/proxy.sh; proxy >/dev/null; [[ \"\$HTTP_PROXY\" == http://192.168.33.1:7890 && -n \"\$NO_PROXY\" ]]'"
check "bash unproxy adapter clears the shared proxy env interface" "bash -lc 'source bash/proxy.sh; export HTTP_PROXY=x; unproxy >/dev/null; [[ -z \"\${HTTP_PROXY:-}\" ]]'"
check_if_available fish "fish proxy adapter applies the shared proxy env interface" "env -i HOME=\"\$HOME\" PATH=\"\$PATH\" fish --no-config -c 'source fish/proxy.fish; proxy >/dev/null; test \"\$HTTP_PROXY\" = http://192.168.33.1:7890; and test -n \"\$NO_PROXY\"'"
check_if_available fish "fish unproxy adapter clears the shared proxy env interface" "env -i HOME=\"\$HOME\" PATH=\"\$PATH\" fish --no-config -c 'source fish/proxy.fish; set -gx HTTP_PROXY x; unproxy >/dev/null; not set -q HTTP_PROXY'"

check "bash proxy adapter does not own proxy rules" "! grep -q 'export HTTP_PROXY=' bash/proxy.sh"
check "fish proxy adapter does not own proxy rules" "! grep -q 'set -gx HTTP_PROXY\|export HTTP_PROXY=' fish/proxy.fish"
check "codex wrapper rotates and restores tmux window name" "bash scripts/test-codex-wrapper.sh"
check "agent workflow uses canonical skill names" "test -f .agents/skills/grill/SKILL.md && test -f .agents/skills/to-spec/SKILL.md && test -f .agents/skills/to-issue/SKILL.md && test -f .agents/skills/ship/SKILL.md && test -f .agents/skills/code-review/SKILL.md && ! test -f .agents/skills/think/SKILL.md && ! test -f .agents/skills/to-prd/SKILL.md && ! test -f .agents/skills/to-issues/SKILL.md"

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [[ $FAILED -gt 0 ]]; then
    echo "Validation failed!"
    exit 1
else
    echo "All checks passed!"
fi
