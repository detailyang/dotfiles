{ pkgs, ...}:

let

  pkgsStable = import <nixpkgs> {};

in

{
    home.packages = [
        pkgsUnstable.alacritty
    ]; 

    programs.alacritty.enable = true;
}