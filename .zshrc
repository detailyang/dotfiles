if [[ ! -o interactive ]]; then
    return
fi

if [[ -d "$HOME/.local/bin" ]]; then
    export PATH="$HOME/.local/bin:$PATH"
fi

if [[ -d "$HOME/go/bin" ]]; then
    export PATH="$HOME/go/bin:$PATH"
fi

if command -v mise > /dev/null 2>&1; then
    eval "$(mise activate zsh)"
fi

if command -v "starship" > /dev/null; then
    eval "$(starship init zsh)"
fi
ZSH_CUSTOM=~/.oh-my-zsh/custom/
plugins=(
        zsh-z
        zsh-syntax-highlighting
        zsh-autosuggestion
)
ZSH_THEME="avit"
HIST_STAMPS="yyyy-mm-dd"
