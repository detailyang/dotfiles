set -l paths_to_add \
    ~/bin \
    ~/cargo/bin \
    /usr/local/bin \
    ~/go/bin \
    ~/python/bin \
    ~/bash/bin \
    ~/node/bin \
    ~/java/bin \
    /usr/local/go/bin \
    ~/maven/bin \
    /usr/local/openresty/bin \
    ~/.jenv/bin \
    ~/.gloo/bin \
    ~/.fluvio/bin \
    ~/.opencode/bin \
    ~/.bun/bin

for p in $paths_to_add
    if test -d $p
        set -x PATH $p $PATH
    end
end
