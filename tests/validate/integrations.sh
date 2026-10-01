check "herdr resolves Fish from PATH" "grep -q '^default_shell = \"fish\"$' home/.config/herdr/config.toml"
check "Fish launchers avoid platform-specific paths" "! grep -Eq '/opt/homebrew/bin/fish|/usr/local/bin/fish' bootstrap.sh installer/*.sh home/.config/herdr/config.toml"
check "herdr starts fish as a login shell" "grep -q '^shell_mode = \"login\"$' home/.config/herdr/config.toml"

check "proxy-env is the executable proxy env module" "test -x home/bin/proxy-env"
check "proxy-env bash adapter output sets the default proxy endpoint" "[[ \"\$(./home/bin/proxy-env bash proxy)\" == *'export HTTP_PROXY=http://192.168.33.1:7890'* ]]"
check "proxy-env fish adapter output sets the default proxy endpoint" "[[ \"\$(./home/bin/proxy-env fish proxy)\" == *\"set -gx HTTP_PROXY 'http://192.168.33.1:7890'\"* ]]"
check "proxy-env keeps NO_PROXY rules local to the deep module" "bash --noprofile --norc -c 'eval \"\$(./home/bin/proxy-env bash proxy)\" >/dev/null; [[ \"\$NO_PROXY\" == 127.0.0.1,localhost,192.168.44.0* ]]'"
check "proxy-env exposes WSL host mode consistently" "[[ \"\$(./home/bin/proxy-env bash wslproxy)\" == *'export HTTP_PROXY=http://127.0.0.1:7890'* ]]"
check "proxy-env clears every proxy spelling plus GOPROXY" "[[ \"\$(./home/bin/proxy-env bash unproxy)\" == *'unset GOPROXY'* ]]"
check "autoproxy supports Linux desktop, environment, and local proxy sources" "bash tests/test-proxy-autoproxy.sh"

check "Bash proxy adapter applies, clears and rejects failed output in isolation" "python3 -B tests/test-shell-startup.py ProxyAdapterTests.test_bash"
check_if_available fish "Fish proxy adapter applies, clears and rejects failed output in isolation" "python3 -B tests/test-shell-startup.py ProxyAdapterTests.test_fish"

check "bash proxy adapter does not own proxy rules" "! grep -q 'export HTTP_PROXY=' home/bash/proxy.sh"
check "fish proxy adapter does not own proxy rules" "! grep -q 'set -gx HTTP_PROXY\|export HTTP_PROXY=' home/fish/proxy.fish"
