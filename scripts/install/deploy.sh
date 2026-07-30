# Host preflight, deployment manifest expansion, and recoverable rsync deployment.

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

ybw::deploy::expand_manifest() {
    local output_file="$1"
    local manifest="${2:-$YBW_INSTALL_ROOT/deploy.manifest}"
    local entry
    local selected
    local -a roots=()

    if [[ ! -f "$manifest" ]]; then
        ybw::log::error "Deployment manifest not found at $manifest"
        return 1
    fi

    while IFS= read -r entry || [[ -n "$entry" ]]; do
        entry="${entry%$'\r'}"
        case "$entry" in
            ""|\#*)
                continue
                ;;
            .|/*|..|../*|*/../*|*/..)
                ybw::log::error "Invalid deployment manifest entry: $entry"
                return 1
                ;;
        esac
        roots+=("$entry")
    done < "$manifest"

    if [[ ${#roots[@]} -eq 0 ]]; then
        ybw::log::error "Deployment manifest is empty"
        return 1
    fi

    : > "$output_file"
    for entry in "${roots[@]}"; do
        if ! selected="$(git -C "$YBW_INSTALL_ROOT" ls-files -- "$entry")"; then
            ybw::log::error "Failed to expand deployment manifest entry: $entry"
            return 1
        fi
        if [[ -z "$selected" ]]; then
            ybw::log::error "Deployment manifest entry does not match tracked files: $entry"
            return 1
        fi
        printf '%s\n' "$selected" >> "$output_file"
    done

    if ! LC_ALL=C sort -u -o "$output_file" "$output_file"; then
        ybw::log::error "Failed to normalize the deployment file list"
        return 1
    fi
}

ybw::deploy::run() {
    local dry_run="$1"
    local backup_dir="$HOME/.dotfiles-backup-$(date +%Y%m%d_%H%M%S)-$$"
    local file_list
    local rsync_status=0
    local -a rsync_args

    ybw::log::step "Phase 2: Deploying Configuration Files"

    file_list="$(mktemp "${TMPDIR:-/tmp}/dotfiles-deploy.XXXXXX")" || {
        ybw::log::error "Failed to create deployment file list"
        return 1
    }

    if ! ybw::deploy::expand_manifest "$file_list"; then
        rm -f "$file_list"
        return 1
    fi

    rsync_args=(
        -avh
        --no-perms
        --files-from="$file_list"
        --backup
        --backup-dir="$backup_dir"
    )

    if [[ "$dry_run" == true ]]; then
        ybw::log::info "DRY RUN: Would deploy these tracked files:"
        rsync_args+=(--dry-run)
        rsync "${rsync_args[@]}" "$YBW_INSTALL_ROOT/" "$HOME/" 2>&1 | \
            grep -v "sending incremental file list" | \
            grep -v "^$"
        rsync_status=${PIPESTATUS[0]}
    else
        if ! mkdir -p "$backup_dir"; then
            ybw::log::error "Failed to create backup directory: $backup_dir"
            rm -f "$file_list"
            return 1
        fi

        ybw::log::info "Backup location: $backup_dir"
        ybw::log::info "Deploying tracked configs with rsync..."
        rsync "${rsync_args[@]}" "$YBW_INSTALL_ROOT/" "$HOME/" || rsync_status=$?
    fi

    rm -f "$file_list"

    if [[ $rsync_status -ne 0 ]]; then
        ybw::log::error "rsync failed with exit code $rsync_status"
        ybw::log::error "Please check permissions and disk space"
        return 1
    fi

    if [[ "$dry_run" == false ]]; then
        ybw::log::success "Configs deployed successfully"
        ybw::log::info "To restore replaced files: rsync -av '$backup_dir/' '$HOME/'"
    fi
}
