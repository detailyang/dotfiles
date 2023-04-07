{ pkgs, ...}:
with import <nixpkgs> {};
with builtins;
with lib;
let 
  proxychains-ng-src = pkgs.fetchFromGitHub {
    owner = "rofl0r";
    repo = "proxychains-ng";
    rev = "v4.16";
    sha256 = "uu/zN6W0ue526/3a9QeYg6J4HLaovZJVOYXksjouYok=";
  };
  proxychains-ng = pkgs.stdenv.mkDerivation {
    name = "proxychains-ng-4.16";
    src = proxychains-ng-src;
    buildInputs = [ pkgs.autoconf pkgs.automake pkgs.libtool ];  # 假设您需要这些构建工具和库
    buildPhase = ''
      sed -i '24i #undef memcpy' src/core.c
      ./configure --prefix=$out
      make
      make install
    '';
    pngpaste = stdenv.mkDerivation {
	   name = "pngpaste";
	   src = fetchFromGitHub {
		  owner = "jcsalterego";
		  repo = "pngpaste";
		  rev = "67c39829fedb97397b691617f10a68af75cf0867";
		  sha256 = "089rqjk7khphs011hz3f355c7z6rjd4ydb4qfygmb4x54z2s7xms";
	   };
		buildInputs = [ pkgs.darwin.apple_sdk.frameworks.Cocoa ];
		installPhase = ''
		  mkdir -p $out/bin
		  cp pngpaste $out/bin/
		'';
	};
in

{
  nixpkgs.config.allowUnfree = true;      

  home.packages = [
    proxychains-ng
    pngpaste 
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
    pkgs.git-extras
    pkgs.git
    pkgs.delta

    pkgs.vim
    pkgs.vscode
    pkgs.tmux
    pkgs.alacritty

    pkgs.fira-code

    pkgs.coreutils
    pkgs.findutils
    pkgs.gnugrep
    pkgs.gnused
  ];

  home.file.".proxychains/proxychains.conf".text = ''
strict_chain
quiet_mode
proxy_dns
remote_dns_subnet 224
tcp_read_time_out 15000
tcp_connect_time_out 8000
[ProxyList]
socks5 127.0.0.1 7890
  '';

  programs = {
      home-manager = {
          enable = true;
      };
      fish = {
          enable = true;
          shellInit = ''
              for file in ~/fish/*.fish
                  source $file
              end
          '';
      };
  };
}

