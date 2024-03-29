function disable_nix
    export NIX_DISABLE=1
    fish
end

if [ "$NIX_DISABLE" = "1" ]
    echo "Disable NIX Variable"
else
    export NIX_PATH="nixpkgs=/nix/var/nix/profiles/per-user/root/channels/nixpkgs:/nix/var/nix/profiles/per-user/root/channels:$HOME/.nix-defexpr/channels"
    export PATH="$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"

    if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
        bass source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
    end
end


