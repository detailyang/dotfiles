{ pkgs, ... }:

{
  imports = [ ../../apps/pstree-rs.nix ];

  home.packages = [
    pkgs.imgcat
  ];
}
