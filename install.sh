#! /usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

function install_mac_app() {
    # defaults write -g applepressandholdenabled -bool false

    readonly apps=(amphetamine bartender enpass snippetslab eudic reeder dash karabiner itsycal paper hammersppon)

    for app in "${apps[@]}"; do
        echo "try to install $app"
    done
}

function preparse_oh_my_fish() {
    if type -q omf &> /dev/null; then
        echo "omf was installed"
    else
        curl -L https://get.oh-my.fish | fish
        omf install fzf
        omf install peco
        omf install foreign-env
        omf install bass
    fi
}

function prepare_dirs() {
    mkdir -p ~/art/{github,opensource,personal}
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

    echo "Installing mac app"
#    install_mac_app
}

main
