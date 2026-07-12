#!/usr/bin/env bash

# Dotfiles Installation Script
# Supports macOS, Linux, and WSL
# Usage: ./install.sh [--no-pull] [--dry-run] [--toolchain] [--npx] [--mac-apps]

set -o pipefail

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

# ============================================================================
# CONFIGURATION
# ============================================================================

readonly SCRIPT_VERSION="2.1.0"

# Brew CLI packages
readonly BREW_CLI_PACKAGES=(
    "fish"
    "brightness"
    "loop"
    "im-select"
)

# Brew cask packages
readonly BREW_CASK_PACKAGES=(
    "openinterminal"
    "monitorcontrol"
    "codeisland"
)

# Brew taps
readonly BREW_TAPS=(
    "wxtsky/tap"
    "daipeihust/tap"
)

# Brew tap casks
readonly BREW_TAP_CASKS=(
    "steipete/tap/codexbar"
)

# NPX skills to install
readonly NPX_SKILLS=(
    "vercel-labs/agent-browser"
    "pbakaus/impeccable"
    "tw93/Waza"
)

# Go packages to install
readonly GO_PACKAGES=(
    "github.com/m7medvision/lazycommit@latest"
)

# PI extensions to install
readonly PI_EXTENSIONS=(
    "npm:pi-planning-with-files"
    "npm:@ff-labs/pi-fff"
)

# Oh-My-Fish plugins
readonly OMF_PLUGINS=(
    "nvm"
    "fzf"
    "peco"
    "foreign-env"
    "bass"
)

# Files to backup before deployment
readonly BACKUP_FILES=(
    "$HOME/.bash_profile"
    "$HOME/.zshrc"
    "$HOME/.config/fish"
    "$HOME/.config/wezterm"
    "$HOME/.config/alacritty"
    "$HOME/.hammerspoon"
)

# Directory structure to create
readonly ART_DIRS=(
    "$HOME/art/github"
    "$HOME/art/opensource"
    "$HOME/art/personal"
)

# ============================================================================
# HELPER FUNCTIONS - Logging
# ============================================================================

log_info() {
    echo "ℹ️  $*"
}

log_success() {
    echo "✓ $*"
}

log_warn() {
    echo "⚠️  WARNING: $*" >&2
}

log_error() {
    echo "❌ ERROR: $*" >&2
}

log_step() {
    echo ""
    echo "===> $*"
}

# ============================================================================
# HELPER FUNCTIONS - Platform Detection
# ============================================================================

is_macos() {
    [[ "$(uname -s)" == "Darwin" ]]
}

is_linux() {
    [[ "$(uname -s)" == "Linux" ]]
}

is_wsl() {
    [[ -f /proc/version ]] && grep -qi microsoft /proc/version
}

get_platform() {
    if is_macos; then
        echo "macOS"
    elif is_wsl; then
        echo "WSL"
    elif is_linux; then
        echo "Linux"
    else
        echo "Unknown"
    fi
}

# ============================================================================
# HELPER FUNCTIONS - Command Checks
# ============================================================================

check_command() {
    local cmd="$1"
    command -v "$cmd" &> /dev/null
}

require_command() {
    local cmd="$1"
    local install_hint="${2:-}"
    
    if ! check_command "$cmd"; then
        log_error "$cmd is not installed."
        if [[ -n "$install_hint" ]]; then
            log_info "To install: $install_hint"
        fi
        return 1
    fi
    return 0
}

check_command_silent() {
    local cmd="$1"
    if check_command "$cmd"; then
        log_success "$cmd is available"
        return 0
    else
        log_warn "$cmd is not available"
        return 1
    fi
}

# ============================================================================
# HELPER FUNCTIONS - Package Management
# ============================================================================

install_brew_package() {
    local package="$1"
    
    if check_command "$package"; then
        log_success "$package already installed"
        return 0
    fi
    
    log_info "Installing $package..."
    if brew install "$package"; then
        log_success "$package installed"
        return 0
    else
        log_warn "Failed to install $package"
        return 1
    fi
}

