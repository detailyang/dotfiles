function fish_user_key_bindings
    if not command -q fzf
        return
    end

    if not functions -q fzf_key_bindings
        fzf --fish | source
    end

    fzf_key_bindings
end
