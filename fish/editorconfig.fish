function ec
    set DIR (cd (dirname (status -f)); and pwd) 
    cat $DIR/editorconfig
end
