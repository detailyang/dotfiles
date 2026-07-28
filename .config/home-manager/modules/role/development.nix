{ pkgs, ... }:

{
  home.packages = [
    pkgs.ast-grep
    pkgs.cmake
    pkgs.lld
    pkgs.llvm
    pkgs.mkcert
    pkgs.ninja
    pkgs.protobuf
    pkgs.skopeo
  ];
}
