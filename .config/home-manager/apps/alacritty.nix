{ pkgs, ...}:

let

  pkgsUnstable = import <nixpkgs-unstable> {};

in

{
    home.packages = [
        pkgsUnstable.alacritty
    ]; 

    programs.alacritty.enable = true;
}