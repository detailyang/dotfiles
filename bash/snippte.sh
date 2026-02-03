#!/usr/bin/env bash

# Snippte integration - code snippet management with fzf
# Requires: ~/bin/snippte or ~/dotfiles/bin/snippte

function sb() {
    local snippte=""
    
    if test -x ~/bin/snippte; then
        snippte=~/bin/snippte
    elif test -x ~/dotfiles/bin/snippte; then
        snippte=~/dotfiles/bin/snippte
    elif test -x "$(dirname "${BASH_SOURCE}")/../bin/snippte"; then
        snippte="$(dirname "${BASH_SOURCE}")/../bin/snippte"
    fi
    
    if test -n "$snippte"; then
        $snippte "$@"
    else
        echo "Warning: snippte not found"
    fi
}
