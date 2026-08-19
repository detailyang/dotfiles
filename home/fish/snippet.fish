function s
    set -l snippet ""
    
    if test -x ~/bin/snippet
        set snippet ~/bin/snippet
    else if test -x ~/dotfiles/home/bin/snippet
        set snippet ~/dotfiles/home/bin/snippet
    else if test -x (dirname (status --current-filename))/../bin/snippet
        set snippet (dirname (status --current-filename))/../bin/snippet
    end

    if test -n "$snippet"
        $snippet $argv
    else
        echo "Warning: snippet not found"
    end
end
