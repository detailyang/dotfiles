#!/usr/bin/env bash

# Dotfiles installer entry point for macOS, Linux, and WSL.

if [[ "${YBW_INSTALL_LOADED:-false}" == true ]]; then
    return 0 2>/dev/null || exit 0
fi

YBW_INSTALL_IS_ENTRYPOINT=false
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    YBW_INSTALL_IS_ENTRYPOINT=true
    set -o pipefail
fi

readonly YBW_INSTALL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

YBW_INSTALL_LOAD_STATUS=0
for YBW_INSTALL_MODULE in \
    core \
    plan \
    deploy \
    platform \
    packages \
    postinstall \
    main
do
    if ! source "$YBW_INSTALL_ROOT/scripts/install/$YBW_INSTALL_MODULE.sh"; then
        echo "ERROR: Failed to load installer module: $YBW_INSTALL_MODULE" >&2
        YBW_INSTALL_LOAD_STATUS=1
        break
    fi
done
unset YBW_INSTALL_MODULE

if [[ $YBW_INSTALL_LOAD_STATUS -ne 0 ]]; then
    if [[ "$YBW_INSTALL_IS_ENTRYPOINT" == true ]]; then
        exit "$YBW_INSTALL_LOAD_STATUS"
    fi
    return "$YBW_INSTALL_LOAD_STATUS"
fi
readonly YBW_INSTALL_LOADED=true

if [[ "$YBW_INSTALL_IS_ENTRYPOINT" == true ]]; then
    ybw::install::main "$@"
fi
