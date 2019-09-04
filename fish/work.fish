#!/usr/bin/env fish

for file in (command ls ~/.work/*.fish)
    source $file
end
