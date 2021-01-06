#! /usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

function install_binutils() {
    brew install coreutils gnu-sed
}

function install_rust_app() {
    readonly apps=(fd bat hyperfine hexyl pastel exa)
    for app in "${apps[@]}"; do
        if ! command -v $app &> /dev/null; then
            brew install $app
        fi
    done
}

function preparse_oh_my_fish() {
    if ! command -v omf; then
        curl -L https://get.oh-my.fish | fish
        omf install z
        omf install peco
    fi
}

function prepare_dirs() {
    mkdir -p ~/art/{opensource,personal}
}

function rsync_dirs() {
    rsync --exclude-from=./.exclude \
        -avh --no-perms . ~
}

function git_pull() {
    git pull --ff origin master
}


function main() {
    echo "Pulling the lastest changes"
    git_pull

    echo "Rsyncing to target"
    rsync_dirs

    echo "Sourcing bash profile"
    source ~/.bash_profile

    echo "Preparing directory"
    prepare_dirs

    echo "Preparing oh my fish"
    preparse_oh_my_fish

    echo "Installing binutils"
    install_binutils

    echo "Installing rust app"
    install_rust_app
}

main
