# Host preflight and recoverable rsync deployment of the $HOME mirror.
#
# home/ mirrors $HOME exactly: every tracked file under home/ is deployed to
# the same relative path in $HOME, and nothing else is deployed. The
# repository root .agents symlink points into home/.agents so coding agents
# can discover project skills.
#
# ~/.config/opencode/AGENTS.md is a symlink into ~/.agents. Its target only
# resolves inside $HOME, so the deploy phase creates it instead of tracking a
# repository symlink that would be broken in the working tree.

ybw::deploy::preflight() {
    local available_space

    ybw::log::step "Phase 1: Pre-flight Checks"
    ybw::log::info "Platform: $(ybw::platform::name)"
    ybw::log::info "Script version: $YBW_INSTALL_VERSION"

    available_space="$(df -k "$HOME" | awk 'NR==2 {print int($4/1024)}')" || {
        ybw::log::error "Failed to determine available disk space"
        return 1
    }
    if [[ ! "$available_space" =~ ^[0-9]+$ ]]; then
        ybw::log::error "Could not parse available disk space"
        return 1
    fi
    if [[ $available_space -lt 100 ]]; then
        ybw::log::error "Insufficient disk space. Need at least 100MB, available: ${available_space}MB"
        return 1
    fi
    ybw::log::success "Disk space OK (${available_space}MB available)"

    if [[ ! -w "$HOME" ]]; then
        ybw::log::error "No write permission to home directory"
        return 1
    fi
    ybw::log::success "Home directory writable"
    ybw::log::success "All pre-flight checks passed"
}

ybw::deploy::list_tree_files() {
    local tree="$1"
    local strip_prefix="$2"
    local output_file="$3"
    local selected

    if ! selected="$(git -C "$YBW_INSTALL_ROOT" ls-files -- "$tree")"; then
        ybw::log::error "Failed to list tracked files for deployment tree: $tree"
        return 1
    fi
    if [[ -z "$selected" ]]; then
        ybw::log::error "Deployment tree has no tracked files: $tree"
        return 1
    fi

    if [[ -n "$strip_prefix" ]]; then
        selected="$(printf '%s\n' "$selected" | sed "s|^$strip_prefix/||")"
    fi

    if ! printf '%s\n' "$selected" | LC_ALL=C sort -u > "$output_file"; then
        ybw::log::error "Failed to normalize the deployment file list for: $tree"
        return 1
    fi
}

ybw::deploy::sync_tree() {
    local source_dir="$1"
    local file_list="$2"
    local dry_run="$3"
    local backup_dir="$4"
    local rsync_status=0
    local -a rsync_args

    rsync_args=(
        -avh
        --no-perms
        --files-from="$file_list"
        --backup
        --backup-dir="$backup_dir"
    )

    if [[ "$dry_run" == true ]]; then
        rsync_args+=(--dry-run)
        rsync "${rsync_args[@]}" "$source_dir" "$HOME/" 2>&1 | \
            grep -v "sending incremental file list" | \
            grep -v "^$"
        rsync_status=${PIPESTATUS[0]}
    else
        rsync "${rsync_args[@]}" "$source_dir" "$HOME/" || rsync_status=$?
    fi

    return "$rsync_status"
}

ybw::deploy::link_agent_instructions() {
    local link_path="$HOME/.config/opencode/AGENTS.md"

    if ! mkdir -p "$(dirname "$link_path")"; then
        ybw::log::error "Failed to create directory for $link_path"
        return 1
    fi
    if ! ln -sfn "../../.agents/AGENTS.md" "$link_path"; then
        ybw::log::error "Failed to link $link_path to ~/.agents/AGENTS.md"
        return 1
    fi
}

ybw::deploy::run() {
    local dry_run="$1"
    local backup_dir="$HOME/.dotfiles-backup-$(date +%Y%m%d_%H%M%S)-$$"
    local home_list
    local rsync_status=0

    ybw::log::step "Phase 2: Deploying Configuration Files"

    home_list="$(mktemp "${TMPDIR:-/tmp}/dotfiles-deploy.XXXXXX")" || {
        ybw::log::error "Failed to create deployment file list"
        return 1
    }

    if ! ybw::deploy::list_tree_files home home "$home_list"; then
        rm -f "$home_list"
        return 1
    fi

    if [[ "$dry_run" == true ]]; then
        ybw::log::info "DRY RUN: Would deploy these tracked files:"
    else
        if ! mkdir -p "$backup_dir"; then
            ybw::log::error "Failed to create backup directory: $backup_dir"
            rm -f "$home_list"
            return 1
        fi

        ybw::log::info "Backup location: $backup_dir"
        ybw::log::info "Deploying tracked configs with rsync..."
    fi

    ybw::deploy::sync_tree "$YBW_INSTALL_ROOT/home/" "$home_list" "$dry_run" "$backup_dir" || rsync_status=$?

    rm -f "$home_list"

    if [[ $rsync_status -ne 0 ]]; then
        ybw::log::error "rsync failed with exit code $rsync_status"
        ybw::log::error "Please check permissions and disk space"
        return 1
    fi

    if [[ "$dry_run" == true ]]; then
        ybw::log::info "Would link ~/.config/opencode/AGENTS.md -> ~/.agents/AGENTS.md"
        return 0
    fi

    ybw::deploy::link_agent_instructions || return 1

    ybw::log::success "Configs deployed successfully"
    ybw::log::info "To restore replaced files: rsync -av '$backup_dir/' '$HOME/'"
}
