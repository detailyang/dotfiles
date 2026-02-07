{ config, pkgs, ... }:

let

  username = builtins.getEnv "USER";
  homeDirectory  = builtins.getEnv "HOME";
  pkgsStable = import <nixpkgs> {};

in

{
  imports = [
    ./apps/git.nix
    ./apps/fish.nix
    ./apps/proxychains.nix
    ./apps/fonts.nix
  ];

  nixpkgs.config.allowUnfree = true;      

  home.username = username;
  home.homeDirectory = homeDirectory;

  home.stateVersion = "23.11"; # Please read the comment before changing.

  home.packages = [
    pkgs.mkcert
    pkgs.jetbrains-mono
    pkgs.bat
    pkgs.tokei
    pkgs.yazi
    pkgs.xclip
    pkgs.btop
    pkgs.yazi
    pkgs.protobuf
    pkgs.fortune
    pkgs.ast-grep
    pkgs.tokei
    pkgs.lolcat
    pkgs.cowsay
    pkgs.peco
    pkgs.difftastic
    pkgs.graphviz
    pkgs.aha
    pkgs.jj
    pkgs.cmake
    pkgs.llvm
    pkgs.clang
    pkgs.lld
    pkgs.ninja
    pkgs.skopeo
    pkgs.jq
    pkgs.imgcat
    pkgs.zoxide
    pkgs.silver-searcher
    pkgs.eza
    pkgs.scc
    pkgs.mcfly
    pkgs.starship
    pkgs.fd
    pkgs.htop
    pkgs.hyperfine
    pkgs.hexyl
    pkgs.curl
    pkgs.wget
    pkgs.delta
    pkgs.vim
    pkgs.tmux
    pkgs.fira-code
    pkgs.jujutsu
    pkgs.coreutils
    pkgs.findutils
    pkgs.gnugrep
    pkgs.gnused
  ];

  home.file = {

  };

  home.sessionVariables = {
    EDITOR = "vim";
  };

  programs.home-manager.enable = true;
}

