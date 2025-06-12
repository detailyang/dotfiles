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

    cd $homebrew_path
    set origin_url (git remote get-url origin)

    if test "$origin_url" != "git://mirrors.ustc.edu.cn/brew.git"
        cd $homebrew_path
        git remote set-url origin git://mirrors.ustc.edu.cn/brew.git

        if test -d $homebrew_core_path
            cd $homebrew_core_path
            git remote set-url origin git://mirrors.ustc.edu.cn/brew.git
        end
    end
    cd ~
    export HOMEBREW_BOTTLE_DOMAIN=https://mirrors.ustc.edu.cn/homebrew-bottles
end
