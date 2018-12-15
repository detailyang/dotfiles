function proxy -d "set proxy to socks5 1087"
	switch (uname)
	case Linux
		export HTTPS_PROXY=http://192.168.33.1:1087
		export HTTP_PROXY=http://192.168.33.1:1087
	case Darwin
		export HTTPS_PROXY=http://127.0.0.1:1087
		export HTTP_PROXY=http://127.0.0.1:1087
	case '*'
		export HTTPS_PROXY=http://127.0.0.1:1087
		export HTTP_PROXY=http://127.0.0.1:1087
	end
	export GOPROXY=https://goproxy.io
end

function unproxy -d "disable proxy to socks5 1087"
	export HTTPS_PROXY=
	export HTTP_PROXY=
	export GOPROXY=
end
