# Best-effort shell integrations and post-install filesystem setup.

readonly YBW_OMF_PLUGINS=(
    "fzf"
    "peco"
    "foreign-env"
    "bass"
)

readonly YBW_ART_DIRS=(
    "$HOME/art/github"
    "$HOME/art/opensource"
    "$HOME/art/personal"
)

ybw::postinstall::run() {
    local warning_count_before="$YBW_INSTALL_WARNING_COUNT"
    local warning_count
    local directory

    ybw::log::step "Phase 5: Post-Install Configuration"
    ybw::log::info "Creating directory structure..."

    for directory in "${YBW_ART_DIRS[@]}"; do
        if [[ ! -d "$directory" ]]; then
            if ! mkdir -p "$directory"; then
                ybw::log::error "Failed to create $directory"
                return 1
            fi
            ybw::log::success "Created $directory"
        else
            ybw::log::success "$directory already exists"
        fi
    done

    if ybw::platform::is_macos && ! ybw::postinstall::setup_oh_my_zsh; then
        ybw::result::warn "Continuing without oh-my-zsh"
    fi

    if ! ybw::postinstall::setup_oh_my_fish; then
        ybw::result::warn "Continuing with incomplete oh-my-fish setup"
    fi

    if ybw::platform::is_macos && ! ybw::postinstall::setup_lazygit_symlink; then
        ybw::result::warn "Continuing without the lazygit compatibility symlink"
    fi

    warning_count=$((YBW_INSTALL_WARNING_COUNT - warning_count_before))
    if [[ $warning_count -gt 0 ]]; then
        ybw::log::warn "Post-install configuration completed with $warning_count warning(s)"
    else
        ybw::log::success "Post-install configuration completed"
    fi
}

ybw::remote::run_installer() {
    local name="$1"
    local url="$2"
    local interpreter="$3"
    local installer_path
    local status=0

    installer_path="$(mktemp "${TMPDIR:-/tmp}/dotfiles-installer.XXXXXX")" || {
        ybw::log::warn "Failed to create a temporary file for $name"
        return 1
    }

    if ! curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
        "$url" --output "$installer_path"; then
        ybw::log::warn "Failed to download $name"
        rm -f "$installer_path"
        return 1
    fi

    "$interpreter" "$installer_path" || status=$?
    rm -f "$installer_path"

    if [[ $status -ne 0 ]]; then
        ybw::log::warn "$name installer failed with exit code $status"
        return 1
    fi
}

ybw::postinstall::setup_oh_my_zsh() {
    if [[ -d "$HOME/.oh-my-zsh" ]]; then
        ybw::log::success "oh-my-zsh already installed"
        return 0
    fi

    ybw::log::info "Installing oh-my-zsh..."
    if ybw::remote::run_installer \
        "oh-my-zsh" \
        "https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh" \
        sh
    then
        ybw::log::success "oh-my-zsh installed"
        return 0
    fi

    ybw::log::warn "Failed to install oh-my-zsh"
    return 1
}

ybw::postinstall::setup_oh_my_fish() {
    local failed=0
    local plugin

    if ! ybw::command::exists fish; then
        ybw::log::warn "Fish shell is not installed; cannot configure oh-my-fish"
        return 1
    fi

    if [[ -d "$HOME/.local/share/omf" ]]; then
        ybw::log::success "oh-my-fish already installed"
    else
        ybw::log::info "Installing oh-my-fish..."
        if ybw::remote::run_installer \
            "oh-my-fish" \
            "https://raw.githubusercontent.com/oh-my-fish/oh-my-fish/master/bin/install" \
            fish
        then
            ybw::log::success "oh-my-fish installed"
        else
            ybw::log::warn "Failed to install oh-my-fish"
            return 1
        fi
    fi

    for plugin in "${YBW_OMF_PLUGINS[@]}"; do
        if [[ -d "$HOME/.local/share/omf/pkg/$plugin" ]]; then
            ybw::log::success "omf plugin $plugin already installed"
        else
            ybw::log::info "Installing omf plugin $plugin..."
            if fish -c "omf install $plugin"; then
                ybw::log::success "omf plugin $plugin installed"
            else
                ybw::log::warn "Failed to install omf plugin $plugin"
                failed=1
            fi
        fi
    done

    [[ $failed -eq 0 ]]
}

ybw::postinstall::setup_lazygit_symlink() {
    local source="$HOME/.config/lazygit/config.yml"
    local target="$HOME/Library/Application Support/lazygit/config.yml"

    if [[ ! -f "$source" ]]; then
        ybw::log::info "lazygit config not found at $source, skipping symlink setup"
        return 0
    fi

    ybw::log::info "Setting up lazygit config symlink..."

    if ! mkdir -p "$HOME/Library/Application Support/lazygit"; then
        ybw::log::warn "Failed to create the lazygit configuration directory"
        return 1
    fi

    if [[ -e "$target" || -L "$target" ]]; then
        if ! rm -f "$target"; then
            ybw::log::warn "Failed to replace the existing lazygit config"
            return 1
        fi
    fi

    if ln -s "$source" "$target"; then
        ybw::log::success "lazygit config symlinked: $target -> $source"
        return 0
    fi

    ybw::log::warn "Failed to create lazygit config symlink"
    return 1
}