install_brew_cask() {
    local cask="$1"
    local cask_name
    cask_name=$(basename "$cask")
    
    if brew list --cask "$cask" &> /dev/null; then
        log_success "$cask_name already installed"
        return 0
    fi
    
    log_info "Installing $cask..."
    if brew install --cask "$cask"; then
        log_success "$cask_name installed"
        return 0
    else
        log_warn "Failed to install $cask"
        return 1
    fi
}

install_brew_tap() {
    local tap="$1"

    if brew tap | grep -qx "$tap"; then
        log_success "$tap already tapped"
        return 0
    fi

    log_info "Tapping $tap..."
    if brew tap "$tap"; then
        log_success "$tap tapped"
        return 0
    else
        log_warn "Failed to tap $tap"
        return 1
    fi
}

# ============================================================================
# PHASE 1: Pre-flight Checks
# ============================================================================

phase_preflight() {
    log_step "Phase 1: Pre-flight Checks"
    
    log_info "Platform: $(get_platform)"
    log_info "Script version: $SCRIPT_VERSION"
    
    # Check git
    if ! require_command git "Visit https://git-scm.com/downloads"; then
        exit 1
    fi
    log_success "git installed"
    
    # Check disk space
    local available_space
    available_space=$(df -k ~ | awk 'NR==2 {print $4}' | awk '{print int($1/1024)}')
    if [[ $available_space -lt 100 ]]; then
        log_error "Insufficient disk space. Need at least 100MB, available: ${available_space}MB"
        exit 1
    fi
    log_success "Disk space OK (${available_space}MB available)"
    
    # Check home directory writable
    if [[ ! -w "$HOME" ]]; then
        log_error "No write permission to home directory"
        exit 1
    fi
    log_success "Home directory writable"
    
    log_success "All pre-flight checks passed"
}

# ============================================================================
# PHASE 2: Backup
# ============================================================================

phase_backup() {
    local dry_run="$1"
    
    if [[ "$dry_run" == true ]]; then
        log_step "Phase 2: Backup (skipped in dry-run mode)"
        return 0
    fi
    
    log_step "Phase 2: Creating Backup"
    
    local backup_dir="$HOME/.dotfiles-backup-$(date +%Y%m%d_%H%M%S)"
    log_info "Backup location: $backup_dir"
    
    mkdir -p "$backup_dir" || {
        log_error "Failed to create backup directory"
        exit 1
    }
    
    local backed_up=0
    for file in "${BACKUP_FILES[@]}"; do
        if [[ -e "$file" ]]; then
            log_info "Backing up: $file"
            cp -a "$file" "$backup_dir/" && ((backed_up++))
        fi
    done
    
    if [[ $backed_up -gt 0 ]]; then
        log_success "Backup created: $backed_up files backed up"
        log_info "To restore: cp -r $backup_dir/* ~/"
    else
        log_info "No existing files to backup"
    fi
}

# ============================================================================
# PHASE 3: Deploy Configuration Files
# ============================================================================

phase_deploy() {
    local dry_run="$1"
    
    log_step "Phase 3: Deploying Configuration Files"
    
    if [[ ! -f ".exclude" ]]; then
        log_warn ".exclude file not found, proceeding without exclusions"
    fi
    
    if [[ "$dry_run" == true ]]; then
        log_info "DRY RUN: Would deploy these files:"
        rsync --exclude-from=./.exclude \
            -avh --no-perms --dry-run . ~ 2>&1 | \
            grep -v "sending incremental file list" | \
            grep -v "^$" || true
    else
        log_info "Deploying configs with rsync..."
        if rsync --exclude-from=./.exclude -avh --no-perms . ~; then
            log_success "Configs deployed successfully"
        else
            log_error "rsync failed with exit code $?"
            log_error "Please check permissions and disk space"
            exit 1
        fi
    fi
}

# ============================================================================
# PHASE 4: Platform-Specific Setup
# ============================================================================

