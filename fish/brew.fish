pushd
cd /usr/local/Homebrew
git remote set-url origin git://mirrors.ustc.edu.cn/brew.git
popd

pushd
cd /usr/local/Homebrew/Library/Taps/homebrew/homebrew-core
git remote set-url origin git://mirrors.ustc.edu.cn/brew.git
popd

export HOMEBREW_BOTTLE_DOMAIN=https://mirrors.ustc.edu.cn/homebrew-bottles
