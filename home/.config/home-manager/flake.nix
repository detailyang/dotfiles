{
  description = "Cross-platform Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    home-manager = {
      url = "github:nix-community/home-manager/release-26.05";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { home-manager, nixpkgs, ... }:
    let
      supportedSystems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      mkHome = { system, platformModules, desktop ? false }:
        home-manager.lib.homeManagerConfiguration {
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };
          modules = [ ./home.nix ]
            ++ platformModules
            ++ nixpkgs.lib.optionals desktop [ ./modules/role/desktop.nix ];
        };
      mkDarwin = system: desktop: mkHome {
        inherit system desktop;
        platformModules = [ ./modules/platform/darwin.nix ];
      };
      mkLinux = system: desktop: mkHome {
        inherit system desktop;
        platformModules = [ ./modules/platform/linux.nix ];
      };
      mkWsl = system: desktop: mkHome {
        inherit system desktop;
        platformModules = [
          ./modules/platform/linux.nix
          ./modules/platform/wsl.nix
        ];
      };
    in
    {
      packages = forAllSystems (system: {
        default = home-manager.packages.${system}.default;
        home-manager = home-manager.packages.${system}.default;
      });

      homeConfigurations = {
        "macos-aarch64" = mkDarwin "aarch64-darwin" false;
        "macos-aarch64-desktop" = mkDarwin "aarch64-darwin" true;
        "macos-x86_64" = mkDarwin "x86_64-darwin" false;
        "macos-x86_64-desktop" = mkDarwin "x86_64-darwin" true;

        "linux-aarch64" = mkLinux "aarch64-linux" false;
        "linux-aarch64-desktop" = mkLinux "aarch64-linux" true;
        "linux-x86_64" = mkLinux "x86_64-linux" false;
        "linux-x86_64-desktop" = mkLinux "x86_64-linux" true;

        "wsl-aarch64" = mkWsl "aarch64-linux" false;
        "wsl-aarch64-desktop" = mkWsl "aarch64-linux" true;
        "wsl-x86_64" = mkWsl "x86_64-linux" false;
        "wsl-x86_64-desktop" = mkWsl "x86_64-linux" true;
      };
    };
}
