function fish_user_key_bindings
    if not functions -q fzf_key_bindings
        if test -f /opt/homebrew/opt/fzf/shell/key-bindings.fish
            source /opt/homebrew/opt/fzf/shell/key-bindings.fish
        end
    end

    if functions -q fzf_key_bindings
        fzf_key_bindings
    end
end

