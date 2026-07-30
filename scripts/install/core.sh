# Shared runtime services for the dotfiles installer.

readonly YBW_INSTALL_VERSION="2.2.0"

YBW_INSTALL_WARNING_COUNT=0

ybw::log::info() {
    echo "ℹ️  $*"
}

ybw::log::success() {
    echo "✓ $*"
}

ybw::log::warn() {
    echo "⚠️  WARNING: $*" >&2
}

ybw::log::error() {
    echo "❌ ERROR: $*" >&2
}

ybw::log::step() {
    echo ""
    echo "===> $*"
}

ybw::result::require() {
    local description="$1"
    shift

    if "$@"; then
        return 0
    fi

    ybw::log::error "$description failed"
    return 1
}

ybw::result::warn() {
    YBW_INSTALL_WARNING_COUNT=$((YBW_INSTALL_WARNING_COUNT + 1))
    ybw::log::warn "$*"
}

ybw::platform::is_macos() {
    [[ "$(uname -s)" == "Darwin" ]]
}

ybw::platform::is_linux() {
    [[ "$(uname -s)" == "Linux" ]]
}

ybw::platform::is_wsl() {
    [[ -f /proc/version ]] && grep -qi microsoft /proc/version
}

ybw::platform::name() {
    if ybw::platform::is_macos; then
        echo "macOS"
    elif ybw::platform::is_wsl; then
        echo "WSL"
    elif ybw::platform::is_linux; then
        echo "Linux"
    else
        echo "Unknown"
    fi
}

ybw::platform::home_manager_arch() {
    case "$(uname -m)" in
        arm64|aarch64)
            echo "aarch64"
            ;;
        x86_64|amd64)
            echo "x86_64"
            ;;
        *)
            ybw::log::error "Unsupported architecture for Home Manager: $(uname -m)"
            return 1
            ;;
    esac
}

ybw::platform::home_manager_target() {
    local profile="$1"
    local arch
    local platform

    arch="$(ybw::platform::home_manager_arch)" || return 1

    case "$(ybw::platform::name)" in
        macOS)
            platform="macos"
            ;;
        Linux)
            platform="linux"
            ;;
        WSL)
            platform="wsl"
            ;;
        *)
            ybw::log::error "Home Manager is not supported on $(ybw::platform::name)"
            return 1
            ;;
    esac

    if [[ "$profile" == "desktop" ]]; then
        echo "${platform}-${arch}-desktop"
    else
        echo "${platform}-${arch}"
    fi
}

ybw::linux::is_stable_shell() {
    local shell_path="$1"
    local resolved_path

    case "$shell_path" in
        "$HOME/.nix-profile/"*|"$HOME/.local/state/nix/profiles/"*|/nix/var/nix/profiles/*|/nix/store/*)
            return 1
            ;;
    esac

    resolved_path="$(readlink -f "$shell_path" 2>/dev/null || true)"
    [[ -n "$resolved_path" && "$resolved_path" != /nix/store/* ]]
}

ybw::linux::find_fish() {
    local candidate

    for candidate in /usr/bin/fish /bin/fish; do
        if [[ -x "$candidate" ]] && ybw::linux::is_stable_shell "$candidate"; then
            printf '%s' "$candidate"
            return 0
        fi
    done

    candidate="$(command -v fish 2>/dev/null || true)"
    if [[ -n "$candidate" && -x "$candidate" ]] && ybw::linux::is_stable_shell "$candidate"; then
        printf '%s' "$candidate"
        return 0
    fi

    return 1
}

ybw::command::exists() {
    local command_name="$1"
    command -v "$command_name" &> /dev/null
}

ybw::command::require() {
    local command_name="$1"
    local install_hint="${2:-}"

    if ! ybw::command::exists "$command_name"; then
        ybw::log::error "$command_name is not installed."
        if [[ -n "$install_hint" ]]; then
            ybw::log::info "To install: $install_hint"
        fi
        return 1
    fi
}

ybw::command::as_root() {
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
        "$@"
    elif ybw::command::exists sudo; then
        sudo "$@"
    else
        ybw::log::error "Administrator privileges are required, but sudo is not installed"
        return 1
    fi
}

ybw::nix::load_profile() {
    local profile_script

    if ybw::command::exists nix; then
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

    ybw::command::exists nix
}
