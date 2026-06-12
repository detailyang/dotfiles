{ pkgs, ... }:

let
  version = "0.1.1";

  srcs = {
    aarch64-darwin = pkgs.fetchurl {
      url    = "https://github.com/detailyang/pstree-rs/releases/download/v${version}/pstree-rs-v${version}-aarch64-apple-darwin.tar.gz";
      hash   = "sha256-YiOsbzdfMPqeUGUUT17G/VUeJHsrC0th4VXqGj+2Fg8=";
    };
    x86_64-darwin = pkgs.fetchurl {
      url    = "https://github.com/detailyang/pstree-rs/releases/download/v${version}/pstree-rs-v${version}-x86_64-apple-darwin.tar.gz";
      hash   = "sha256-I1weFNRMc0TiVNB1wWWLSjkykart+OS8DzrIcbH+D5s=";
    };
  };

  pstree-rs = pkgs.stdenv.mkDerivation {
    pname   = "pstree-rs";
    inherit version;

    src = srcs.${pkgs.stdenv.hostPlatform.system};

    phases = [ "unpackPhase" "installPhase" ];

    unpackPhase = ''
      tar -xzf $src
    '';

    installPhase = ''
      mkdir -p $out/bin
      cp pstree-rs $out/bin/pstree
      chmod +x $out/bin/pstree
    '';
  };
in

{
  home.packages = [ pstree-rs ];
}
