# Proxy env shell adapter. Shared proxy rules live in bin/proxy-env.

function __proxy_env_cmd
    set -l repo_root (dirname (status --current-filename))/..
    set -l candidates \
        ~/bin/proxy-env \
        ~/dotfiles/bin/proxy-env \
        $repo_root/bin/proxy-env

    for candidate in $candidates
        if test -x $candidate
            echo $candidate
            return 0
        end
    end

    echo "Warning: proxy-env not found" >&2
    return 1
end

function __proxy_env_eval
    set -l mode $argv[1]
    set -e argv[1]

    set -l cmd (__proxy_env_cmd); or return 1
    set -l output ($cmd fish $mode $argv)
    set -l code $status

    if test $code -ne 0
        return $code
    end

    set -l script (string join '; ' $output)
    eval "$script"
end

function proxy -d "set proxy to socks5 7890"
    __proxy_env_eval proxy $argv
end

function p -d "run pi through local HTTP proxy"
	env HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 pi $argv
end

function unproxy -d "disable proxy to socks5 7890"
    __proxy_env_eval unproxy
end

function autoproxy -d "set proxy from system config"
    __proxy_env_eval autoproxy
end

function wslproxy -d "set proxy in wsl env"
    __proxy_env_eval wslproxy
end
