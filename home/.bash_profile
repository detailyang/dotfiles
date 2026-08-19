# Login shells use the same managed configuration as interactive Bash shells.
if [[ -r "$HOME/.bashrc" && -f "$HOME/.bashrc" ]]; then
    source "$HOME/.bashrc"
fi