phase_platform_setup() {
    log_step "Phase 4: Platform-Specific Setup"
    
    if is_macos; then
        setup_macos_defaults
    elif is_linux; then
        log_info "Linux-specific setup not yet implemented"
    else
        log_info "No platform-specific setup for $(get_platform)"
    fi
}

setup_macos_defaults() {
    log_info "Configuring macOS defaults..."
    
    # Screenshots as JPG
    defaults write com.apple.screencapture type jpg
    
    # Don't reopen previous files in Preview
    defaults write com.apple.Preview ApplePersistenceIgnoreState YES
    
    # Show Library folder
    chflags nohidden ~/Library 2>/dev/null || true
    
    # Show hidden files in Finder
    defaults write com.apple.finder AppleShowAllFiles YES
    
    # Show path bar in Finder
    defaults write com.apple.finder ShowPathbar -bool true
    
    # Show status bar in Finder
    defaults write com.apple.finder ShowStatusBar -bool true
    
    # Enable key repeat
    defaults write -g ApplePressAndHoldEnabled -bool false 2>&1 > /dev/null || true
    defaults write com.microsoft.VSCodeInsiders ApplePressAndHoldEnabled -bool false 2>&1 > /dev/null || true
    
    # Font smoothing
    defaults write -g AppleFontSmoothing -int 1
    
    # Key repeat rate
    defaults write -g KeyRepeat -int 2
    defaults write -g InitialKeyRepeat -int 15

    # Disable automatic macOS software updates
    sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool false
    sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false
    sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false
    
    # Restart Finder
    killall Finder 2>/dev/null || true
    
    log_success "macOS defaults configured"
}

# ============================================================================
# PHASE 5: Package Management
# ============================================================================

phase_package_management() {
    local install_mac_apps="$1"
    local install_npx="$2"
    local install_pi="$3"
    local install_toolchain="$4"
    
    log_step "Phase 5: Package Management"
    
    if is_macos; then
        if [[ "$install_mac_apps" == true ]]; then
            install_homebrew_packages
        else
            log_info "Skipping Homebrew packages (use --mac-apps to install)"
        fi
    fi
    
    if [[ "$install_toolchain" == true ]]; then
        if install_official_toolchains; then
            install_go_tools
        else
            log_error "Toolchain installation failed"
            exit 1
        fi
    else
        log_info "Skipping Go, Rust, and Node.js toolchains (use --toolchain to install)"
        log_info "Skipping Go tools (use --toolchain to install)"
    fi

    if [[ "$install_npx" == true ]]; then
        install_npx_tools
    else
        log_info "Skipping npx tools (use --npx to install)"
    fi

    if [[ "$install_pi" == true ]]; then
        install_pi_extensions
    else
        log_info "Skipping PI extensions (use --pi to install)"
    fi
}

install_homebrew_packages() {
    log_info "Installing Homebrew packages..."
    
    if ! check_command brew; then
        log_warn "Homebrew is not installed"
        log_info "To install: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        return 0
    fi
    
    # Install proxychains-ng from source
    if check_command proxychains4; then
        log_success "proxychains4 already installed"
    else
        log_info "Installing proxychains-ng from source..."
        if brew install --build-from-source proxychains-ng; then
            log_success "proxychains-ng installed"
        else
            log_warn "Failed to install proxychains-ng"
        fi
    fi
    
    # Install CLI packages
    for package in "${BREW_CLI_PACKAGES[@]}"; do
        install_brew_package "$package"
    done

    # Install taps
    for tap in "${BREW_TAPS[@]}"; do
        install_brew_tap "$tap"
    done
    
    # Install cask packages
    for cask in "${BREW_CASK_PACKAGES[@]}"; do
        install_brew_cask "$cask"
    done
    
    # Install tap casks
    for cask in "${BREW_TAP_CASKS[@]}"; do
        local cask_name="${cask##*/}"
        if brew list --cask | grep -q "^$cask_name$"; then
            log_success "$cask_name already installed"
        else
            log_info "Installing $cask..."
            if brew install --cask "$cask"; then
                log_success "$cask_name installed"
            else
                log_warn "Failed to install $cask"
            fi
        fi
    done
    
    log_success "Homebrew packages installation completed"
}

