if test -d $HOME/.wasmer/bin
    set -x WASMER_DIR "$HOME/.wasmer"
    set -x WASMER_CACHE_DIR "$WASMER_DIR/cache"
    set -x PATH $HOME/.wasmer/bin $PATH
    if test -d $WASMER_DIR/globals/wapm_packages/.bin
        set -x PATH $WASMER_DIR/globals/wapm_packages/.bin $PATH
    end
end

