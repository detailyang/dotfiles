function pbcopy --description 'Copy stdin to the local clipboard'
    if set -q HERDR_ENV; or set -q SSH_CONNECTION; or set -q SSH_TTY
        if not type -q base64; or not type -q tr
            echo 'pbcopy: base64 and tr are required for OSC 52 clipboard writes' >&2
            return 127
        end

        printf '\e]52;c;'
        command base64 | command tr -d '\r\n'
        set -l encode_status $pipestatus
        printf '\a'

        if test $encode_status[1] -ne 0; or test $encode_status[2] -ne 0
            return 1
        end
        return
    end

    if test (uname) = Darwin
        command pbcopy $argv
    else
        command xsel --clipboard --input $argv
    end
end
