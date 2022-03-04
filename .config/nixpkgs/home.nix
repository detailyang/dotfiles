{ pkgs, ...}:
{
    nixpkgs.config.allowUnfree = true;      

    home.packages = [
        pkgs.tmux

        pkgs.silver-searcher
        pkgs.exa
        pkgs.mcfly
        pkgs.starship
        pkgs.fd
        pkgs.hyperfine
        pkgs.hexyl
        pkgs.git-extras
        pkgs.curl
        pkgs.wget

        pkgs.vscode
        pkgs.fira-code
        pkgs.alacritty

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
    };
}
