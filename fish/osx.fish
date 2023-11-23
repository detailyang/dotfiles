function osx
    export FRAMEWORK_SEARCH_PATHS="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/" &> /dev/null
    export LD_LIBRARY_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib:$LD_LIBRARY_PATH" &> /dev/null
    export LIBRARY_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib:$LIBRARY_PATH" &> /dev/null
    export C_INCLUDE_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include:$C_INCLUDE_PATH" &> /dev/null
    export CPLUS_INCLUDE_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include:$CPLUS_INCLUDE_PATH" &> /dev/null
    export CFLAGS="-I /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include" &> /dev/null
    export LDFLAGS="-L /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib" &> /dev/null
    export PATH="/usr/bin:/Library/Developer/CommandLineTools/usr/bin/:$PATH" &> /dev/null
end

if test (uname) = "Darwin"
    defaults write -g ApplePressAndHoldEnabled -bool false 2>&1 &> /dev/null 
    defaults write com.apple.finder AppleShowAllFiles YES

    # dock settings
    defaults write com.apple.dock autohide -int 1
    defaults write com.apple.dock mineffect -string scale
    defaults write com.apple.dock minimize-to-application -int 1
    defaults write com.apple.dock show-recents -int 0
    defaults write com.apple.dock tilesize -int 44
end
