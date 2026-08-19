# CLI parsing and validation for the installer execution plan.

ybw::plan::reset() {
    YBW_INSTALL_PLAN_NO_PULL=false
    YBW_INSTALL_PLAN_DRY_RUN=false
    YBW_INSTALL_PLAN_NPX=false
    YBW_INSTALL_PLAN_PI=false
    YBW_INSTALL_PLAN_MAC_APPS=false
    YBW_INSTALL_PLAN_TOOLCHAIN=false
    YBW_INSTALL_PLAN_HOME_MANAGER=false
    YBW_INSTALL_PLAN_HOME_MANAGER_PROFILE="development"
    YBW_INSTALL_PLAN_PROFILE_EXPLICIT=false
    YBW_INSTALL_PLAN_SHOW_HELP=false
    YBW_INSTALL_WARNING_COUNT=0
}

ybw::plan::usage() {
    cat << EOF
Dotfiles Installation Script v${YBW_INSTALL_VERSION}

Usage: $0 [OPTIONS]

OPTIONS:
    --no-pull       Skip git pull before installation
    --dry-run       Show what would be deployed without making changes
    --home-manager  Activate the selected Home Manager profile
    --profile NAME  Home Manager profile: development (default) or desktop
    --toolchain     Install Node.js, Python, Go, and Rust with Mise (macOS only)
    --npx           Install npx tools (skills + ctx7)
    --pi            Install PI extensions
    --mac-apps      Install remaining Homebrew casks (macOS only)
    -h, --help      Show this help message

EXAMPLES:
    $0                          # Standard installation without Home Manager activation
    $0 --dry-run                # Preview changes
    $0 --home-manager           # Activate the development Home Manager profile
    $0 --home-manager --profile desktop  # Activate development plus desktop tools
    $0 --home-manager --mac-apps --toolchain --npx --pi  # Full installation with all optional components
    $0 --no-pull --dry-run      # Preview without updating repo

EOF
}

ybw::plan::parse() {
    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            --no-pull)
                YBW_INSTALL_PLAN_NO_PULL=true
                ;;
            --dry-run)
                YBW_INSTALL_PLAN_DRY_RUN=true
                ;;
            --home-manager)
                YBW_INSTALL_PLAN_HOME_MANAGER=true
                ;;
            --profile)
                if [[ "$#" -lt 2 ]]; then
                    ybw::log::error "--profile requires a value"
                    return 1
                fi
                YBW_INSTALL_PLAN_HOME_MANAGER_PROFILE="$2"
                YBW_INSTALL_PLAN_PROFILE_EXPLICIT=true
                shift
                ;;
            --npx)
                YBW_INSTALL_PLAN_NPX=true
                ;;
            --pi)
                YBW_INSTALL_PLAN_PI=true
                ;;
            --mac-apps)
                YBW_INSTALL_PLAN_MAC_APPS=true
                ;;
            --toolchain)
                YBW_INSTALL_PLAN_TOOLCHAIN=true
                ;;
            -h|--help)
                ybw::plan::usage
                YBW_INSTALL_PLAN_SHOW_HELP=true
                return 0
                ;;
            *)
                ybw::log::error "Unknown parameter: $1"
                ybw::plan::usage
                return 1
                ;;
        esac
        shift
    done

    case "$YBW_INSTALL_PLAN_HOME_MANAGER_PROFILE" in
        development|desktop)
            ;;
        *)
            ybw::log::error "Unsupported Home Manager profile: $YBW_INSTALL_PLAN_HOME_MANAGER_PROFILE"
            ybw::log::info "Supported profiles: development, desktop"
            return 1
            ;;
    esac
}

ybw::plan::validate() {
    local platform
    local package_manager

    platform="$(ybw::platform::name)"
    ybw::log::step "Validating Installation Plan"

    case "$platform" in
        macOS|Linux|WSL)
            ;;
        *)
            ybw::log::error "Unsupported platform: $platform"
            return 1
            ;;
    esac

    if [[ "$YBW_INSTALL_PLAN_MAC_APPS" == true && "$platform" != "macOS" ]]; then
        ybw::log::error "--mac-apps is supported on macOS only"
        return 1
    fi

    if [[ "$YBW_INSTALL_PLAN_TOOLCHAIN" == true && "$platform" != "macOS" ]]; then
        ybw::log::error "--toolchain is supported on macOS only"
        return 1
    fi

    if [[ "$YBW_INSTALL_PLAN_PROFILE_EXPLICIT" == true && "$YBW_INSTALL_PLAN_HOME_MANAGER" == false ]]; then
        ybw::log::error "--profile requires --home-manager"
        return 1
    fi

    ybw::command::require git "Visit https://git-scm.com/downloads" || return 1
    ybw::command::require rsync "Install rsync with the system package manager" || return 1

    if [[ "$platform" == "macOS" ]]; then
        ybw::command::require sudo "Install or enable sudo for system configuration" || return 1
        if [[ "$YBW_INSTALL_PLAN_MAC_APPS" == true ]]; then
            ybw::command::require brew "Visit https://brew.sh" || return 1
        fi
        if [[ ! -d "$HOME/.oh-my-zsh" || ! -d "$HOME/.local/share/omf" ]]; then
            ybw::command::require curl "Install curl from Xcode Command Line Tools or Nix" || return 1
        fi
    elif ! ybw::linux::find_fish > /dev/null; then
        package_manager=""
        for package_manager in apt-get dnf yum pacman zypper apk; do
            if ybw::command::exists "$package_manager"; then
                break
            fi
            package_manager=""
        done
        if [[ -z "$package_manager" ]]; then
            ybw::log::error "No supported package manager is available to install Fish"
            return 1
        fi
        if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
            ybw::command::require sudo "Install sudo or run as root" || return 1
        fi
    fi

    if [[ "$platform" != "macOS" && ! -d "$HOME/.local/share/omf" ]]; then
        ybw::command::require curl "Install curl with the system package manager" || return 1
    fi

    if [[ "$YBW_INSTALL_PLAN_HOME_MANAGER" == true ]]; then
        if ! ybw::nix::load_profile; then
            ybw::log::error "--home-manager requires Nix with Flakes support"
            ybw::log::info "Run ./installer/install-nix.sh first"
            return 1
        fi
        if [[ ! -f "$YBW_INSTALL_ROOT/home/.config/home-manager/flake.nix" || ! -f "$YBW_INSTALL_ROOT/home/.config/home-manager/flake.lock" ]]; then
            ybw::log::error "The repository Home Manager Flake is incomplete"
            return 1
        fi
    fi

    if [[ "$YBW_INSTALL_PLAN_TOOLCHAIN" == true && "$YBW_INSTALL_PLAN_HOME_MANAGER" == false ]] && ! ybw::command::exists mise; then
        ybw::log::error "--toolchain requires Mise or --home-manager"
        return 1
    fi

    if [[ "$YBW_INSTALL_PLAN_NPX" == true && "$YBW_INSTALL_PLAN_HOME_MANAGER" == false ]] && ! ybw::command::exists mise; then
        ybw::log::error "--npx requires Mise or --home-manager"
        return 1
    fi

    if [[ "$YBW_INSTALL_PLAN_PI" == true ]]; then
        ybw::command::require pi "Install pi before selecting --pi" || return 1
    fi

    ybw::log::success "Installation plan is valid for $platform"
}
