function disable_nix
    export NIX_DISABLE=1
    fish
end

if [ "$NIX_DISABLE" = "1" ]
    echo "Disable NIX Variable"
else
    bass source ~/dotfiles/bash/nix-common.sh

    if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
        bass source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
    end
end


