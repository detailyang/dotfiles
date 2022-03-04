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

        pkgs.vscode
        pkgs.fira-code

        pkgs.coreutils
        pkgs.findutils
        pkgs.gnugrep
        pkgs.gnused
    ];
}
