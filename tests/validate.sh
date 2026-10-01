#!/usr/bin/env bash

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 2

PASSED=0
FAILED=0
SKIPPED=0

function check() {
    local name="$1"
    local command="$2"
    local output status

    echo -n "Checking $name... "
    # A check may change directories or exit; neither may stop other checks.
    if output=$(eval "$command" 2>&1); then
        echo "✓ PASSED"
        ((PASSED+=1))
    else
        status=$?
        echo "✗ FAILED (exit $status)"
        printf '%s\n' "$output"
        ((FAILED+=1))
    fi
    return 0
}

function check_if_available() {
    local tool="$1"
    local name="$2"
    local command="$3"

    if command -v "$tool" > /dev/null 2>&1; then
        check "$name" "$command"
    else
        echo "Skipping $name ($tool not available)"
        ((SKIPPED+=1))
    fi
}

echo "=== Dotfiles Validation ==="
echo ""

# With no arguments, run the complete suite as before. Validate all requested
# names before running any group; never source an arbitrary user-supplied path.
if [[ $# -eq 0 ]]; then
    set -- shell installer toolchain integrations agents
fi
for validation_group in "$@"; do
    case "$validation_group" in
        shell|installer|toolchain|integrations|agents) ;;
        *) echo "Unknown validation group: $validation_group" >&2; exit 2 ;;
    esac
    if [[ ! -r "tests/validate/$validation_group.sh" ]]; then
        echo "Missing validation group: $validation_group" >&2
        exit 2
    fi
done
for validation_group in "$@"; do
    if ! source "tests/validate/$validation_group.sh"; then
        echo "Failed to load validation group: $validation_group" >&2
        ((FAILED+=1))
    fi
done
unset validation_group

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Skipped: $SKIPPED"

if [[ $FAILED -gt 0 ]]; then
    echo "Validation failed!"
    exit 1
elif [[ $SKIPPED -gt 0 ]]; then
    echo "Available checks passed; skipped checks remain unverified."
else
    echo "All checks passed!"
fi
