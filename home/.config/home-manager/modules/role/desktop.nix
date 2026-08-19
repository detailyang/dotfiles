{ lib, pkgs, ... }:

{
  imports = [
    ../../apps/alacritty.nix
    ../../apps/fonts.nix
  ];

  home.packages = [
    pkgs.fira-code
    pkgs.jetbrains-mono
  ] ++ lib.optionals pkgs.stdenv.isLinux [
    pkgs.xclip
  ];
}
