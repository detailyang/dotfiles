function proxy -d "set proxy to socks5 7890"
	set -x interface $argv[1]
    if test "$interface" = "" 
		# My virtualbox host ip
    	set ip "192.168.33.1" 
    else
        set ip (ifconfig $interface |grep "inet " |awk '{print $2}')
    end

    echo "socks5: $ip:7890 interface:$interface"
	export HTTPS_PROXY=http://$ip:7890
	export HTTP_PROXY=http://$ip:7890
	export https_proxy=http://$ip:7890
	export http_proxy=http://$ip:7890
	export ALL_PROXY=http://$ip:7890
	export all_proxy=http://$ip:7890
	export SOCKS_PROXY=http://$ip:7890
	export socks_proxy=http://$ip:7890
    set -x no_proxy_192 (seq -f"192.168.44.%g" -s"," 0 40)
    set -x no_proxy_192_168 (seq -f"192.168.0.%g" -s"," 0 254)
    export NO_PROXY="127.0.0.1,localhost,$no_proxy_192,$no_proxy_192_168"
    export no_proxy="127.0.0.1,localhost,$no_proxy_192,$no_proxy_192_168"
	echo "HTTP_PROXY:$HTTP_PROXY"
	echo "HTTPS_PROXY:$HTTPS_PROXY"
	echo "ALL_PROXY:$HTTPS_PROXY"
	echo "SOCKS_PROXY:$SOCKS_PROXY"
end

function unproxy -d "disable proxy to socks5 7890"
	export HTTPS_PROXY=
	export HTTP_PROXY=
	export https_proxy=
	export http_proxy=
	export ALL_PROXY=
	export all_proxy=
	export GOPROXY=
    export NO_PROXY=
    export no_proxy=
end

function autoproxy -d "set proxy from system config"
	set --local httpport (scutil --proxy | awk '/HTTPPort/{print $3}')
	set --local httpproxy (scutil --proxy | awk '/HTTPProxy/{print $3}')
	set --local httpsport (scutil --proxy | awk '/HTTPSPort/{print $3}')
	set --local httpsproxy (scutil --proxy | awk '/HTTPSProxy/{print $3}')
	set --local socksport (scutil --proxy | awk '/SOCKSPort/{print $3}')
	set --local socksproxy (scutil --proxy | awk '/SOCKSProxy/{print $3}')
	export HTTP_PROXY="http://$httpproxy:$httpport"
	export HTTPS_PROXY="http://$httpsproxy:$httpsport"
	export SOCKS_PROXY="$socksproxy:$socksport"
	export ALL_PROXY="http://$socksproxy:$socksport"
	export http_proxy="http://$httpproxy:$httpport"
	export https_proxy="http://$httpsproxy:$httpsport"
	export socks_proxy="$socksproxy:$socksport"
	export ALL_PROXY="http://$socksproxy:$socksport"
	export all_proxy="http://$socksproxy:$socksport"
    set -x no_proxy_192 (seq -f"192.168.44.%g" -s"," 0 40)
    set -x no_proxy_192_168 (seq -f"192.168.0.%g" -s"," 0 254)
    export NO_PROXY="127.0.0.1,localhost,$no_proxy_192,$no_proxy_192_168"
    export no_proxy="127.0.0.1,localhost,$no_proxy_192,$no_proxy_192_168"
	echo "HTTP_PROXY:$HTTP_PROXY"
	echo "HTTPS_PROXY:$HTTPS_PROXY"
	echo "SOCKS_PROXY:$SOCKS_PROXY"
	echo "NO_PROXY:$NO_PROXY"
end

function wslproxy -d "set proxy in wsl env"
    #set hostip (cat /etc/resolv.conf | grep nameserver | awk '{ print $2 }')
    set hostip 127.0.0.1
	export HTTP_PROXY="http://$hostip:7890"
	export HTTPS_PROXY="http://$hostip:7890"
	export http_proxy="http://$hostip:7890"
	export https_proxy="http://$hostip:7890"
	export SOCKS_PROXY="$hostip:7890"
	export socks_proxy="$hostip:7890"
	export ALL_PROXY="http://$hostip:7890"
	export all_proxy="http://$hostip:7890"
	echo "HTTP_PROXY:$HTTP_PROXY"
	echo "HTTPS_PROXY:$HTTPS_PROXY"
	echo "SOCKS_PROXY:$SOCKS_PROXY"
	echo "ALL_PROXY:$SOCKS_PROXY"
end
