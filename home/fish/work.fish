#!/usr/bin/env fish

if test -d ~/.work
    for file in (command ls ~/.work/*.fish)
        source $file
    end
end
