# macOS, Linux, and Homebrew adapters used by package orchestration.

readonly YBW_BREW_FISH_PACKAGES=(
    "fish"
)

readonly YBW_BREW_CLI_PACKAGES=(
    "brightness"
    "loop"
    "im-select"
)

readonly YBW_BREW_CASK_PACKAGES=(
    "openinterminal"
    "monitorcontrol"
    "codeisland"
)

readonly YBW_BREW_TAPS=(
    "wxtsky/tap"
    "daipeihust/tap"
)

readonly YBW_BREW_TAP_CASKS=(
    "steipete/tap/codexbar"
)

ybw::brew::install_formula() {
    local package="$1"

    if brew list --formula "$package" &> /dev/null; then
        ybw::log::success "$package already installed"
        return 0
    fi

    ybw::log::info "Installing $package..."
    if brew install "$package"; then
        ybw::log::success "$package installed"
        return 0
    fi

    ybw::log::warn "Failed to install $package"
    return 1
}

ybw::brew::install_cask() {
    local cask="$1"
    local cask_name

    cask_name="$(basename "$cask")"
    if brew list --cask "$cask" &> /dev/null; then
        ybw::log::success "$cask_name already installed"
        return 0
    fi

    ybw::log::info "Installing $cask..."
    if brew install --cask "$cask"; then
        ybw::log::success "$cask_name installed"
        return 0
    fi

    ybw::log::warn "Failed to install $cask"
    return 1
}

ybw::brew::install_tap() {
    local tap="$1"

    if brew tap | grep -qx "$tap"; then
        ybw::log::success "$tap already tapped"
        return 0
    fi

    ybw::log::info "Tapping $tap..."
    if brew tap "$tap"; then
        ybw::log::success "$tap tapped"
        return 0
    fi

    ybw::log::warn "Failed to tap $tap"
    return 1
}

ybw::platform::configure() {
    ybw::log::step "Phase 3: Platform-Specific Setup"

    if ybw::platform::is_macos; then
        ybw::macos::apply_defaults
    elif ybw::platform::is_linux; then
        ybw::log::info "Linux-specific setup not yet implemented"
    else
        ybw::log::info "No platform-specific setup for $(ybw::platform::name)"
    fi
}

ybw::macos::apply_defaults() {
    ybw::log::info "Configuring macOS defaults..."

    ybw::result::require "Configuring screenshot format" \
        defaults write com.apple.screencapture type jpg || return 1
    ybw::result::require "Configuring Preview persistence" \
        defaults write com.apple.Preview ApplePersistenceIgnoreState YES || return 1

    if ! chflags nohidden "$HOME/Library" 2>/dev/null; then
        ybw::result::warn "Could not make $HOME/Library visible"
    fi

    ybw::result::require "Showing hidden Finder files" \
        defaults write com.apple.finder AppleShowAllFiles YES || return 1
    ybw::result::require "Showing the Finder path bar" \
        defaults write com.apple.finder ShowPathbar -bool true || return 1
    ybw::result::require "Showing the Finder status bar" \
        defaults write com.apple.finder ShowStatusBar -bool true || return 1
    ybw::result::require "Enabling Dock autohide" \
        defaults write com.apple.dock autohide -int 1 || return 1
    ybw::result::require "Configuring Dock minimize effect" \
        defaults write com.apple.dock mineffect -string scale || return 1
    ybw::result::require "Minimizing windows into application icons" \
        defaults write com.apple.dock minimize-to-application -int 1 || return 1
    ybw::result::require "Hiding recent applications in the Dock" \
        defaults write com.apple.dock show-recents -int 0 || return 1
    ybw::result::require "Configuring Dock icon size" \
        defaults write com.apple.dock tilesize -int 44 || return 1
    ybw::result::require "Configuring global key repeat" \
        defaults write -g ApplePressAndHoldEnabled -bool false || return 1
    ybw::result::require "Configuring VS Code key repeat" \
        defaults write com.microsoft.VSCodeInsiders ApplePressAndHoldEnabled -bool false || return 1
    ybw::result::require "Configuring font smoothing" \
        defaults write -g AppleFontSmoothing -int 1 || return 1
    ybw::result::require "Configuring key repeat rate" \
        defaults write -g KeyRepeat -int 2 || return 1
    ybw::result::require "Configuring initial key repeat delay" \
        defaults write -g InitialKeyRepeat -int 15 || return 1
    ybw::result::require "Disabling automatic update checks" \
        sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool false || return 1
    ybw::result::require "Disabling automatic update downloads" \
        sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false || return 1
    ybw::result::require "Disabling automatic macOS updates" \
        sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false || return 1

    killall Finder 2>/dev/null || true
    ybw::log::success "macOS defaults configured"
}

ybw::macos::install_fish() {
    local failed=0
    local package

    ybw::log::info "Installing Homebrew Fish..."

    if ! ybw::command::exists brew; then
        ybw::log::error "Homebrew is required to install Fish on macOS"
        ybw::log::info "To install: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        return 1
    fi

    for package in "${YBW_BREW_FISH_PACKAGES[@]}"; do
        ybw::brew::install_formula "$package" || failed=1
    done

    if [[ $failed -ne 0 ]]; then
        ybw::log::error "Homebrew Fish failed to install"
        return 1
    fi

    ybw::log::success "Homebrew Fish installation completed"
}

