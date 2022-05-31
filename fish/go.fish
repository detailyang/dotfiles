set -xg GOPATH $HOME/go
export GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
export GO111MODULE=on
export PATH="$PATH:$(go env GOPATH)/bin"
