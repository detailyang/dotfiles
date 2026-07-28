{ ... }:

let
  username = builtins.getEnv "USER";
  homeDirectory = builtins.getEnv "HOME";
in
{
  imports = [
    ./apps/git.nix
    ./apps/proxychains.nix
    ./modules/common.nix
    ./modules/role/development.nix
  ];

  assertions = [
    {
      assertion = username != "";
      message = "USER must be set; run Home Manager with --impure";
    }
    {
      assertion = homeDirectory != "";
      message = "HOME must be set; run Home Manager with --impure";
    }
  ];

  home.username = username;
  home.homeDirectory = homeDirectory;
  home.stateVersion = "23.11";

  home.sessionVariables = {
    EDITOR = "vim";
  };

  programs.home-manager.enable = true;
}
