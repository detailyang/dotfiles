#! /usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")"

git pull --ff origin master

rsync --exclude-from=./.exclude \
	-avh --no-perms . ~

source ~/.bash_profile

