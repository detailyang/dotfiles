function ls -d "list files"
    if type -q eza
        command eza $argv
    else if type -q exa
        command exa $argv
    else
        command ls $argv
    end
end
