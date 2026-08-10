#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

PASSED=0
FAILED=0

check() {
    local name="$1"
    shift

    printf 'Checking %s... ' "$name"
    if "$@"; then
        echo "✓ PASSED"
        PASSED=$((PASSED + 1))
    else
        echo "✗ FAILED"
        FAILED=$((FAILED + 1))
    fi
}

test_installer_has_namespaced_module_boundary() {
    local module
    local result=0

    [[ -x "$PWD/bootstrap.sh" ]] || result=1
    [[ ! -e "$PWD/install.sh" ]] || result=1

    for module in core plan deploy platform packages postinstall main; do
        [[ -f "$PWD/scripts/install/$module.sh" ]] || result=1
    done

    if ! bash -c 'source "$1"; declare -F ybw::install::main > /dev/null; ! declare -F | awk "{print \$3}" | grep -qv "^ybw::"' _ "$PWD/bootstrap.sh"; then
        result=1
    fi

    return "$result"
}

test_installer_can_be_sourced() {
    local output

    output="$(bash -c 'cd /; set +o pipefail; source "$1" --help; printf "sourced:%s:pipefail=%s" "$PWD" "$(set -o | awk '\''$1 == "pipefail" {print $2}'\'')"' _ "$PWD/bootstrap.sh")"
    [[ "$output" == "sourced:/:pipefail=off" ]]
}

test_deploy_is_scoped_and_backed_up() {
    local backup_dir
    local home_dir
    local status=0
    local untracked_path="$PWD/install-test-untracked-$$"
    local untracked_nested_path="$PWD/.config/install-test-untracked-$$"

    home_dir="$(mktemp -d)"
    mkdir -p "$home_dir/.config/fish"
    printf 'old fish config\n' > "$home_dir/.config/fish/config.fish"
    printf 'must not deploy\n' > "$untracked_path"
    printf 'must not deploy\n' > "$untracked_nested_path"

    (
        HOME="$home_dir"
        export HOME
        source "$PWD/bootstrap.sh"
        ybw::deploy::run false > /dev/null
    ) || status=1

    backup_dir="$(find "$home_dir" -maxdepth 1 -type d -name '.dotfiles-backup-*' -print -quit)"
    [[ ! -e "$home_dir/$(basename "$untracked_path")" ]] || status=1
    [[ ! -e "$home_dir/.config/$(basename "$untracked_nested_path")" ]] || status=1
    [[ ! -e "$home_dir/.codex/.env" ]] || status=1
    [[ ! -e "$home_dir/greptimedb_data" ]] || status=1
    [[ -f "$home_dir/.bashrc" ]] || status=1
    [[ -f "$home_dir/.config/fish/config.fish" ]] || status=1
    if [[ -n "$backup_dir" ]]; then
        [[ -f "$backup_dir/.config/fish/config.fish" ]] || status=1
        [[ "$(< "$backup_dir/.config/fish/config.fish")" == "old fish config" ]] || status=1
        rsync -a "$backup_dir/" "$home_dir/" > /dev/null || status=1
        [[ "$(< "$home_dir/.config/fish/config.fish")" == "old fish config" ]] || status=1
    else
        status=1
    fi

    rm -f "$untracked_path" "$untracked_nested_path"
    rm -rf "$home_dir"
    return "$status"
}

test_linux_rejects_mac_apps_before_deploy() {
    local fake_bin
    local output
    local result=0
    local status=0

    fake_bin="$(mktemp -d)"
    printf '#!/bin/sh\nif [ "${1:-}" = "-m" ]; then echo x86_64; else echo Linux; fi\n' > "$fake_bin/uname"
    chmod +x "$fake_bin/uname"

    output="$(PATH="$fake_bin:$PATH" "$PWD/bootstrap.sh" --no-pull --dry-run --mac-apps 2>&1)" || status=$?
    rm -rf "$fake_bin"

    [[ $status -ne 0 ]] || result=1
    [[ "$output" == *"--mac-apps is supported on macOS only"* ]] || result=1
    [[ "$output" != *"Deploying Configuration Files"* ]] || result=1
    return "$result"
}

test_profile_requires_home_manager() {
    local output
    local result=0
    local status=0

    output="$("$PWD/bootstrap.sh" --no-pull --dry-run --profile desktop 2>&1)" || status=$?

    [[ $status -ne 0 ]] || result=1
    [[ "$output" == *"--profile requires --home-manager"* ]] || result=1
    [[ "$output" != *"Deploying Configuration Files"* ]] || result=1
    return "$result"
}

test_missing_rsync_fails_during_plan_validation() {
    local fake_bin
    local output
    local result=0
    local status=0

    fake_bin="$(mktemp -d)"
    ln -s /bin/bash "$fake_bin/bash"
    ln -s /usr/bin/dirname "$fake_bin/dirname"
    ln -s "$(command -v git)" "$fake_bin/git"
    printf '#!/bin/sh\necho Darwin\n' > "$fake_bin/uname"
    chmod +x "$fake_bin/uname"

    output="$(PATH="$fake_bin" "$PWD/bootstrap.sh" --no-pull --dry-run 2>&1)" || status=$?
    rm -rf "$fake_bin"

    [[ $status -ne 0 ]] || result=1
    [[ "$output" == *"rsync is not installed"* ]] || result=1
    [[ "$output" != *"Deploying Configuration Files"* ]] || result=1
    return "$result"
}

