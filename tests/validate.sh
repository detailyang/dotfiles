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
done
for validation_group in "$@"; do
    source "tests/validate/$validation_group.sh"
done
unset validation_group

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
