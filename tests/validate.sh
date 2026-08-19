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

for validation_group in \
    shell \
    installer \
    toolchain \
    integrations \
    agents
do
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
