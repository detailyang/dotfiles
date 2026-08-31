#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

fish_bin="$(command -v fish)"

expected=$'\033]52;c;cmVtb3RlIGNsaXBib2FyZA==\a'
for remote_env in \
    'HERDR_ENV=1' \
    'SSH_CONNECTION=192.0.2.10 12345 192.0.2.20 22'
do
    actual="$(env \
        -u HERDR_ENV \
        -u SSH_CONNECTION \
        -u SSH_TTY \
        "$remote_env" \
        "$fish_bin" --no-config -c "source home/fish/clipboard.fish; printf 'remote clipboard' | pbcopy")"
    [[ "$actual" == "$expected" ]]
done

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

cat > "$temp_dir/uname" <<'EOF'
#!/bin/sh
printf '%s\n' "${FAKE_UNAME:-Linux}"
EOF

cat > "$temp_dir/xsel" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" > "$TEST_CLIPBOARD_ARGS"
/bin/cat > "$TEST_CLIPBOARD_OUTPUT"
EOF

cat > "$temp_dir/pbcopy" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" > "$TEST_CLIPBOARD_ARGS"
/bin/cat > "$TEST_CLIPBOARD_OUTPUT"
EOF

chmod +x "$temp_dir/uname" "$temp_dir/xsel" "$temp_dir/pbcopy"

env \
    -u HERDR_ENV \
    -u SSH_CONNECTION \
    -u SSH_TTY \
    PATH="$temp_dir" \
    TEST_CLIPBOARD_ARGS="$temp_dir/xsel.args" \
    TEST_CLIPBOARD_OUTPUT="$temp_dir/xsel.output" \
    "$fish_bin" --no-config -c "source home/fish/clipboard.fish; printf 'desktop clipboard' | pbcopy"

[[ "$(< "$temp_dir/xsel.args")" == '--clipboard --input' ]]
[[ "$(< "$temp_dir/xsel.output")" == 'desktop clipboard' ]]

env \
    -u HERDR_ENV \
    -u SSH_CONNECTION \
    -u SSH_TTY \
    PATH="$temp_dir" \
    FAKE_UNAME=Darwin \
    TEST_CLIPBOARD_ARGS="$temp_dir/pbcopy.args" \
    TEST_CLIPBOARD_OUTPUT="$temp_dir/pbcopy.output" \
    "$fish_bin" --no-config -c "source home/fish/clipboard.fish; printf 'macOS clipboard' | pbcopy"

[[ "$(< "$temp_dir/pbcopy.args")" == '' ]]
[[ "$(< "$temp_dir/pbcopy.output")" == 'macOS clipboard' ]]
