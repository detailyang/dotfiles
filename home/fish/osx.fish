function osx
    set -gx FRAMEWORK_SEARCH_PATHS "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/"
    set -gx LD_LIBRARY_PATH (string join : "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib" $LD_LIBRARY_PATH)
    set -gx LIBRARY_PATH (string join : "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib" $LIBRARY_PATH)
    set -gx C_INCLUDE_PATH (string join : "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include" $C_INCLUDE_PATH)
    set -gx CPLUS_INCLUDE_PATH (string join : "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include" $CPLUS_INCLUDE_PATH)
    set -gx CFLAGS "-I /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include"
    set -gx LDFLAGS "-L /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib"
    fish_add_path --path /usr/bin /Library/Developer/CommandLineTools/usr/bin
end
