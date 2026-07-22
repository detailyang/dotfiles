# Managed by the dotfiles repository.

if [[ "${__DOTFILES_BASHRC_LOADED:-}" == 1 ]]; then
    return 0
fi
__DOTFILES_BASHRC_LOADED=1

# Login and non-login shells share the same environment setup.
for file in "$HOME/bash/.path" "$HOME/bash/nix.sh"; do
    [[ -r "$file" && -f "$file" ]] && source "$file"
done

case ":$PATH:" in
    *":$HOME/bin:"*) ;;
    *) export PATH="$HOME/bin:$PATH" ;;
esac

# Initialize NVM so login shells use the configured default Node.js version.
export NVM_DIR="$HOME/.nvm"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    source "$NVM_DIR/nvm.sh"
fi

case $- in
    *i*) ;;
    *) return 0 ;;
esac

if command -v mise > /dev/null 2>&1; then
    eval "$(mise activate bash)"
fi

if type starship > /dev/null 2>&1; then
    eval "$(starship init bash)"
fi

if [[ -r "$HOME/bash/.aliases" && -f "$HOME/bash/.aliases" ]]; then
    source "$HOME/bash/.aliases"
fi

for file in "$HOME"/bash/{cscope,snippte,proxy,k8s,ssh,rpm}.sh; do
    [[ -r "$file" && -f "$file" ]] && source "$file"
done

bind 'set enable-bracketed-paste off'