install_npx_tools() {
    if ! check_command npx; then
        log_warn "npx is not installed. Skipping npx tools installation."
        return 0
    fi
    
    log_info "Installing npx tools..."
    
    # Install skills
    local installed_skills
    installed_skills="$(/usr/bin/env npx skills list -g 2>/dev/null || true)"
    
    for skill in "${NPX_SKILLS[@]}"; do
        local skill_name="${skill##*/}"
        if [[ "$installed_skills" == *"$skill_name"* ]]; then
            log_success "$skill already installed (global)"
            continue
        fi
        
        log_info "Installing skill $skill..."
        if /usr/bin/env npx skills add --yes -g "$skill"; then
            log_success "$skill installed"
        else
            log_warn "Failed to install $skill"
        fi
    done
    
    # Setup ctx7
    log_info "Running ctx7 setup..."
    if /usr/bin/env npx ctx7 setup --opencode --yes; then
        log_success "ctx7 setup completed"
    else
        log_warn "ctx7 setup failed"
    fi
    
    log_success "npx tools installation completed"
}

install_official_toolchains() {
    if ! is_macos; then
        log_error "--toolchain currently supports macOS only"
        return 1
    fi

    log_info "Installing official language toolchains..."
    install_official_go || return 1
    install_official_node || return 1
    install_official_rust || return 1
    log_success "Official language toolchains installation completed"
}

install_official_go() {
    local go_version
    local go_arch
    local installed_version=""
    local temp_dir
    local package_path
    local signature_output

    log_info "Checking the latest official Go release..."
    go_version=$(curl -fsSL 'https://go.dev/VERSION?m=text' | awk 'NR == 1 { print; exit }')
    if [[ ! "$go_version" =~ ^go[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
        log_error "Could not determine the latest Go version"
        return 1
    fi

    case "$(uname -m)" in
        x86_64)
            go_arch="amd64"
            ;;
        arm64)
            go_arch="arm64"
            ;;
        *)
            log_error "Unsupported macOS architecture for Go: $(uname -m)"
            return 1
            ;;
    esac

    if [[ -x /usr/local/go/bin/go ]]; then
        installed_version=$(/usr/local/go/bin/go version | awk '{ print $3 }')
    fi

    if [[ "$installed_version" == "$go_version" ]]; then
        log_success "Go ${go_version#go} already installed"
        export PATH="/usr/local/go/bin:$PATH"
        return 0
    fi

    temp_dir=$(mktemp -d) || {
        log_error "Failed to create a temporary directory for Go"
        return 1
    }
    package_path="$temp_dir/${go_version}.darwin-${go_arch}.pkg"

    log_info "Downloading ${go_version} for darwin/${go_arch}..."
    if ! curl -fL "https://go.dev/dl/${go_version}.darwin-${go_arch}.pkg" -o "$package_path"; then
        rm -rf "$temp_dir"
        log_error "Failed to download the Go installer"
        return 1
    fi

    signature_output=$(pkgutil --check-signature "$package_path" 2>&1) || {
        rm -rf "$temp_dir"
        log_error "The Go installer signature could not be verified"
        return 1
    }
    if [[ "$signature_output" != *"Notarization: trusted by the Apple notary service"* ]] || \
       [[ "$signature_output" != *"Developer ID Installer: Google LLC"* ]]; then
        rm -rf "$temp_dir"
        log_error "The Go installer is not a trusted notarized Google package"
        return 1
    fi

    log_info "Installing ${go_version}; macOS may request your administrator password..."
    if ! sudo /usr/sbin/installer -pkg "$package_path" -target /; then
        rm -rf "$temp_dir"
        log_error "Failed to install Go"
        return 1
    fi
    rm -rf "$temp_dir"

    export PATH="/usr/local/go/bin:$PATH"
    if [[ "$(/usr/local/go/bin/go version | awk '{ print $3 }')" != "$go_version" ]]; then
        log_error "Go installation verification failed"
        return 1
    fi
    log_success "Go ${go_version#go} installed from the official package"
}

