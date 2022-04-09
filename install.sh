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
    if test -d ~/.local/share/omf/; then
        echo "omf was installed"
    else
        curl -L https://get.oh-my.fish | fish
    fi

    readonly plugins=(fzf peco "foreign-env" bass)
    for plugin in "${plugins[@]}"; do
        if test -d ~/.local/share/omf/pkg/$plugin; then
            echo "omf plugin $plugin was installed"
        else
            fish -c "omf install $plugin"
        fi
    done
}

function prepare_dirs() {
    mkdir -p ~/art/{github,opensource,personal}
}

function rsync_dirs() {
    rsync --exclude-from=./.exclude \
        -avh --no-perms . ~ &> /dev/null
}

function git_pull() {
    git pull --ff origin master &> /dev/null
}

function prepare_home_manager() {
      # sh <(curl https://mirrors.tuna.tsinghua.edu.cn/nix/latest/install) --daemon
      if command -v nix-channel &> /dev/null ; then
          if nix-channel --list |grep -q home-manager &> /dev/null; then
              echo "home-manager was installed"
          else
              nix-channel --add https://github.com/nix-community/home-manager/archive/master.tar.gz home-manager
              nix-channel --update
              # nix-shell '<home-manager>' -A install 
          fi
      fi
}

function main() {
    echo "Pulling the lastest changes"
    git_pull

    echo "Rsyncing to target"
    rsync_dirs

    #echo "Sourcing bash profile"
    #source ~/.bash_profile

    echo "Preparing directory"
    prepare_dirs

    echo "Preparing oh my fish"
    preparse_oh_my_fish

    echo "Installing mac app"
#    install_mac_app

    echo "Installing home-manager"
    prepare_home_manager
}

main
