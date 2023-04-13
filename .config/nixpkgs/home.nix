{ pkgs, ...}:

let

  pkgsUnstable = import <nixpkgs-unstable> {};

in

{
  imports = [
    ./apps/git.nix
    ./apps/fish.nix
    ./apps/proxychains.nix
    ./apps/alacritty.nix
  ];
  nixpkgs.config.allowUnfree = true;      

  home.packages = [
    pkgs.nodejs
    pkgs.go
    pkgs.php
    pkgs.protobuf 
    pkgs.fortune
    pkgs.tokei
    pkgs.lolcat
    pkgs.cowsay
    pkgs.peco
    pkgs.difftastic
    pkgs.graphviz
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
    pkgs.delta
    pkgs.vim
    pkgs.vscode
    pkgs.tmux
    pkgs.fira-code
    pkgs.coreutils
    pkgs.findutils
    pkgs.gnugrep
    pkgs.gnused
  ];

  programs = {
      home-manager = {
          enable = true;
      };
  };
}

