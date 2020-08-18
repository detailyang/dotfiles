#! /usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

function install_rust_app() {
    readonly apps=(fd bat hyperfine hexyl pastel)
    for app in "${apps[@]}"; do
        if ! command -v $app &> /dev/null; then
            brew install $app
        fi
    done
}


function main() {
    echo "Pulling the lastest changes"
    git pull --ff origin master

    echo "Rsyncing to target"
    rsync --exclude-from=./.exclude \
        -avh --no-perms . ~

    echo "Sourcing bash profile"
    source ~/.bash_profile

    echo "Prepare directory"
    mkdir -p ~/art/{opensource,personal}

    echo "Install rust app"
    install_rust_app;
}

main
