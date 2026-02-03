# Initialize starship prompt if available
if type starship > /dev/null 2>&1; then
    eval "$(starship init bash)"
fi

# Source core bash configurations
for file in ~/.bash/.{path,aliases}; do
    [ -r "$file" ] && [ -f "$file" ] && source "$file"
done

# Source modular functions
for file in ~/bash/{cscope,snippte,proxy,k8s,ssh,rpm,nix,nix-common}.sh; do
    [ -r "$file" ] && [ -f "$file" ] && source "$file"
done


# Nix package manager (if available)
if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
  if [ -n "${PATH##*.nix-profile/bin*}" ]; then
    unset __ETC_PROFILE_NIX_SOURCED
    . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
  fi
fi

# Ensure ~/bin is in PATH
export PATH="$HOME/bin:$PATH"

# Disable bracketed paste mode
bind 'set enable-bracketed-paste off'