ybw::macos::configure_fish_login_shell() {
    local fish_path
    local current_shell

    fish_path="$(brew --prefix)/bin/fish"
    if [[ ! -x "$fish_path" ]]; then
        ybw::log::warn "Homebrew Fish is not available at $fish_path"
        return 1
    fi

    if ! grep -Fxq "$fish_path" /etc/shells; then
        ybw::log::info "Registering $fish_path in /etc/shells..."
        if ! printf '%s\n' "$fish_path" | sudo tee -a /etc/shells > /dev/null; then
            ybw::log::warn "Failed to register $fish_path in /etc/shells"
            return 1
        fi
    fi

    current_shell="$(/usr/bin/dscl . -read "/Users/$USER" UserShell 2>/dev/null | awk '{print $2}')"
    if [[ "$current_shell" == "$fish_path" ]]; then
        ybw::log::success "$fish_path is already the default shell"
        return 0
    fi

    ybw::log::info "Setting $fish_path as the default shell..."
    if sudo chsh -s "$fish_path" "$USER"; then
        ybw::log::success "Default shell changed to $fish_path"
        return 0
    fi

    ybw::log::warn "Failed to set $fish_path as the default shell"
    return 1
}

ybw::macos::install_optional_packages() {
    local cask
    local cask_name
    local failed=0
    local package
    local tap

    ybw::log::info "Installing optional Homebrew packages..."

    if ! ybw::command::exists brew; then
        ybw::log::error "Homebrew is required for --mac-apps"
        return 1
    fi

    if ybw::command::exists proxychains4; then
        ybw::log::success "proxychains4 already installed"
    else
        ybw::log::info "Installing proxychains-ng from source..."
        if brew install --build-from-source proxychains-ng; then
            ybw::log::success "proxychains-ng installed"
        else
            ybw::log::warn "Failed to install proxychains-ng"
            failed=1
        fi
    fi

    for package in "${YBW_BREW_CLI_PACKAGES[@]}"; do
        ybw::brew::install_formula "$package" || failed=1
    done

    for tap in "${YBW_BREW_TAPS[@]}"; do
        ybw::brew::install_tap "$tap" || failed=1
    done

    for cask in "${YBW_BREW_CASK_PACKAGES[@]}"; do
        ybw::brew::install_cask "$cask" || failed=1
    done

    for cask in "${YBW_BREW_TAP_CASKS[@]}"; do
        cask_name="${cask##*/}"
        if brew list --cask | grep -q "^$cask_name$"; then
            ybw::log::success "$cask_name already installed"
        else
            ybw::log::info "Installing $cask..."
            if brew install --cask "$cask"; then
                ybw::log::success "$cask_name installed"
            else
                ybw::log::warn "Failed to install $cask"
                failed=1
            fi
        fi
    done

    if [[ $failed -ne 0 ]]; then
        ybw::log::error "Optional Homebrew packages installation failed"
        return 1
    fi

    ybw::log::success "Optional Homebrew packages installation completed"
}

ybw::linux::install_fish() {
    local fish_path

    if fish_path="$(ybw::linux::find_fish)"; then
        ybw::log::success "System Fish is already installed at $fish_path"
        return 0
    fi

    ybw::log::info "Installing Fish for Linux..."

    if ybw::command::exists apt-get; then
        ybw::command::as_root apt-get update && ybw::command::as_root apt-get install -y fish
    elif ybw::command::exists dnf; then
        ybw::command::as_root dnf install -y fish
    elif ybw::command::exists yum; then
        ybw::command::as_root yum install -y fish
    elif ybw::command::exists pacman; then
        ybw::command::as_root pacman -S --needed --noconfirm fish
    elif ybw::command::exists zypper; then
        ybw::command::as_root zypper --non-interactive install fish
    elif ybw::command::exists apk; then
        ybw::command::as_root apk add fish
    else
        ybw::log::error "No supported Linux package manager found (apt, dnf, yum, pacman, zypper, or apk)"
        return 1
    fi

    fish_path="$(ybw::linux::find_fish)" || {
        ybw::log::error "Fish installation completed without a stable system executable"
        return 1
    }

    ybw::log::success "Fish installed at $fish_path"
}

ybw::linux::configure_fish_login_shell() {
    local fish_path="$1"
    local current_shell

    if [[ ! -x "$fish_path" ]]; then
        ybw::log::warn "Fish is not executable at $fish_path"
        return 1
    fi

    if ! ybw::linux::is_stable_shell "$fish_path"; then
        ybw::log::error "Refusing generation-bound Fish login shell: $fish_path"
        return 1
    fi

    if [[ -f /etc/shells ]] && ! grep -Fxq "$fish_path" /etc/shells; then
        ybw::log::info "Registering $fish_path in /etc/shells..."
        if ! printf '%s\n' "$fish_path" | ybw::command::as_root tee -a /etc/shells > /dev/null; then
            ybw::log::warn "Failed to register $fish_path in /etc/shells"
            return 1
        fi
    fi

    current_shell="$(getent passwd "$USER" 2>/dev/null | cut -d: -f7)"
    current_shell="${current_shell:-${SHELL:-}}"
    if [[ "$current_shell" == "$fish_path" ]]; then
        ybw::log::success "$fish_path is already the default shell"
        return 0
    fi

    ybw::log::info "Setting $fish_path as the default shell..."
    if ybw::command::as_root chsh -s "$fish_path" "$USER"; then
        ybw::log::success "Default shell changed to $fish_path"
        return 0
    fi

    ybw::log::warn "Failed to set $fish_path as the default shell"
    return 1
}
