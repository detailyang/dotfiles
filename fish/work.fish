#!/usr/bin/env fish

for file in (command ls ~/.work)
    source ~/.work/$file
end
