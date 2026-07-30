#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

readonly TUNA_NIX_INSTALL_URL="https://mirrors.tuna.tsinghua.edu.cn/nix/latest/install"
readonly OFFICIAL_NIX_INSTALL_URL="https://nixos.org/nix/install"
readonly NIX_CONFIG_SOURCE="$PWD/.config/nix/nix.conf"
readonly NIX_CONFIG_TARGET="$HOME/.config/nix/nix.conf"
readonly NIX_DAEMON_CONFIG="/etc/nix/nix.conf"
readonly NIX_DAEMON_CONFIG_FRAGMENT="/etc/nix/nix.conf.d/dotfiles.conf"
readonly NIX_DAEMON_SOCKET="/nix/var/nix/daemon-socket/socket"

dry_run=false
install_mode="auto"

log_info() {
    printf '==> %s\n' "$*"
}

log_error() {
    printf 'ERROR: %s\n' "$*" >&2
}

log_warn() {
    printf 'WARNING: %s\n' "$*" >&2
}

is_macos() {
    [[ "$(uname -s)" == "Darwin" ]]
}

is_linux() {
    [[ "$(uname -s)" == "Linux" ]]
}

has_systemd() {
    [[ -d /run/systemd/system ]] && [[ "$(ps -p 1 -o comm= 2>/dev/null)" == "systemd" ]]
}

run_as_root() {
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
        "$@"
    elif command -v sudo > /dev/null 2>&1; then
        sudo "$@"
    else
        log_error "sudo is required to configure a multi-user Nix daemon"
        return 1
    fi
}

show_usage() {
    cat << EOF
Install Nix for the current macOS, Linux, or WSL environment.

Usage: $0 [OPTIONS]

OPTIONS:
    --dry-run       Show the selected installation mode without changing the host
    --mode MODE     Installation mode: auto (default), daemon, or single-user
    -h, --help      Show this help message
EOF
}

load_nix_profile() {
    local profile_script

    if command -v nix > /dev/null 2>&1; then
        return 0
    fi

    for profile_script in \
        "$HOME/.nix-profile/etc/profile.d/nix.sh" \
        "/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"
    do
        if [[ -f "$profile_script" ]]; then
            # shellcheck disable=SC1090
            source "$profile_script"
        fi
    done

    command -v nix > /dev/null 2>&1
}

resolve_install_mode() {
    if [[ "$install_mode" != "auto" ]]; then
        printf '%s\n' "$install_mode"
        return 0
    fi

    if is_macos || { is_linux && has_systemd; }; then
        printf 'daemon\n'
    else
        printf 'single-user\n'
    fi
}

configure_nix() {
    if [[ ! -f "$NIX_CONFIG_SOURCE" ]]; then
        log_error "Nix configuration not found at $NIX_CONFIG_SOURCE"
        return 1
    fi

    mkdir -p "$(dirname "$NIX_CONFIG_TARGET")"
    if ! cmp -s "$NIX_CONFIG_SOURCE" "$NIX_CONFIG_TARGET"; then
        install -m 0644 "$NIX_CONFIG_SOURCE" "$NIX_CONFIG_TARGET"
    fi
    log_info "Configured TUNA binary cache in $NIX_CONFIG_TARGET"
}

restart_nix_daemon() {
    local launchd_service

    if is_linux && has_systemd && systemctl list-unit-files nix-daemon.service > /dev/null 2>&1; then
        run_as_root systemctl restart nix-daemon.service
        return 0
    fi

    if is_macos; then
        for launchd_service in org.nixos.nix-daemon systems.determinate.nix-daemon; do
            if launchctl print "system/$launchd_service" > /dev/null 2>&1; then
                run_as_root launchctl kickstart -k "system/$launchd_service"
                return 0
            fi
        done
    fi

    log_error "Nix daemon configuration changed, but its service could not be restarted automatically"
    return 1
}

