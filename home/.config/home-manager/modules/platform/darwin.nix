{ pkgs, ... }:

{
  imports = [
    ../../apps/darwin-cli.nix
    ../../apps/pstree-rs.nix
  ];

  home.packages = [
    pkgs.imgcat
  ];
}
