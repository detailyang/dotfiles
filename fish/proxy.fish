function proxy -d "set proxy to socks5 1087"
	set -x interface $argv[1]
    if test "$interface" = "" 
		# My virtualbox host ip
    	set ip "192.168.33.1" 
    else
        set ip (ifconfig $interface |grep "inet " |awk '{print $2}')
    end

    echo "socks5: $ip:1087 interface:$interface"
	export HTTPS_PROXY=http://$ip:1087
	export HTTP_PROXY=http://$ip:1087
	export GOPROXY=https://goproxy.cn
    export NOPROXY="127.0.0.1,192.168.64.11"
end

function unproxy -d "disable proxy to socks5 1087"
	export HTTPS_PROXY=
	export HTTP_PROXY=
	export GOPROXY=
    export NOPROXY=
end
