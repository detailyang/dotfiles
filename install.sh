#! /usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

function install_binutils() {
    echo "skiping install coreutils"
    #brew install coreutils gnu-sed
}

function install_font() {
    brew tap homebrew/cask-fonts
    brew install --cask font-fira-code
}


function install_mac_app() {
    readonly apps=(amphetamine bartender enpass alacritty snippetslab eudic reeder dash karabiner manico vscode-insider)

    for app in "${apps[@]}"; do
        echo "try to install $app"
    done
}

function install_app() {
    brew tap cantino/mcfly
    readonly apps=(goland firefox google-chrome iterm2 starship fd bat stats hyperfine hexyl pastel exa peco tmux git-extras mcfly)
    for app in "${apps[@]}"; do
        if ! command -v $app &> /dev/null; then
            brew install --cask $app
        fi
    done
}

function preparse_oh_my_fish() {
    if [ -x "$(command -v omf)" ]; then
        curl -L https://get.oh-my.fish | fish
        omf install fzf
        omf install z
        omf install peco
        omf install foreign-env
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

    echo "Installing app"
    install_app

    echo "Installing font"
    install_font

    echo "Installing mac app"
    install_mac_app
}

main
