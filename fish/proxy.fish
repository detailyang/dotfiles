function proxy -d "set proxy to socks5 1087"
	export HTTPS_PROXY=http://127.0.0.1:1087
	export HTTP_PROXY=http://127.0.0.1:1087
	export GOPROXY=https://goproxy.io
end

function unproxy -d "disable proxy to socks5 1087"
	export HTTPS_PROXY=
	export HTTP_PROXY=
	export GOPROXY=
end
