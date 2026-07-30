# Top-level installer orchestration.

ybw::git::pull_latest() {
    ybw::log::info "Pulling latest changes from origin/master..."
    if git -C "$YBW_INSTALL_ROOT" pull --ff origin master &> /dev/null; then
        ybw::log::success "Repository updated"
    else
        ybw::result::warn "Failed to pull latest changes (continuing anyway)"
    fi
}

ybw::install::execute() {
    if [[ "$YBW_INSTALL_PLAN_NO_PULL" == false ]]; then
        ybw::git::pull_latest
    else
        ybw::log::info "Skipping git pull (--no-pull specified)"
    fi

    ybw::deploy::run "$YBW_INSTALL_PLAN_DRY_RUN" || return 1

    if [[ "$YBW_INSTALL_PLAN_DRY_RUN" == true ]]; then
        ybw::log::info "Skipping remaining phases in dry-run mode"
        return 0
    fi

    ybw::platform::configure || return 1
    ybw::packages::install_selected || return 1
    ybw::postinstall::run || return 1
}

ybw::install::show_failure() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                    Installation Failed                    ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    ybw::log::error "Installation stopped after a required or requested step failed"
}

ybw::install::show_success() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    if [[ $YBW_INSTALL_WARNING_COUNT -gt 0 ]]; then
        echo "║             Installation Complete with Warnings           ║"
    else
        echo "║                  Installation Complete!                   ║"
    fi
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    if [[ $YBW_INSTALL_WARNING_COUNT -gt 0 ]]; then
        ybw::log::warn "Completed with $YBW_INSTALL_WARNING_COUNT optional warning(s)"
    fi
}

ybw::install::main() {
    ybw::plan::reset
    ybw::plan::parse "$@" || return 1
    if [[ "$YBW_INSTALL_PLAN_SHOW_HELP" == true ]]; then
        return 0
    fi

    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         Dotfiles Installation Script v${YBW_INSTALL_VERSION}           ║"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo ""

    if ! ybw::plan::validate || ! ybw::deploy::preflight; then
        ybw::install::show_failure
        return 1
    fi

    if ! ybw::install::execute; then
        ybw::install::show_failure
        return 1
    fi

    ybw::install::show_success

    if [[ "$YBW_INSTALL_PLAN_DRY_RUN" == false ]]; then
        ybw::log::info "Next steps:"
        ybw::log::info "  1. Restart your terminal or run: source ~/.bash_profile"
        ybw::log::info "  2. If using Fish: exec fish"
        ybw::log::info "  3. Verify installation: which fish"
    fi
}
