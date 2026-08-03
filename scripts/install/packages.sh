# Requested Home Manager, Mise, npx, Go, and Pi components.

readonly YBW_NPX_SKILLS=(
    "vercel-labs/agent-browser"
    "pbakaus/impeccable"
    "tw93/Waza"
)

readonly YBW_GO_PACKAGES=(
    "github.com/m7medvision/lazycommit@latest"
)

readonly YBW_PI_EXTENSIONS=(
    "npm:pi-planning-with-files"
    "npm:@ff-labs/pi-fff"
)

ybw::packages::install_selected() {
    local failed=0
    local fish_path

    ybw::log::step "Phase 4: Package Management"

    if ybw::platform::is_linux; then
        if ! ybw::linux::install_fish; then
            ybw::log::error "Linux Fish installation failed"
            return 1
        fi

        fish_path="$(ybw::linux::find_fish)" || {
            ybw::log::error "No stable system Fish executable found"
            return 1
        }
        if ! ybw::linux::configure_fish_login_shell "$fish_path"; then
            ybw::result::warn "Continuing without changing the login shell"
        fi
    fi

    if [[ "$YBW_INSTALL_PLAN_HOME_MANAGER" == true ]]; then
        if ! ybw::packages::activate_home_manager "$YBW_INSTALL_PLAN_HOME_MANAGER_PROFILE"; then
            ybw::log::error "Home Manager activation failed"
            return 1
        fi
    else
        ybw::log::info "Skipping Home Manager activation (use --home-manager to activate)"
    fi

    if ybw::platform::is_macos; then
        fish_path="$(ybw::macos::find_fish)" || {
            ybw::log::error "Fish is not installed; rerun with --home-manager to install it through Nix"
            return 1
        }
        if ! ybw::macos::configure_fish_login_shell "$fish_path"; then
            ybw::result::warn "Continuing without changing the login shell"
        fi

        if [[ "$YBW_INSTALL_PLAN_MAC_APPS" == true ]]; then
            ybw::macos::install_optional_packages || failed=1
        else
            ybw::log::info "Skipping remaining Homebrew casks (use --mac-apps to install)"
        fi
    fi

    if [[ "$YBW_INSTALL_PLAN_TOOLCHAIN" == true ]]; then
        if ! ybw::packages::install_toolchains; then
            ybw::log::error "Toolchain installation failed"
            failed=1
        fi
    else
        ybw::log::info "Skipping Mise language toolchains (use --toolchain to install)"
    fi

    if [[ "$YBW_INSTALL_PLAN_NPX" == true ]]; then
        ybw::packages::install_npx || failed=1
    else
        ybw::log::info "Skipping npx tools (use --npx to install)"
    fi

    if [[ "$YBW_INSTALL_PLAN_PI" == true ]]; then
        ybw::packages::install_pi_extensions || failed=1
    else
        ybw::log::info "Skipping PI extensions (use --pi to install)"
    fi

    if [[ $failed -ne 0 ]]; then
        ybw::log::error "One or more requested package components failed"
        return 1
    fi
}

ybw::packages::install_npx() {
    local failed=0
    local installed_skills
    local skill
    local skill_name

    if ! ybw::command::exists mise; then
        ybw::log::error "Mise is required for --npx"
        return 1
    fi

    ybw::log::info "Installing npx tools..."
    installed_skills="$(mise exec -- npx skills list -g 2>/dev/null || true)"

    for skill in "${YBW_NPX_SKILLS[@]}"; do
        skill_name="${skill##*/}"
        if [[ "$installed_skills" == *"$skill_name"* ]]; then
            ybw::log::success "$skill already installed (global)"
            continue
        fi

        ybw::log::info "Installing skill $skill..."
        if mise exec -- npx skills add --yes -g "$skill"; then
            ybw::log::success "$skill installed"
        else
            ybw::log::warn "Failed to install $skill"
            failed=1
        fi
    done

    ybw::log::info "Running ctx7 setup..."
    if mise exec -- npx ctx7 setup --opencode --yes; then
        ybw::log::success "ctx7 setup completed"
    else
        ybw::log::warn "ctx7 setup failed"
        failed=1
    fi

    if [[ $failed -ne 0 ]]; then
        ybw::log::error "npx tools installation failed"
        return 1
    fi

    ybw::log::success "npx tools installation completed"
}

