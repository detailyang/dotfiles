for file in ~/.bash/.{path,bash_prompt,exports,aliases,functions,extra}; do
	[ -r "$file" ] && [ -f "$file" ] && source "$file";
done;

for file in ~/bash/.{path,bash_prompt,exports,aliases,functions,extra}; do
	[ -r "$file" ] && [ -f "$file" ] && source "$file";
done;

for file in ~/bash/*.sh; do
    source $file
done

if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
  # if PATH does *not* contain `~/.nix-profile/bin`
  if [ -n "${PATH##*.nix-profile/bin*}" ]; then

    # If this flag is set, `nix-daemon.sh` returns early
    # https://github.com/NixOS/nix/issues/5298
    unset __ETC_PROFILE_NIX_SOURCED
    . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
  fi
fi

export PATH="$HOME/bin:$PATH";

