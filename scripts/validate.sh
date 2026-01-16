#!/usr/bin/env bash

set -euo pipefail

PASSED=0
FAILED=0

function check() {
    local name="$1"
    local command="$2"

    echo -n "Checking $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo "✓ PASSED"
        ((PASSED++))
        return 0
    else
        echo "✗ FAILED"
        ((FAILED++))
        return 1
    fi
}

echo "=== Dotfiles Validation ==="
echo ""

check ".zshrc no longer has 'starsship' typo" "! grep -q 'starsship' .zshrc"
check ".bash_profile no longer has 'SHELl' typo" "! grep -q 'SHELl' .bash_profile"
check "Only one fish_user_key_bindings definition" "[ $(grep -r 'function fish_user_key_bindings' fish/ 2>/dev/null | wc -l) -eq 1 ]"
check "No duplicate cargo paths in bash/.path" "[ $(grep -c 'cargo/bin' bash/.path) -eq 1 ]"
check "ApplePressAndHoldEnabled only in install.sh" "[ $(grep -r 'ApplePressAndHoldEnabled' --include='*.sh' --include='*.fish' | grep -v install.sh | wc -l) -eq 0 ]"
check "bash/starship.sh removed" "[ ! -f bash/starship.sh ]"
check "fish/omf.fish removed" "[ ! -f fish/omf.fish ]"
check "proxy.fish has proxy function" "grep -q '^function proxy' fish/proxy.fish"
check "proxy.fish has unproxy function" "grep -q '^function unproxy' fish/proxy.fish"
check "proxy.fish has autoproxy function" "grep -q '^function autoproxy' fish/proxy.fish"
check "proxy.fish has wslproxy function" "grep -q '^function wslproxy' fish/proxy.fish"
check "sb function exists in bash/.functions" "grep -q 'function sb' bash/.functions"
check "s function exists in fish/snippte.fish" "grep -q 'function s' fish/snippte.fish"
check "snippte binary exists" "test -x bin/snippte"
check "No hardcoded Thrift version" "! grep -q 'thrift/0\.' fish/thrift.fish"
check "docker-clean function in fish" "grep -q 'function docker-clean' fish/docker.fish"
check "docker-clean function in bash" "grep -q 'function docker-clean' bash/.functions"
check "tunoff alias removed from bash/.aliases" "! grep -q 'alias tunoff' bash/.aliases"
check "tunoff function exists in bash/.functions" "grep -q 'function tunoff' bash/.functions"
check "bash/nix-common.sh exists" "test -f bash/nix-common.sh"
check "fish/nix.fish sources nix-common.sh" "grep -q 'nix-common.sh' fish/nix.fish"
check "bash/nix.sh sources nix-common.sh" "grep -q 'nix-common.sh' bash/nix.sh"
check ".exclude includes .sisyphus/" "grep -q '.sisyphus/' .exclude"
check ".exclude includes *.md" "grep -q '\*.md' .exclude"
check "install.sh has pre_flight_checks function" "grep -q 'function pre_flight_checks' install.sh"
check "install.sh has create_backup function" "grep -q 'function create_backup' install.sh"
check "install.sh supports --dry-run" "grep -q '\-\-dry-run' install.sh"

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [[ $FAILED -gt 0 ]]; then
    echo "Validation failed!"
    exit 1
else
    echo "All checks passed!"
    exit 0
fi
