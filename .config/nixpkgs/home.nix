{ pkgs, ...}:
{
    nixpkgs.config.allowUnfree = true;      

    home.packages = [
        pkgs.nodejs
        pkgs.go
        pkgs.php
        pkgs.protobuf 

        pkgs.imgcat
        pkgs.zoxide
        pkgs.silver-searcher
        pkgs.exa
        pkgs.scc
        pkgs.mcfly
        pkgs.starship
        pkgs.fd
        pkgs.htop
        pkgs.hyperfine
        pkgs.hexyl
        pkgs.curl
        pkgs.wget
        pkgs.git-extras
        pkgs.git
        pkgs.delta

        pkgs.vim
        pkgs.vscode
        pkgs.tmux
        pkgs.alacritty

        pkgs.fira-code

        pkgs.coreutils
        pkgs.findutils
        pkgs.gnugrep
        pkgs.gnused
    ];

    programs.home-manager = {
      enable = true;
    };

    programs.fish = {
        enable = true;
        shellInit = ''
            for file in ~/fish/*.fish
                source $file
            end
        '';
    };
}
