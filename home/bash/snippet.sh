#!/usr/bin/env bash

# Snippet integration - code snippet management with fzf
# Requires: ~/bin/snippet or the checkout's home/bin/snippet

function sb() {
    local snippet=""
    
    if test -x ~/bin/snippet; then
        snippet=~/bin/snippet
    elif test -x "$(dirname "${BASH_SOURCE}")/../bin/snippet"; then
        snippet="$(dirname "${BASH_SOURCE}")/../bin/snippet"
    fi
    
    if test -n "$snippet"; then
        $snippet "$@"
    else
        echo "Warning: snippet not found"
    fi
}