ybw::packages::install_toolchains() {
    if ! ybw::platform::is_macos; then
        ybw::log::error "--toolchain currently supports macOS only"
        return 1
    fi

    if ! ybw::command::exists mise; then
        ybw::log::error "Mise is required to install language toolchains"
        ybw::log::info "Activate the Home Manager configuration, then rerun with --toolchain"
        return 1
    fi

    ybw::log::info "Installing language toolchains with Mise..."
    if ! (cd "$HOME" && mise install); then
        ybw::log::error "Mise failed to install the configured language toolchains"
        return 1
    fi

    if ! ybw::packages::install_go_tools; then
        ybw::log::error "Go tools installation failed"
        return 1
    fi
    ybw::log::success "Mise language toolchains installed"
}

ybw::packages::install_go_tools() {
    local failed=0
    local package
    local package_name

    if ! ybw::command::exists mise; then
        ybw::log::error "Mise is required to install Go tools"
        return 1
    fi

    ybw::log::info "Installing Go tools..."

    for package in "${YBW_GO_PACKAGES[@]}"; do
        package_name="$(echo "$package" | sed 's/@.*//' | awk -F'/' '{print $NF}')"

        ybw::log::info "Installing Go package $package..."
        if mise exec -- go install "$package"; then
            ybw::log::success "$package_name installed"
        else
            ybw::log::warn "Failed to install $package"
            failed=1
        fi
    done

    if [[ $failed -ne 0 ]]; then
        ybw::log::error "Go tools installation failed"
        return 1
    fi

    ybw::log::success "Go tools installation completed"
}

ybw::packages::install_pi_extensions() {
    local ext_name
    local extension
    local failed=0

    if ! ybw::command::exists pi; then
        ybw::log::error "pi is required for --pi"
        return 1
    fi

    ybw::log::info "Installing PI extensions..."

    for extension in "${YBW_PI_EXTENSIONS[@]}"; do
        ext_name="${extension##*/}"

        ybw::log::info "Installing PI extension $extension..."
        if pi install "$extension"; then
            ybw::log::success "$ext_name installed"
        else
            ybw::log::warn "Failed to install $ext_name"
            failed=1
        fi
    done

    if [[ $failed -ne 0 ]]; then
        ybw::log::error "PI extensions installation failed"
        return 1
    fi

    ybw::log::success "PI extensions installation completed"
}

ybw::packages::activate_home_manager() {
    local profile="$1"
    local home_manager_dir="$HOME/.config/home-manager"
    local target

    if [[ -e "$HOME/.nix-profile" && ! -L "$HOME/.nix-profile" ]]; then
        ybw::log::error "~/.nix-profile must be a symlink before Home Manager activation"
        ybw::log::info "Move the existing path aside, then rerun this installer"
        return 1
    fi

    if ! ybw::nix::load_profile; then
        ybw::log::error "Nix with Flakes support is required to provide the Fish runtime integrations"
        ybw::log::info "Run ./scripts/install-nix.sh, then rerun this installer"
        return 1
    fi

    if [[ ! -f "$home_manager_dir/flake.nix" || ! -f "$home_manager_dir/flake.lock" ]]; then
        ybw::log::error "Home Manager Flake is incomplete at $home_manager_dir"
        return 1
    fi

    target="$(ybw::platform::home_manager_target "$profile")" || return 1
    ybw::log::info "Activating Home Manager target: $target"

    if ! nix run "$home_manager_dir#home-manager" -- --impure -v --option max-jobs 1 --option cores 2 --flake "$home_manager_dir#$target" switch; then
        ybw::log::error "Failed to activate Home Manager target: $target"
        return 1
    fi

    ybw::log::success "Home Manager setup completed"
}
