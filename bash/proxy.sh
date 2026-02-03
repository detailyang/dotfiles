#!/usr/bin/env bash

# Proxy management
# Sets HTTP/HTTPS proxy environment variables

function proxy() {
    export HTTPS_PROXY=http://127.0.0.1:7890
    export HTTP_PROXY=http://127.0.0.1:7890
    echo "Proxy enabled: $HTTP_PROXY"
}

function unproxy() {
    unset HTTP_PROXY
    unset HTTPS_PROXY
    unset http_proxy
    unset https_proxy
    echo "Proxy disabled"
}
