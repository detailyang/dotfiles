function s
    export SHELL=/bin/bash
    fd . "$HOME/snippet" --type f | fzf  --preview='bat --color always {}'
end
