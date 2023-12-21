function s
    fd . "$HOME/snippet" --type f | fzf  --preview='bat --color always {}'
end
