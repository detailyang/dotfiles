#!/usr/bin/env fish

if test -d ~/.work
    for file in ~/.work/*.fish
        if test -f "$file"
            source "$file"
        end
    end
end
