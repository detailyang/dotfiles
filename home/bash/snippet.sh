#!/usr/bin/env bash

# Snippte integration - code snippet management with fzf
# Requires: ~/bin/snippet or ~/dotfiles/bin/snippet

function sb() {
    local snippet=""
    
    if test -x ~/bin/snippet; then
        snippet=~/bin/snippet
    elif test -x ~/dotfiles/home/bin/snippet; then
        snippet=~/dotfiles/home/bin/snippet
    elif test -x "$(dirname "${BASH_SOURCE}")/../bin/snippet"; then
        snippet="$(dirname "${BASH_SOURCE}")/../bin/snippet"
    fi
    
    if test -n "$snippet"; then
        $snippet "$@"
    else
        echo "Warning: snippet not found"
    fi
}
