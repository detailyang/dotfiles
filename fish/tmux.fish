function tmux
    if test (count $argv) -eq 0
        command tmux new-session -c (pwd)
    else
        command tmux $argv
    end
end
