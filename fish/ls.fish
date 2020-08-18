function ls -d "list fies"
    if type -q exa
        command exa $argv
    else 
        command exa $argv
    end
end
