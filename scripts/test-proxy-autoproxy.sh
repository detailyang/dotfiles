#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

readonly PROXY_ENV="$PWD/bin/proxy-env"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

cat > "$temp_dir/gsettings" <<'EOF'
#!/usr/bin/env bash

if [[ "$1" != "get" ]]; then
    exit 1
fi

case "$2:$3" in
    org.gnome.system.proxy:mode)
        printf "'%s'\n" "${FAKE_GSETTINGS_MODE:-manual}"
        ;;
    org.gnome.system.proxy:use-same-proxy)
        printf 'false\n'
        ;;
    org.gnome.system.proxy.http:host)
        printf "'127.0.0.1'\n"
        ;;
    org.gnome.system.proxy.http:port)
        printf '8080\n'
        ;;
    org.gnome.system.proxy.https:host)
        printf "'127.0.0.1'\n"
        ;;
    org.gnome.system.proxy.https:port)
        printf '8443\n'
        ;;
    org.gnome.system.proxy.socks:host)
        printf "'127.0.0.1'\n"
        ;;
    org.gnome.system.proxy.socks:port)
        printf '1080\n'
        ;;
    org.gnome.system.proxy:autoconfig-url)
        printf "'https://proxy.example/proxy.pac'\n"
        ;;
    *)
        exit 1
        ;;
esac
EOF
chmod +x "$temp_dir/gsettings"

cat > "$temp_dir/uname" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "${FAKE_UNAME:-Linux}"
EOF
chmod +x "$temp_dir/uname"

cat > "$temp_dir/scutil" <<'EOF'
#!/usr/bin/env bash
cat <<'PROXIES'
<dictionary> {
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSPort : 7891
  HTTPSProxy : 127.0.0.1
  SOCKSPort : 7892
  SOCKSProxy : 127.0.0.1
}
PROXIES
EOF
chmod +x "$temp_dir/scutil"

clear_proxy_env=(
    -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u SOCKS_PROXY -u NO_PROXY
    -u http_proxy -u https_proxy -u all_proxy -u socks_proxy -u no_proxy
)

manual_output="$(env "${clear_proxy_env[@]}" \
    PATH="$temp_dir:/usr/bin:/bin" \
    XDG_CURRENT_DESKTOP=GNOME \
    FAKE_GSETTINGS_MODE=manual \
    "$PROXY_ENV" bash autoproxy)"
[[ "$manual_output" == *'export HTTP_PROXY=http://127.0.0.1:8080'* ]]
[[ "$manual_output" == *'export HTTPS_PROXY=http://127.0.0.1:8443'* ]]
[[ "$manual_output" == *'export ALL_PROXY=socks5://127.0.0.1:1080'* ]]
[[ "$manual_output" == *'export SOCKS_PROXY=socks5://127.0.0.1:1080'* ]]

macos_output="$(env "${clear_proxy_env[@]}" \
    PATH="$temp_dir:/usr/bin:/bin" \
    FAKE_UNAME=Darwin \
    "$PROXY_ENV" bash autoproxy)"
[[ "$macos_output" == *'export HTTP_PROXY=http://127.0.0.1:7890'* ]]
[[ "$macos_output" == *'export HTTPS_PROXY=http://127.0.0.1:7891'* ]]

none_output="$(env "${clear_proxy_env[@]}" \
    PATH="$temp_dir:/usr/bin:/bin" \
    XDG_CURRENT_DESKTOP=GNOME \
    FAKE_GSETTINGS_MODE=none \
    "$PROXY_ENV" bash autoproxy)"
[[ "$none_output" == *'unset HTTP_PROXY'* ]]
[[ "$none_output" == *'echo Proxy\ disabled'* ]]

headless_output="$(env "${clear_proxy_env[@]}" \
    PATH="$temp_dir:/usr/bin:/bin" \
    FAKE_UNAME=Linux \
    XDG_CURRENT_DESKTOP= \
    DESKTOP_SESSION= \
    HTTP_PROXY=http://10.0.0.2:3128 \
    HTTPS_PROXY=http://10.0.0.2:3129 \
    ALL_PROXY=socks5://10.0.0.2:1080 \
    NO_PROXY=localhost,127.0.0.1 \
    "$PROXY_ENV" fish autoproxy)"
[[ "$headless_output" == *"set -gx HTTP_PROXY 'http://10.0.0.2:3128'"* ]]
[[ "$headless_output" == *"set -gx ALL_PROXY 'socks5://10.0.0.2:1080'"* ]]
[[ "$headless_output" == *"set -gx NO_PROXY 'localhost,127.0.0.1'"* ]]

pac_error="$temp_dir/pac-error"
if env "${clear_proxy_env[@]}" \
    PATH="$temp_dir:/usr/bin:/bin" \
    XDG_CURRENT_DESKTOP=GNOME \
    FAKE_GSETTINGS_MODE=auto \
    "$PROXY_ENV" bash autoproxy > /dev/null 2> "$pac_error"; then
    echo "GNOME PAC mode unexpectedly succeeded" >&2
    exit 1
fi
grep -Fq 'PAC proxy configuration cannot be converted to static proxy variables' "$pac_error"
