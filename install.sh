#! /usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

function install_mac_app() {
    # defaults write -g applepressandholdenabled -bool false

    readonly apps=(Proxifier shottr Hovrly amphetamine bartender enpass snippetslab karabiner itsycal paper hammersppon lulu SwitchHosts kap PicGo)

    for app in "${apps[@]}"; do
        echo "try to install $app"
    done
}

function install_brew_app() {
    os="$(uname -s)"
    if [[ "$os" != "Darwin" ]]; then
        return 0;
    fi

    if command -v proxychains4 &> /dev/null; then
        echo "proxychains4 was installed."
    else
        brew install --build-from-source proxychains-ng
    fi

    readonly apps=(fish)
    for app in "${apps[@]}"; do
        if command -v fish &> /dev/null; then
            echo "$app(brew) was installed."
        else
            brew install $app
        fi
    done
}

function prepare_init_darwin() {
    os="$(uname -s)"
    if [[ "$os" != "Darwin" ]]; then
        return 0;
    fi

    # take screenshots as jpg (usually smaller size) and not png
    defaults write com.apple.screencapture type jpg

    # do not open previous previewed files (e.g. PDFs) when opening a new one
    defaults write com.apple.Preview ApplePersistenceIgnoreState YES

    # show Library folder
    chflags nohidden ~/Library

    # show hidden files
    defaults write com.apple.finder AppleShowAllFiles YES

    # show path bar
    defaults write com.apple.finder ShowPathbar -bool true

    # show status bar
    defaults write com.apple.finder ShowStatusBar -bool true

    # allow hold keyboard
    defaults write -g ApplePressAndHoldEnabled -bool false 2>&1 &> /dev/null

    defaults write com.microsoft.VSCodeInsiders ApplePressAndHoldEnabled -bool false

    defaults write -g AppleFontSmoothing -int 1

    defaults write -g KeyRepeat -int 3

    defaults write -g InitialKeyRepeat -int 5

    killall Finder;
}

function prepare_oh_my_zsh() {
    os="$(uname -s)"
    if [[ "$os" != "Darwin" ]]; then
        return 0;
    fi

    if test -d ~/.oh-my-zsh/; then
        echo "omz was installed"
    else
        sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
    fi

}

function prepare_oh_my_fish() {
    os="$(uname -s)"
    if [[ "$os" != "Darwin" ]]; then
        return 0;
    fi

    if command -v fish &> /dev/null; then
        echo "Fish shell was installed."
    else
        echo "Fish shell is not installed."
        exit 0
    fi
    
    if test -d ~/.local/share/omf/; then
        echo "omf was installed"
    else
        curl https://raw.githubusercontent.com/oh-my-fish/oh-my-fish/master/bin/install | fish
    fi

    readonly plugins=(nvm fzf peco "foreign-env" bass)
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
    os="$(uname -s)"
    if [[ "$os" != "Darwin" ]]; then
        return 0;
    fi

      # sh <(curl https://mirrors.tuna.tsinghua.edu.cn/nix/latest/install) --daemon
      if command -v nix-channel &> /dev/null ; then
          if nix-channel --list |grep -q home-manager &> /dev/null; then
              echo "home-manager was installed"
          else
              nix-channel --add https://github.com/nix-community/home-manager/archive/master.tar.gz home-manager
              nix-channel --update
              # nix-shell '<home-manager>' -A install 
          fi

          if nix-channel --list |grep -q  nixpkgs-unstable &> /dev/null; then
              echo "add nixpkgs-unstable to channel"
              nix-channel --add https://mirrors.ustc.edu.cn/nix-channels/nixpkgs-unstable nixpkgs-unstable
          fi
      fi
}

function main() {
    local no_pull=false

    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            --no-pull) no_pull=true ;;
            *) echo "Unknown parameter passed: $1"; exit 1 ;;
        esac
        shift
    done

    if [[ "$no_pull" == false ]]; then
    	echo "Pulling the latest changes"
        git_pull
    else
        echo "Skipping git pull"
    fi

    echo "Rsyncing to target"
    rsync_dirs

    #echo "Sourcing bash profile"
    #source ~/.bash_profile

    echo "Preparing init darwin"
    prepare_init_darwin

    echo "Preparing directory"
    prepare_dirs

    echo "Preparing oh my zsh"
    prepare_oh_my_zsh

    echo "Preparing oh my fish"
    prepare_oh_my_fish

    echo "Installing mac app"
#    install_mac_app
    install_brew_app

    echo "Installing home-manager"
    prepare_home_manager
}

main "$@"
