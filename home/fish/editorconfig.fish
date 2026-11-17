function ec
    set -l dir (dirname (status -f))
    cat "$dir/editorconfig"
end
