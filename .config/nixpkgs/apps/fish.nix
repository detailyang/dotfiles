{
    programs.fish = {
        enable = true;
        shellInit = ''
            for file in ~/fish/*.fish
                source $file
            end
        '';
    };
}