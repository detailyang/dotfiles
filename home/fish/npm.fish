if test -d $HOME/Library/pnpm
    set -x PATH $HOME/Library/pnpm $PATH
end

set -gx NVM_DIR "$HOME/.nvm"
if test -s "$NVM_DIR/nvm.sh"
    if type -q bash
        set -l nvm_node (env NVM_DIR="$NVM_DIR" bash --noprofile --norc -c '. "$NVM_DIR/nvm.sh" --no-use; nvm which default' 2>/dev/null)
        if test -x "$nvm_node"
            set -l nvm_bin (command dirname "$nvm_node")
            if not contains "$nvm_bin" $PATH
                set -gx PATH "$nvm_bin" $PATH
            end
        end
    end
end
