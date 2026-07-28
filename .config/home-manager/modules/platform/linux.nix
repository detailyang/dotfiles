{ config, lib, pkgs, ... }:

{
  targets.genericLinux.enable = true;
  targets.genericLinux.gpu.enable = false;

  home.activation.checkStableLoginShell = lib.hm.dag.entryBefore [ "writeBoundary" ] ''
    login_shell="$(${pkgs.getent}/bin/getent passwd ${lib.escapeShellArg config.home.username} | ${pkgs.coreutils}/bin/cut -d: -f7)"

    case "$login_shell" in
      "$HOME/.nix-profile/"*|"$HOME/.local/state/nix/profiles/"*|/nix/var/nix/profiles/*|/nix/store/*)
        echo "Refusing to switch: login shell is tied to a mutable Nix generation: $login_shell" >&2
        echo "Set a system-managed shell from /etc/shells before switching Home Manager." >&2
        exit 1
        ;;
    esac

    if [[ -z "$login_shell" || ! -x "$login_shell" ]]; then
      echo "Refusing to switch: login shell is missing or not executable: $login_shell" >&2
      exit 1
    fi
  '';

  home.packages = [
    pkgs.pstree
  ];
}