test_requested_npx_failure_is_reported() {
    local fake_bin
    local output
    local result=0
    local status=0

    fake_bin="$(mktemp -d)"
    printf '#!/bin/sh\ncase "$*" in\n  *"skills list -g"*|*"ctx7 setup"*) exit 0 ;;\n  *) exit 7 ;;\nesac\n' > "$fake_bin/mise"
    chmod +x "$fake_bin/mise"

    output="$(PATH="$fake_bin:$PATH" bash -c 'source "$1"; ybw::packages::install_npx' _ "$PWD/bootstrap.sh" 2>&1)" || status=$?
    rm -rf "$fake_bin"

    [[ $status -ne 0 ]] || result=1
    [[ "$output" == *"npx tools installation failed"* ]] || result=1
    [[ "$output" != *"npx tools installation completed"* ]] || result=1
    return "$result"
}

test_requested_pi_failure_is_reported() {
    local fake_bin
    local output
    local result=0
    local status=0

    fake_bin="$(mktemp -d)"
    printf '#!/bin/sh\nexit 9\n' > "$fake_bin/pi"
    chmod +x "$fake_bin/pi"

    output="$(PATH="$fake_bin:$PATH" bash -c 'source "$1"; ybw::packages::install_pi_extensions' _ "$PWD/bootstrap.sh" 2>&1)" || status=$?
    rm -rf "$fake_bin"

    [[ $status -ne 0 ]] || result=1
    [[ "$output" == *"PI extensions installation failed"* ]] || result=1
    [[ "$output" != *"PI extensions installation completed"* ]] || result=1
    return "$result"
}

test_optional_postinstall_failure_is_counted() {
    local fake_bin
    local home_dir
    local output
    local result=0

    fake_bin="$(mktemp -d)"
    home_dir="$(mktemp -d)"
    printf '#!/bin/sh\necho Linux\n' > "$fake_bin/uname"
    printf '#!/bin/sh\nexit 11\n' > "$fake_bin/fish"
    printf '#!/bin/sh\nexit 12\n' > "$fake_bin/curl"
    chmod +x "$fake_bin/uname" "$fake_bin/fish" "$fake_bin/curl"

    output="$(HOME="$home_dir" PATH="$fake_bin:$PATH" bash -c 'source "$1"; ybw::postinstall::run; printf "\nstatus:%s warnings:%s" "$?" "${YBW_INSTALL_WARNING_COUNT:-missing}"' _ "$PWD/bootstrap.sh" 2>&1)"
    rm -rf "$fake_bin" "$home_dir"

    [[ "$output" == *"status:0 warnings:1"* ]] || result=1
    [[ "$output" == *"Post-install configuration completed with 1 warning"* ]] || result=1
    return "$result"
}

test_repository_deployment_manifest_matches_tracked_files() {
    local file_list
    local result=0

    file_list="$(mktemp)"
    bash -c 'source "$1"; ybw::deploy::expand_manifest "$2"' _ "$PWD/bootstrap.sh" "$file_list" > /dev/null || result=1
    [[ -s "$file_list" ]] || result=1
    rm -f "$file_list"

    return "$result"
}

test_deployment_manifest_rejects_unmatched_roots() {
    local file_list
    local manifest
    local output
    local result=0
    local status=0

    file_list="$(mktemp)"
    manifest="$(mktemp)"
    printf '.bashrc\nmissing-install-root\n' > "$manifest"

    output="$(bash -c 'source "$1"; ybw::deploy::expand_manifest "$2" "$3"' _ "$PWD/bootstrap.sh" "$file_list" "$manifest" 2>&1)" || status=$?
    rm -f "$file_list" "$manifest"

    [[ $status -ne 0 ]] || result=1
    [[ "$output" == *"does not match tracked files: missing-install-root"* ]] || result=1
    return "$result"
}

test_remote_bootstrap_download_failures_are_reported() {
    local fake_bin
    local home_dir
    local result=0
    local status=0

    fake_bin="$(mktemp -d)"
    home_dir="$(mktemp -d)"
    printf '#!/bin/sh\nexit 12\n' > "$fake_bin/curl"
    printf '#!/bin/sh\nexit 0\n' > "$fake_bin/fish"
    chmod +x "$fake_bin/curl" "$fake_bin/fish"

    HOME="$home_dir" PATH="$fake_bin:$PATH" bash -c 'source "$1"; set +o pipefail; ybw::postinstall::setup_oh_my_zsh' _ "$PWD/bootstrap.sh" > /dev/null 2>&1 || status=$?
    [[ $status -ne 0 ]] || result=1

    status=0
    HOME="$home_dir" PATH="$fake_bin:$PATH" bash -c 'source "$1"; set +o pipefail; ybw::postinstall::setup_oh_my_fish' _ "$PWD/bootstrap.sh" > /dev/null 2>&1 || status=$?
    [[ $status -ne 0 ]] || result=1

    rm -rf "$fake_bin" "$home_dir"
    return "$result"
}

check "installer exposes a namespaced module boundary" test_installer_has_namespaced_module_boundary
check "installer can be sourced without execution or cwd changes" test_installer_can_be_sourced
check "deployment is manifest-scoped and preserves replaced paths" test_deploy_is_scoped_and_backed_up
check "repository deployment manifest matches tracked files" test_repository_deployment_manifest_matches_tracked_files
check "deployment manifest rejects unmatched roots" test_deployment_manifest_rejects_unmatched_roots
check "Linux rejects macOS app selection before deployment" test_linux_rejects_mac_apps_before_deploy
check "Home Manager profile selection is not a silent no-op" test_profile_requires_home_manager
check "missing rsync fails during plan validation" test_missing_rsync_fails_during_plan_validation
check "requested npx failures produce a failed result" test_requested_npx_failure_is_reported
check "requested PI failures produce a failed result" test_requested_pi_failure_is_reported
check "optional post-install failures are counted" test_optional_postinstall_failure_is_counted
check "remote bootstrap download failures are reported" test_remote_bootstrap_download_failures_are_reported

echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"

[[ $FAILED -eq 0 ]]
