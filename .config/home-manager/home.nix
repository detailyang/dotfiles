{ config, pkgs, ... }:

let

  username = builtins.getEnv "USER";
  homeDirectory  = builtins.getEnv "HOME";
  pkgsStable = import <nixpkgs> {};

in

{
  imports = [
    ./apps/git.nix
    ./apps/proxychains.nix
    ./apps/fonts.nix
    ./apps/pstree-rs.nix
  ];

  nixpkgs.config.allowUnfree = true;      

  home.username = username;
  home.homeDirectory = homeDirectory;

  home.stateVersion = "23.11"; # Please read the comment before changing.

  home.packages = [
    pkgs.mkcert
    pkgs.jetbrains-mono
    pkgs.bat
    pkgs.tree
    pkgs.tokei
    pkgs.lazygit
    pkgs.xclip
    pkgs.socat
    pkgs.btop
    pkgs.yazi
    pkgs.protobuf
    pkgs.fortune
    pkgs.ast-grep
    pkgs.tokei
    pkgs.lolcat
    pkgs.cowsay
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
    pkgs.ripgrep
    pkgs.scc
    pkgs.htop
    pkgs.hyperfine
    pkgs.hexyl
    pkgs.curl
    pkgs.wget
    pkgs.git-cliff
    pkgs.vim
    pkgs.tmux
    pkgs.fira-code
    pkgs.coreutils
    pkgs.findutils
    pkgs.gnugrep
    pkgs.gnused
    pkgs.eza
    pkgs.fd
    pkgs.fzf
    pkgs.mcfly
    pkgs.peco
    pkgs.starship
    pkgs.zoxide
  ];

  home.file = {

  };

  home.sessionVariables = {
    EDITOR = "vim";
  };

  programs.home-manager.enable = true;

  # home-manager(26.05-pre) vs nixpkgs(25.11pre) 版本号不匹配警告，实际功能正常
  home.enableNixpkgsReleaseCheck = false;
}
