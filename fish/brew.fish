if test (uname) = "Darwin"
    # Check for Apple Silicon Homebrew path first
    if test -d "/opt/homebrew"
        eval "$(/opt/homebrew/bin/brew shellenv)"
    # Fall back to Intel Homebrew path
    else if test -d "/usr/local/Homebrew"
        # Intel path is added by brew shellenv; nothing extra needed
    else
        echo "Homebrew installation not found"
        return 1
    end
end
