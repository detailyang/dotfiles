{ pkgs, ... }:

{
    home.packages = [
        pkgs.git-extras
    ];

    programs.git.enable = true;
    programs.delta.enable = true;
    programs.delta.enableGitIntegration = true;
    programs.git.lfs.enable = true;
    programs.git.settings.user.name = "detailyang";
    programs.git.settings.user.email = "detailyang@gmail.com";
    programs.git.settings.core.quotepath = false;
    programs.git.settings.pull.rebase = true;
    programs.git.ignores = [
        ".DS_Store"
    ];
}
