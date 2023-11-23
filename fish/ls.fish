function ls -d "list fies"
    if type -q exa
        command exa $argv
    else if type -q eza
        command eza $argv
    else
        command ls $argv
    end
end
