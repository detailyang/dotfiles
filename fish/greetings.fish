functions -c fish_greeting _old_fish_greeting
function fish_greeting
    #_old_fish_greeting
    if type -q cowsay and type -q fortune and type -q lolcat
        fortune -s | cowsay | lolcat -t
    end
end