install_official_node() {
    local shasums
    local package_name
    local node_version
    local installed_version=""
    local expected_checksum
    local actual_checksum
    local temp_dir
    local package_path
    local signature_output

    log_info "Checking the latest official Node.js release..."
    shasums=$(curl -fsSL 'https://nodejs.org/dist/latest/SHASUMS256.txt') || {
        log_error "Could not retrieve the latest Node.js checksums"
        return 1
    }
    package_name=$(printf '%s\n' "$shasums" | awk '$2 ~ /^node-v[0-9]+\.[0-9]+\.[0-9]+\.pkg$/ { print $2; exit }')
    node_version=${package_name#node-}
    node_version=${node_version%.pkg}
    if [[ ! "$node_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "Could not determine the latest Node.js version"
        return 1
    fi

    if [[ -x /usr/local/bin/node ]]; then
        installed_version=$(/usr/local/bin/node --version)
    fi

    if [[ "$installed_version" == "$node_version" ]]; then
        log_success "Node.js ${node_version#v} already installed"
        export PATH="/usr/local/bin:$PATH"
        return 0
    fi

    expected_checksum=$(printf '%s\n' "$shasums" | awk -v package="$package_name" '$2 == package { print $1; exit }')
    if [[ ! "$expected_checksum" =~ ^[0-9a-f]{64}$ ]]; then
        log_error "Could not determine the Node.js installer checksum"
        return 1
    fi

    temp_dir=$(mktemp -d) || {
        log_error "Failed to create a temporary directory for Node.js"
        return 1
    }
    package_path="$temp_dir/$package_name"

    log_info "Downloading Node.js ${node_version#v}..."
    if ! curl -fL "https://nodejs.org/dist/latest/$package_name" -o "$package_path"; then
        rm -rf "$temp_dir"
        log_error "Failed to download the Node.js installer"
        return 1
    fi

    actual_checksum=$(shasum -a 256 "$package_path" | awk '{ print $1 }')
    if [[ "$actual_checksum" != "$expected_checksum" ]]; then
        rm -rf "$temp_dir"
        log_error "The Node.js installer checksum does not match SHASUMS256.txt"
        return 1
    fi

    signature_output=$(pkgutil --check-signature "$package_path" 2>&1) || {
        rm -rf "$temp_dir"
        log_error "The Node.js installer signature could not be verified"
        return 1
    }
    if [[ "$signature_output" != *"Notarization: trusted by the Apple notary service"* ]]; then
        rm -rf "$temp_dir"
        log_error "The Node.js installer is not trusted by the Apple notary service"
        return 1
    fi

    log_info "Installing Node.js ${node_version#v}; macOS may request your administrator password..."
    if ! sudo /usr/sbin/installer -pkg "$package_path" -target /; then
        rm -rf "$temp_dir"
        log_error "Failed to install Node.js"
        return 1
    fi
    rm -rf "$temp_dir"

    export PATH="/usr/local/bin:$PATH"
    if [[ "$(/usr/local/bin/node --version)" != "$node_version" ]] || \
       ! /usr/local/bin/npm --version; then
        log_error "Node.js installation verification failed"
        return 1
    fi
    log_success "Node.js ${node_version#v} installed from the official package"
}

install_official_rust() {
    local rustup_bin="$HOME/.cargo/bin/rustup"

    if [[ ! -x "$rustup_bin" ]]; then
        log_info "Installing Rust through the official rustup installer..."
        if ! curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
            sh -s -- -y --default-toolchain stable --profile default; then
            log_error "Failed to install rustup"
            return 1
        fi
    else
        log_info "Updating the official Rust stable toolchain..."
        if ! "$rustup_bin" update stable; then
            log_error "Failed to update the Rust stable toolchain"
            return 1
        fi
    fi

    if ! "$rustup_bin" default stable; then
        log_error "Failed to select the Rust stable toolchain"
        return 1
    fi

    export PATH="$HOME/.cargo/bin:$PATH"
    if ! rustc --version || ! cargo --version; then
        log_error "Rust installation verification failed"
        return 1
    fi
    log_success "Latest official Rust stable toolchain installed"
}

install_go_tools() {
    if ! check_command go; then
        log_warn "Go is not installed. Skipping Go tools installation."
        return 0
    fi
    
    log_info "Installing Go tools..."
    
    for package in "${GO_PACKAGES[@]}"; do
        local package_name
        package_name=$(echo "$package" | sed 's/@.*//' | awk -F'/' '{print $NF}')
        
        log_info "Installing Go package $package..."
        if go install "$package"; then
            log_success "$package_name installed"
        else
            log_warn "Failed to install $package"
        fi
    done
    
    log_success "Go tools installation completed"
}

install_pi_extensions() {
    if ! check_command pi; then
        log_info "pi is not installed. Skipping PI extensions installation."
        return 0
    fi

    log_info "Installing PI extensions..."

    for extension in "${PI_EXTENSIONS[@]}"; do
        local ext_name="${extension##*/}"
        
        log_info "Installing PI extension $extension..."
        if pi install "$extension"; then
            log_success "$ext_name installed"
        else
            log_warn "Failed to install $ext_name"
        fi
    done

    log_success "PI extensions installation completed"
}

# ============================================================================
# PHASE 6: Post-Install Configuration
# ============================================================================

phase_postinstall() {
    log_step "Phase 6: Post-Install Configuration"
    
    # Create directory structure
    log_info "Creating directory structure..."
    for dir in "${ART_DIRS[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir" && log_success "Created $dir"
        else
            log_success "$dir already exists"
        fi
    done
    
    # Setup shell frameworks
    if is_macos; then
        setup_oh_my_zsh
        setup_oh_my_fish
        setup_home_manager
        setup_lazygit_symlink
    fi
    
    log_success "Post-install configuration completed"
}

setup_oh_my_zsh() {
    if [[ -d ~/.oh-my-zsh/ ]]; then
        log_success "oh-my-zsh already installed"
        return 0
    fi
    
    log_info "Installing oh-my-zsh..."
    if sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"; then
        log_success "oh-my-zsh installed"
    else
        log_warn "Failed to install oh-my-zsh"
    fi
}

setup_oh_my_fish() {
    if ! check_command fish; then
        log_info "Fish shell is not installed, skipping oh-my-fish setup"
        return 0
    fi
    
    if [[ -d ~/.local/share/omf/ ]]; then
        log_success "oh-my-fish already installed"
    else
        log_info "Installing oh-my-fish..."
        if curl -fsSL https://raw.githubusercontent.com/oh-my-fish/oh-my-fish/master/bin/install | fish; then
            log_success "oh-my-fish installed"
        else
            log_warn "Failed to install oh-my-fish"
            return 1
        fi
    fi
    
    # Install plugins
    for plugin in "${OMF_PLUGINS[@]}"; do
        if [[ -d ~/.local/share/omf/pkg/$plugin ]]; then
            log_success "omf plugin $plugin already installed"
        else
            log_info "Installing omf plugin $plugin..."
            if fish -c "omf install $plugin"; then
                log_success "omf plugin $plugin installed"
            else
                log_warn "Failed to install omf plugin $plugin"
            fi
        fi
    done
}

setup_home_manager() {
    if ! check_command nix-channel; then
        log_info "Nix is not installed, skipping home-manager setup"
        return 0
    fi
    
    log_info "Setting up home-manager..."
    
    if nix-channel --list | grep -q home-manager; then
        log_success "home-manager channel already added"
    else
        log_info "Adding home-manager channel..."
        nix-channel --add https://github.com/nix-community/home-manager/archive/master.tar.gz home-manager
        nix-channel --update
    fi
    
    if nix-channel --list | grep -q nixpkgs; then
        log_success "nixpkgs channel already added"
    else
        log_info "Adding nixpkgs channel..."
        nix-channel --add https://mirrors.ustc.edu.cn/nix-channels/nixpkgs nixpkgs
    fi
    
    log_success "home-manager setup completed"
}

setup_lazygit_symlink() {
    local source="$HOME/.config/lazygit/config.yml"
    local target="$HOME/Library/Application Support/lazygit/config.yml"
    
    if [[ ! -f "$source" ]]; then
        log_info "lazygit config not found at $source, skipping symlink setup"
        return 0
    fi
    
    log_info "Setting up lazygit config symlink..."
    
    # Create target directory if it doesn't exist
    mkdir -p "$HOME/Library/Application Support/lazygit"
    
    # Remove existing file/link if it exists
    if [[ -e "$target" || -L "$target" ]]; then
        rm -f "$target"
    fi
    
    # Create symlink
    if ln -s "$source" "$target"; then
        log_success "lazygit config symlinked: $target -> $source"
    else
        log_warn "Failed to create lazygit config symlink"
    fi
}

# ============================================================================
# GIT OPERATIONS
# ============================================================================

git_pull_latest() {
    log_info "Pulling latest changes from origin/master..."
    if git pull --ff origin master &> /dev/null; then
        log_success "Repository updated"
    else
        log_warn "Failed to pull latest changes (continuing anyway)"
    fi
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================

show_usage() {
    cat << EOF
Dotfiles Installation Script v${SCRIPT_VERSION}

Usage: $0 [OPTIONS]

OPTIONS:
    --no-pull       Skip git pull before installation
    --dry-run       Show what would be deployed without making changes
    --toolchain     Install latest official Go, Rust, and Node.js (macOS only)
    --npx           Install npx tools (skills + ctx7)
    --pi            Install PI extensions
    --mac-apps      Install Homebrew packages and casks (macOS only)
    -h, --help      Show this help message

EXAMPLES:
    $0                          # Standard installation
    $0 --dry-run                # Preview changes
    $0 --mac-apps --toolchain --npx --pi  # Full installation with all optional components
    $0 --no-pull --dry-run      # Preview without updating repo

EOF
}

main() {
    local no_pull=false
    local dry_run=false
    local install_npx=false
    local install_pi=false
    local install_mac_apps=false
    local install_toolchain=false
    
    # Parse arguments
    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            --no-pull)
                no_pull=true
                ;;
            --dry-run)
                dry_run=true
                ;;
            --npx)
                install_npx=true
                ;;
            --pi)
                install_pi=true
                ;;
            --mac-apps)
                install_mac_apps=true
                ;;
            --toolchain)
                install_toolchain=true
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
    
    # Show banner
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         Dotfiles Installation Script v${SCRIPT_VERSION}           ║"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo ""
    
    # Git pull
    if [[ "$no_pull" == false ]]; then
        git_pull_latest
    else
        log_info "Skipping git pull (--no-pull specified)"
    fi
    
    # Execute phases
    phase_preflight
    phase_backup "$dry_run"
    phase_deploy "$dry_run"
    
    if [[ "$dry_run" == false ]]; then
        phase_platform_setup
        phase_package_management "$install_mac_apps" "$install_npx" "$install_pi" "$install_toolchain"
        phase_postinstall
    else
        log_info "Skipping remaining phases in dry-run mode"
    fi
    
    # Final message
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                  Installation Complete!                   ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    if [[ "$dry_run" == false ]]; then
        log_info "Next steps:"
        log_info "  1. Restart your terminal or run: source ~/.bash_profile"
        log_info "  2. If using Fish: exec fish"
        log_info "  3. Verify installation: which fish"
    fi
}

# ============================================================================
# ENTRY POINT
# ============================================================================

main "$@"
