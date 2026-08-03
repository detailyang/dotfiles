{ pkgs, ... }:

let
  im-select = pkgs.stdenv.mkDerivation {
    pname = "im-select";
    version = "unstable-2026-05-21";

    src = pkgs.fetchurl {
      url = "https://raw.githubusercontent.com/daipeihust/im-select/9cd5278b185a9d6daa12ba35471ec2cc1a2e3012/macOS/im-select/im-select/main.m";
      hash = "sha256-j4OQjmoNUVIxJPNdpq0v53TTocpxBHP38XlIB4HAtY8=";
    };

    dontUnpack = true;

    buildPhase = ''
      runHook preBuild
      $CC -x objective-c "$src" \
        -framework Foundation \
        -framework Carbon \
        -o im-select
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      install -Dm755 im-select "$out/bin/im-select"
      runHook postInstall
    '';
  };
in
{
  home.packages = [
    im-select
    pkgs.fish
  ];
}
