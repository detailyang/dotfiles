if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh; then
    source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
fi

if test -f ~/bash/nix-common.sh; then
    source ~/bash/nix-common.sh
elif test -f ~/dotfiles/bash/nix-common.sh; then
    source ~/dotfiles/bash/nix-common.sh
elif test -f $(dirname "${BASH_SOURCE}")/../bash/nix-common.sh; then
    source $(dirname "${BASH_SOURCE}")/../bash/nix-common.sh
else
    echo "Warning: nix-common.sh not found"
fi
