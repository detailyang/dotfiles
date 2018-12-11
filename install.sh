#! /usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

git pull --ff origin master

rsync --exclude-from=./.exclude \
	-avh --no-perms . ~

rsync -avh --no-perms  vscode/ ~/Library/Application\ Support/Code/User/

source ~/.bash_profile

mkdir -p ~/art/{opensource,personal}

if [[ $(uname) == "Darwin" ]]; then
    echo "Disable OSX avoiding the vscode PressAndHoldEnabled"
    defaults write com.microsoft.VSCode ApplePressAndHoldEnabled -bool false
fi
