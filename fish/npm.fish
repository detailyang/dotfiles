if test -d $HOME/Library/pnpm
    set -x PATH $HOME/Library/pnpm $PATH
end


mkdir -p $HOME/.npm-global &> /dev/null
if test -d $HOME/.npm-global
    if type -q npm
        npm config set prefix $HOME/.npm-global
        set -x PATH $HOME/.npm-global/bin $PATH
    else
        echo "npm not found. Please install Node.js and npm first."
    end
end
