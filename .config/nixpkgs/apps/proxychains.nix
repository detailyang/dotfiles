{ pkgs, ...}:

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
    buildInputs = [ pkgs.autoconf pkgs.automake pkgs.libtool ]; 
    buildPhase = ''
      sed -i '24i #undef memcpy' src/core.c
      ./configure --prefix=$out
      make
      make install
    '';
  };

in

{
  home.packages = [
    proxychains-ng
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
}