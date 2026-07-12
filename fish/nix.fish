function disable_nix
    export NIX_DISABLE=1
    fish
end

if [ "$NIX_DISABLE" = "1" ]
    echo "Disable NIX Variable"
else
    if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
        source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
    end
end

