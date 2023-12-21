alias ls="lsd -l"

if test (uname) = "Linux"
    alias pbcopy 'xsel --clipboard --input'
    alias pbpaste 'xsel --clipboard --output'
end