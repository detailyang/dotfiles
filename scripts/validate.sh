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
check_if_available fish "fish login starts without optional-tool errors" "! fish -lc true 2>&1 | grep -Eq 'Unknown command: bass|Homebrew installation not found|npm not found'"
check "installer advertises the toolchain option" "./install.sh --help | grep -q -- '--toolchain     Install latest official Go, Rust, and Node.js'"
check "installer accepts toolchain in dry-run mode" "./install.sh --no-pull --dry-run --toolchain"
check "Home Manager leaves language runtimes unmanaged" "! grep -REn 'pkgs\\.(go(_[[:alnum:]_]*)?|rust[[:alnum:]_]*|cargo|nodejs(_[[:alnum:]_]*)?)([[:space:];)]|$)' .config/home-manager"
check "Home Manager leaves Fish unmanaged" "! grep -REn 'programs\\.fish|pkgs\\.fish' .config/home-manager && ! test -e .config/home-manager/apps/fish.nix"
check "installer provides Fish through Homebrew" "sed -n '/^readonly BREW_CLI_PACKAGES=(/,/^)/p' install.sh | grep -q '^    \"fish\"$'"
check "Homebrew package checks verify formula ownership" "grep -Fq 'brew list --formula \"\$package\"' install.sh"
check "installer selects Homebrew Fish as login shell" "grep -Fq 'configure_homebrew_fish_shell' install.sh && grep -Fq 'sudo chsh -s \"\$fish_path\" \"\$USER\"' install.sh"
check "native Fish config loads repository modules" "grep -Fq 'for file in ~/fish/*.fish' .config/fish/config.fish"
check "installer disables automatic macOS updates" "grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool false' install.sh && grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false' install.sh && grep -Fq 'sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false' install.sh"

check "herdr new panes use fish" "grep -q '^default_shell = \"/usr/local/bin/fish\"$' .config/herdr/config.toml"
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
