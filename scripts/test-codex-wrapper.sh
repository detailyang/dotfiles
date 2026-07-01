#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
wrapper="$repo_root/bin/codex"

tmpdir="${TMPDIR:-/tmp}/codex-wrapper-test.$$"
fakebin="$tmpdir/bin"
project="$tmpdir/project"
log="$tmpdir/log"

mkdir -p "$fakebin" "$project"

cleanup() {
    rm -f "$fakebin/codex" "$fakebin/tmux" "$log"
    rmdir "$project" "$fakebin" "$tmpdir" 2>/dev/null || true
}
trap cleanup EXIT

cat > "$fakebin/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
printf 'codex args:%s\n' "$*" >> "$CODEX_WRAPPER_TEST_LOG"
sleep 0.35
FAKE_CODEX
chmod +x "$fakebin/codex"

cat > "$fakebin/tmux" <<'FAKE_TMUX'
#!/usr/bin/env bash
format="${@: -1}"

if [[ "$1" == "display-message" && "$2" == "-p" ]]; then
    case "$format" in
        "#{window_id}") printf '@42\n' ;;
        "#{window_name}") printf 'fish\n' ;;
        "#{window_automatic_rename}") printf '1\n' ;;
        *) exit 1 ;;
    esac
    exit 0
fi

if [[ "$1" == "rename-window" && "$2" == "-t" ]]; then
    printf 'rename-window:%s:%s\n' "$3" "$4" >> "$CODEX_WRAPPER_TEST_LOG"
    exit 0
fi

if [[ "$1" == "set-option" && "$2" == "-w" && "$3" == "-t" ]]; then
    printf 'set-option:%s:%s:%s\n' "$4" "$6" "$7" >> "$CODEX_WRAPPER_TEST_LOG"
    exit 0
fi

printf 'unexpected tmux command:%s\n' "$*" >> "$CODEX_WRAPPER_TEST_LOG"
exit 1
FAKE_TMUX
chmod +x "$fakebin/tmux"

(
    cd "$project"
    PATH="$fakebin:/usr/bin:/bin" \
        TMUX="/tmp/tmux" \
        TMUX_PANE="%1" \
        CODEX_WRAPPER_TEST_LOG="$log" \
        "$wrapper" alpha beta
)

grep -q '^codex args:alpha beta$' "$log"
grep -q '^rename-window:@42:.*project$' "$log"
grep -q '^rename-window:@42:fish$' "$log"
grep -q '^set-option:@42:automatic-rename:on$' "$log"
