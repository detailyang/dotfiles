if test (uname) = "Darwin"
    cd /usr/local/Homebrew
    set origin_url (git remote get-url origin)

    if test "$origin_url" != "git://mirrors.ustc.edu.cn/brew.git"
        cd /usr/local/Homebrew
        git remote set-url origin git://mirrors.ustc.edu.cn/brew.git

        cd /usr/local/Homebrew/Library/Taps/homebrew/homebrew-core
        git remote set-url origin git://mirrors.ustc.edu.cn/brew.git
    end
    cd ~
    export HOMEBREW_BOTTLE_DOMAIN=https://mirrors.ustc.edu.cn/homebrew-bottles
end
