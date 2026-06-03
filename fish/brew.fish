if test (uname) = "Darwin"
    # Check for Apple Silicon Homebrew path first
    if test -d "/opt/homebrew"
        set homebrew_path "/opt/homebrew"
        set homebrew_core_path "/opt/homebrew/Library/Taps/homebrew/homebrew-core"
        eval "$(/opt/homebrew/bin/brew shellenv)"
    # Fall back to Intel Homebrew path
    else if test -d "/usr/local/Homebrew"
        set homebrew_path "/usr/local/Homebrew"
        set homebrew_core_path "/usr/local/Homebrew/Library/Taps/homebrew/homebrew-core"
    else
        echo "Homebrew installation not found"
        return 1
    end

    # Use `git -C` to avoid changing $PWD of the interactive session
    set origin_url (git -C $homebrew_path remote get-url origin 2>/dev/null)
    if test "$origin_url" != "git://mirrors.ustc.edu.cn/brew.git"
        git -C $homebrew_path remote set-url origin git://mirrors.ustc.edu.cn/brew.git

        if test -d $homebrew_core_path
            git -C $homebrew_core_path remote set-url origin git://mirrors.ustc.edu.cn/brew.git
        end
    end
    set -x HOMEBREW_BOTTLE_DOMAIN https://mirrors.ustc.edu.cn/homebrew-bottles
end
