function s
    set -l snippte ""
    
    if test -x ~/bin/snippte
        set snippte ~/bin/snippte
    else if test -x ~/dotfiles/bin/snippte
        set snippte ~/dotfiles/bin/snippte
    else if test -x (dirname (status --current-filename))/../bin/snippte
        set snippte (dirname (status --current-filename))/../bin/snippte
    end

    if test -n "$snippte"
        $snippte $argv
    else
        echo "Warning: snippte not found"
    end
end
