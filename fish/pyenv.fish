if command -v pyenv &> /dev/null
    set -Ux PYENV_ROOT $HOME/.pyenv
    fish_add_path $PYENV_ROOT/bin
    #pyenv init is slow
    #pyenv init - | source
else
    
end

