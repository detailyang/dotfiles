function osx
    export LIBRARY_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib:$LIBRARY_PATH"
    export PATH="/Library/Developer/CommandLineTools/usr/bin/:$PATH"
end

defaults delete -g ApplePressAndHoldEnabled 2>&1 &> /dev/null # If necessary, reset global default
defaults write com.apple.finder AppleShowAllFiles YES
