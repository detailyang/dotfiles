{ pkgs, ... }:

let
  version = "2.3.5";

  # 用 codeload 而不是 fetchFromGitHub：后者会先访问 github.com，
  # 在部分网络（如当前环境）会超时，而 codeload.github.com 可达。
  src = pkgs.fetchurl {
    name = "cfst-${version}.tar.gz";
    url = "https://codeload.github.com/XIU2/CloudflareSpeedTest/tar.gz/refs/tags/v${version}";
    hash = "sha256-UM23/o+6JrXiVkdyYFhgpbiEO3l7f4q1hibV4aSTsA8=";
  };

  cfst = pkgs.buildGoModule {
    pname = "cfst";
    inherit version src;

    vendorHash = "sha256-4h3Jf3K6uEm79KAy46v69wby01zf2tfdZxGeTyUXvdk=";

    # buildGoModule 的依赖固定输出派生会把 GOPROXY 当作 impure 变量覆盖成空值，
    # 这里显式导出国内代理，否则会走默认的 proxy.golang.org（部分网络不可达）。
    overrideModAttrs = _: {
      preBuild = ''
        export GOPROXY="https://goproxy.cn,direct"
      '';
    };

    subPackages = [ "." ];

    ldflags = [ "-s" "-w" ];

    postInstall = ''
      mv $out/bin/CloudflareSpeedTest $out/bin/cfst
    '';

    meta = {
      description = "Cloudflare edge IP latency and download speed tester";
      homepage = "https://github.com/XIU2/CloudflareSpeedTest";
      license = pkgs.lib.licenses.gpl3Only;
      mainProgram = "cfst";
    };
  };
in
{
  home.packages = [ cfst ];
}
