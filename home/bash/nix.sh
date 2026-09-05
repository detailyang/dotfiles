# Let the installed Nix profile own its environment; this repository uses Flakes.
for nix_profile in \
    /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh \
    "$HOME/.nix-profile/etc/profile.d/nix.sh"
do
    if test -f "$nix_profile" && test -r "$nix_profile"; then
        source "$nix_profile" || return $?
        break
    fi
done
unset nix_profile
