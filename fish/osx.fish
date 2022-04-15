function osx
    export LD_LIBRARY_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib:$LD_LIBRARY_PATH" &> /dev/null
    export LIBRARY_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib:$LIBRARY_PATH" &> /dev/null
    export C_INCLUDE_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include:$C_INCLUDE_PATH" &> /dev/null
    export CPLUS_INCLUDE_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include:$CPLUS_INCLUDE_PATH" &> /dev/null
    export CFLAGS="-I /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include" &> /dev/null
    export LDFLAGS="-L /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib" &> /dev/null
    export PATH="/Library/Developer/CommandLineTools/usr/bin/:$PATH" &> /dev/null
end

defaults delete -g ApplePressAndHoldEnabled 2>&1 &> /dev/null # If necessary, reset global default
defaults write com.apple.finder AppleShowAllFiles YES
