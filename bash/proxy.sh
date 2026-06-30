#!/usr/bin/env bash

# Proxy env shell adapter. Shared proxy rules live in bin/proxy-env.

function _proxy_env_cmd() {
    local repo_root
    repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

    local candidates=(
        "$HOME/bin/proxy-env"
        "$HOME/dotfiles/bin/proxy-env"
        "$repo_root/bin/proxy-env"
    )
    local candidate

    for candidate in "${candidates[@]}"; do
        if [[ -x "$candidate" ]]; then
            printf '%s' "$candidate"
            return 0
        fi
    done

    echo "Warning: proxy-env not found" >&2
    return 1
}

function _proxy_env_eval() {
    local mode="$1"
    shift

    local cmd
    cmd=$(_proxy_env_cmd) || return 1

    local output
    output=$("$cmd" bash "$mode" "$@") || return 1
    eval "$output"
}

function proxy() {
    _proxy_env_eval proxy "$@"
}

function unproxy() {
    _proxy_env_eval unproxy
}

function autoproxy() {
    _proxy_env_eval autoproxy
}

function wslproxy() {
    _proxy_env_eval wslproxy
}
