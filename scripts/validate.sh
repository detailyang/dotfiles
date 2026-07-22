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

check "bash scripts parse before shell startup" "bash -n install.sh bash/*.sh bin/proxy-env bin/codex scripts/*.sh"
check "ghostty herdr entry parses" "bash -n bin/ghostty-herdr-entry"
check_if_available fish "fish scripts parse before shell startup" "for f in fish/*.fish; do fish -n \"\$f\" || exit 1; done"
check "Fish FZF bindings are independent of the package manager" "grep -Fq 'fzf --fish | source' fish/fish_fzf_bindings.fish && ! grep -Fq '/opt/homebrew' fish/fish_fzf_bindings.fish"
check_if_available fish "Fish starts without fzf" "fish_path=\$(command -v fish); env PATH=/nonexistent \"\$fish_path\" --no-config -c 'source fish/fish_fzf_bindings.fish; fish_user_key_bindings'"
check_if_available fish "fish login starts without optional-tool errors" "! fish -lc true 2>&1 | grep -Eq 'Unknown command: bass|Homebrew installation not found|npm not found'"
check "installer advertises the toolchain option" "./install.sh --help | grep -q -- '--toolchain     Install latest official Go, Rust, and Node.js'"
check "installer accepts toolchain in dry-run mode" "./install.sh --no-pull --dry-run --toolchain"
check "Home Manager leaves language runtimes unmanaged" "! grep -REn 'pkgs\\.(go(_[[:alnum:]_]*)?|rust[[:alnum:]_]*|cargo|nodejs(_[[:alnum:]_]*)?)([[:space:];)]|$)' .config/home-manager"
check "Home Manager leaves Fish unmanaged" "! grep -REn 'programs\\.fish|pkgs\\.fish' .config/home-manager && ! test -e .config/home-manager/apps/fish.nix"
check "Homebrew provides only the Fish executable" "fish_packages=\$(sed -n '/^readonly BREW_FISH_PACKAGES=(/,/^)/p' install.sh); [[ \$(grep -c '^    \"' <<< \"\$fish_packages\") -eq 1 ]] && grep -Fqx '    \"fish\"' <<< \"\$fish_packages\""
check "Home Manager provides the complete Fish runtime" "for package in eza fd fzf mcfly peco starship zoxide; do grep -Fq \"pkgs.\$package\" .config/home-manager/home.nix || exit 1; done"
check "Home Manager replaces removed silver-searcher with ripgrep" "grep -Fq 'pkgs.ripgrep' .config/home-manager/home.nix && ! grep -Fq 'pkgs.silver-searcher' .config/home-manager/home.nix"
check "standard macOS install provisions the Fish executable" "sed -n '/^phase_package_management()/,/^}/p' install.sh | grep -Fq 'if ! install_homebrew_fish; then'"
check "Homebrew package checks verify formula ownership" "grep -Fq 'brew list --formula \"\$package\"' install.sh"
check "installer selects Homebrew Fish as login shell" "grep -Fq 'fish_path=\"\$(brew --prefix)/bin/fish\"' install.sh && grep -Fq 'sudo chsh -s \"\$fish_path\" \"\$USER\"' install.sh"
check "native Fish config loads repository modules" "grep -Fq 'for file in ~/fish/*.fish' .config/fish/config.fish"
check "native Fish config loads the Home Manager profile" "grep -Fq '~/.nix-profile/bin' fish/path.fish"
check "installer activates the Home Manager configuration" "grep -Fq 'home-manager -f \"\$HOME/.config/home-manager/home.nix\" switch' install.sh && grep -Fq 'Nix is required to provide the Fish runtime integrations' install.sh"
check "Nix prefers domestic binary caches" "grep -Fq 'substituters = https://mirror.sjtu.edu.cn/nix-channels/store https://mirrors.ustc.edu.cn/nix-channels/store https://cache.nixos.org/' .config/nix/nix.conf"
check "installer disables automatic macOS updates" "grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool false' install.sh && grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false' install.sh && grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false' install.sh"

check "herdr and Ghostty use native Homebrew Fish" "grep -q '^default_shell = \"/opt/homebrew/bin/fish\"$' .config/herdr/config.toml && grep -q '^fish_shell=\"/opt/homebrew/bin/fish\"$' bin/ghostty-herdr-entry"
check "Fish launchers avoid the legacy /usr/local binary" "! grep -Fq '/usr/local/bin/fish' install.sh .config/herdr/config.toml bin/ghostty-herdr-entry"
check "herdr starts fish as a login shell" "grep -q '^shell_mode = \"login\"$' .config/herdr/config.toml"

check "proxy-env is the executable proxy env module" "test -x bin/proxy-env"
check "proxy-env bash adapter output sets the default proxy endpoint" "[[ \"\$(./bin/proxy-env bash proxy)\" == *'export HTTP_PROXY=http://192.168.33.1:7890'* ]]"
check "proxy-env fish adapter output sets the default proxy endpoint" "[[ \"\$(./bin/proxy-env fish proxy)\" == *\"set -gx HTTP_PROXY 'http://192.168.33.1:7890'\"* ]]"
check "proxy-env keeps NO_PROXY rules local to the deep module" "bash -lc 'eval \"\$(./bin/proxy-env bash proxy)\" >/dev/null; [[ \"\$NO_PROXY\" == 127.0.0.1,localhost,192.168.44.0* ]]'"
check "proxy-env exposes WSL host mode consistently" "[[ \"\$(./bin/proxy-env bash wslproxy)\" == *'export HTTP_PROXY=http://127.0.0.1:7890'* ]]"
check "proxy-env clears every proxy spelling plus GOPROXY" "[[ \"\$(./bin/proxy-env bash unproxy)\" == *'unset GOPROXY'* ]]"

check "bash proxy adapter applies the shared proxy env interface" "bash -lc 'source bash/proxy.sh; proxy >/dev/null; [[ \"\$HTTP_PROXY\" == http://192.168.33.1:7890 && -n \"\$NO_PROXY\" ]]'"
check "bash unproxy adapter clears the shared proxy env interface" "bash -lc 'source bash/proxy.sh; export HTTP_PROXY=x; unproxy >/dev/null; [[ -z \"\${HTTP_PROXY:-}\" ]]'"
check_if_available fish "fish proxy adapter applies the shared proxy env interface" "env -i HOME=\"\$HOME\" PATH=\"\$PATH\" fish --no-config -c 'source fish/proxy.fish; proxy >/dev/null; test \"\$HTTP_PROXY\" = http://192.168.33.1:7890; and test -n \"\$NO_PROXY\"'"
check_if_available fish "fish unproxy adapter clears the shared proxy env interface" "env -i HOME=\"\$HOME\" PATH=\"\$PATH\" fish --no-config -c 'source fish/proxy.fish; set -gx HTTP_PROXY x; unproxy >/dev/null; not set -q HTTP_PROXY'"

check "bash proxy adapter does not own proxy rules" "! grep -q 'export HTTP_PROXY=' bash/proxy.sh"
check "fish proxy adapter does not own proxy rules" "! grep -q 'set -gx HTTP_PROXY\|export HTTP_PROXY=' fish/proxy.fish"
check "CONTEXT records Shell capability language" "grep -q '^\\*\\*Shell capability\\*\\*:' CONTEXT.md"
check "CONTEXT records Proxy env language" "grep -q '^\\*\\*Proxy env\\*\\*:' CONTEXT.md"
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
