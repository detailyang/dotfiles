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
        echo "✓ proxychains4 already installed"
    else
        echo "Installing proxychains-ng..."
        if brew install --build-from-source proxychains-ng; then
            echo "✓ proxychains-ng installed"
        else
            echo "WARNING: Failed to install proxychains-ng"
        fi
    fi

    readonly apps=(fish brightness)
    for app in "${apps[@]}"; do
        if command -v $app &> /dev/null; then
            echo "✓ $app already installed"
        else
            echo "Installing $app..."
            if brew install $app; then
                echo "✓ $app installed"
            else
                echo "WARNING: Failed to install $app"
            fi
        fi
    done

    readonly guiapps=(openinterminal monitorcontrol)
    for app in "${guiapps[@]}"; do
        if brew list --cask | grep -q "^$app$"; then
            echo "✓ $app already installed"
        else
            echo "Installing $app..."
            if brew install --cask $app; then
                echo "✓ $app installed"
            else
                echo "WARNING: Failed to install $app"
            fi
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

    defaults write -g KeyRepeat -int 2

    defaults write -g InitialKeyRepeat -int 15

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

function pre_flight_checks() {
    echo "Running pre-flight checks..."

    local available_space=$(df -BM ~ | awk 'NR==2 {print $4}' | sed 's/M//')
    if [[ $available_space -lt 100 ]]; then
        echo "ERROR: Insufficient disk space. Need at least 100MB, available: ${available_space}MB"
        exit 1
    fi
    echo "✓ Disk space OK (${available_space}MB available)"

    if ! command -v git &> /dev/null; then
        echo "ERROR: git is not installed. Please install git first."
        exit 1
    fi
    echo "✓ git installed"

    if [[ ! -w "$HOME" ]]; then
        echo "ERROR: No write permission to home directory"
        exit 1
    fi
    echo "✓ Home directory writable"

    echo "All pre-flight checks passed."
}

function create_backup() {
    local backup_dir="$HOME/.dotfiles-backup-$(date +%Y%m%d_%H%M%S)"

    echo "Creating backup at $backup_dir..."

    mkdir -p "$backup_dir"

    local files_to_backup=(
        "$HOME/.bash_profile"
        "$HOME/.zshrc"
        "$HOME/.config/fish"
        "$HOME/.config/wezterm"
    )

    for file in "${files_to_backup[@]}"; do
        if [[ -e "$file" ]]; then
            echo "  Backing up: $file"
            cp -a "$file" "$backup_dir/"
        fi
    done

    echo "✓ Backup created at $backup_dir"
    echo "  To restore: cp -r $backup_dir/* ~/"
}

function rsync_dirs() {
    local dry_run="$1"

    if [[ "$dry_run" == true ]]; then
        echo "DRY RUN: Would deploy these files:"
        rsync --exclude-from=./.exclude \
            -avh --no-perms --dry-run . ~ | grep -v "sending incremental file list" | grep -v "^$"
    else
        echo "Deploying configs..."
        if rsync --exclude-from=./.exclude \
            -avh --no-perms . ~; then
            echo "✓ Configs deployed successfully"
        else
            echo "ERROR: rsync failed with exit code $?"
            echo "Please check permissions and disk space"
            exit 1
        fi
    fi
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
    local dry_run=false

    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            --no-pull) no_pull=true ;;
            --dry-run) dry_run=true ;;
            *) echo "Unknown parameter passed: $1"; echo "Usage: $0 [--no-pull] [--dry-run]"; exit 1 ;;
        esac
        shift
    done

if [[ "$no_pull" == false ]]; then
    	echo "Pulling latest changes"
        git_pull
    else
        echo "Skipping git pull"
    fi

    pre_flight_checks

    if [[ "$dry_run" == false ]]; then
        create_backup
    fi

    echo "Rsyncing to target"
    rsync_dirs "$dry_run"

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
