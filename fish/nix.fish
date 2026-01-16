function disable_nix
    export NIX_DISABLE=1
    fish
end

if [ "$NIX_DISABLE" = "1" ]
    echo "Disable NIX Variable"
else
    set -l nix_common ""

    if test -f ~/bash/nix-common.sh
        set nix_common ~/bash/nix-common.sh
    else if test -f ~/dotfiles/bash/nix-common.sh
        set nix_common ~/dotfiles/bash/nix-common.sh
    else if test -f (dirname (status --current-filename))/../bash/nix-common.sh
        set nix_common (dirname (status --current-filename))/../bash/nix-common.sh
    end

    if test -n "$nix_common"
        bass source $nix_common
    else
        echo "Warning: nix-common.sh not found"
    end

    if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
        bass source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
    end
end


