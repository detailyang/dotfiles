set -x PATH ~/bin $PATH
set -x PATH ~/cargo/bin $PATH
set -x PATH /usr/local/bin $PATH
set -x PATH ~/go/bin $PATH
set -x PATH ~/python/bin $PATH
set -x PATH ~/bash/bin $PATH
set -x PATH ~/node/bin $PATH
set -x PATH ~/java/bin $PATH
set -x PATH /usr/local/go/bin $PATH

if test -d ~/maven/bin
    set -x PATH ~/maven/bin $PATH
end

if test -d /usr/local/openresty/bin 
    set -x PATH /usr/local/openresty/bin $PATH
end

if test -d ~/.jenv/bin
    set -x PATH ~/.jenv/bin $PATH
end

if test -d ~/.gloo/bin
    set -x PATH ~/.gloo/bin $PATH
end