configure_nix_daemon() {
    local changed=false
    local include_line="include $NIX_DAEMON_CONFIG_FRAGMENT"

    if [[ ! -S "$NIX_DAEMON_SOCKET" ]]; then
        return 0
    fi

    run_as_root mkdir -p "$(dirname "$NIX_DAEMON_CONFIG_FRAGMENT")"
    if ! run_as_root cmp -s "$NIX_CONFIG_SOURCE" "$NIX_DAEMON_CONFIG_FRAGMENT"; then
        run_as_root install -m 0644 "$NIX_CONFIG_SOURCE" "$NIX_DAEMON_CONFIG_FRAGMENT"
        changed=true
    fi

    if [[ ! -f "$NIX_DAEMON_CONFIG" ]] || ! run_as_root grep -Fxq "$include_line" "$NIX_DAEMON_CONFIG"; then
        printf '\n%s\n' "$include_line" | run_as_root tee -a "$NIX_DAEMON_CONFIG" > /dev/null
        changed=true
    fi

    if [[ "$changed" == true ]]; then
        restart_nix_daemon
    fi

    log_info "Configured TUNA for the multi-user Nix daemon"
}

download_installer() {
    local destination="$1"

    log_info "Downloading the official Nix installer from TUNA"
    if curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
        "$TUNA_NIX_INSTALL_URL" --output "$destination"; then
        return 0
    fi

    log_warn "TUNA installer mirror is unavailable; falling back to nixos.org"
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
        "$OFFICIAL_NIX_INSTALL_URL" --output "$destination"
}

show_nix_config() {
    if nix --extra-experimental-features "nix-command flakes" config show 2>/dev/null; then
        return 0
    fi

    nix --extra-experimental-features "nix-command flakes" show-config 2>/dev/null
}

verify_nix() {
    local config

    if ! load_nix_profile; then
        log_error "Nix was installed but is not available in this shell"
        return 1
    fi

    nix --version
    nix --extra-experimental-features "nix-command flakes" flake --help > /dev/null

    config="$(show_nix_config || true)"
    if [[ "$config" != *"https://mirrors.tuna.tsinghua.edu.cn/nix-channels/store"* ]]; then
        log_error "Nix is not using the TUNA binary cache"
        log_error "For a multi-user install, also add $NIX_CONFIG_TARGET to the daemon configuration"
        return 1
    fi

    log_info "Nix and Flakes are ready"
}

while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --dry-run)
            dry_run=true
            ;;
        --mode)
            if [[ "$#" -lt 2 ]]; then
                log_error "--mode requires a value"
                exit 1
            fi
            install_mode="$2"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown parameter: $1"
            show_usage
            exit 1
            ;;
    esac
    shift
done

case "$install_mode" in
    auto|daemon|single-user)
        ;;
    *)
        log_error "Unsupported installation mode: $install_mode"
        exit 1
        ;;
esac

if ! is_macos && ! is_linux; then
    log_error "Only macOS, Linux, and WSL are supported"
    exit 1
fi

resolved_mode="$(resolve_install_mode)"

if [[ "$dry_run" == true ]]; then
    log_info "Would install Nix if missing from TUNA ($resolved_mode mode)"
    log_info "Would fall back to the official installer if TUNA is unavailable"
    log_info "Would configure TUNA at $NIX_CONFIG_TARGET"
    if [[ -S "$NIX_DAEMON_SOCKET" ]]; then
        log_info "Would configure TUNA for the existing multi-user Nix daemon"
    fi
    exit 0
fi

if load_nix_profile; then
    log_info "Nix is already installed at $(command -v nix)"
else
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
        log_error "Run this installer as a regular user; it will request sudo when required"
        exit 1
    fi
    if ! command -v curl > /dev/null 2>&1; then
        log_error "curl is required to download the official Nix installer"
        exit 1
    fi

    if [[ ! -f "$NIX_CONFIG_SOURCE" ]]; then
        log_error "Nix configuration not found at $NIX_CONFIG_SOURCE"
        exit 1
    fi

    installer_path="$(mktemp)"
    trap 'rm -f "${installer_path:-}"' EXIT

    download_installer "$installer_path"

    installer_args=(
        --yes
        --no-channel-add
        --nix-extra-conf-file "$NIX_CONFIG_SOURCE"
    )
    if [[ "$resolved_mode" == "daemon" ]]; then
        sh "$installer_path" --daemon "${installer_args[@]}"
    else
        sh "$installer_path" --no-daemon "${installer_args[@]}"
    fi
fi

configure_nix
configure_nix_daemon
verify_nix
log_info "Run ./bootstrap.sh to activate the dotfiles configuration"
