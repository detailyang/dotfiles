if type "starsship" > /dev/null; then
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
