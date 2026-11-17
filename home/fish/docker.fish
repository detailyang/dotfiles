
function docker-clean
    set -l docker_clean ""
    
    if test -f ~/snippet/docker/clean
        set docker_clean ~/snippet/docker/clean
    else if test -f (dirname (status --current-filename))/../snippet/docker/clean
        set docker_clean (dirname (status --current-filename))/../snippet/docker/clean
    end

    if test -n "$docker_clean"
        sh "$docker_clean"
    else
        echo "Warning: snippet/docker/clean not found"
    end
end

