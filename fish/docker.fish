
function docker-clean
    set -l docker_clean ""
    
    if test -x ~/snippet/docker/clean
        set docker_clean ~/snippet/docker/clean
    else if test -x ~/dotfiles/snippet/docker/clean
        set docker_clean ~/dotfiles/snippet/docker/clean
    else if test -x (dirname (status --current-filename))/../snippet/docker/clean
        set docker_clean (dirname (status --current-filename))/../snippet/docker/clean
    end

    if test -n "$docker_clean"
        $docker_clean
    else
        echo "Warning: snippet/docker/clean not found"
    end
end

