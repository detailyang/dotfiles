{ pkgs, ...}:

{
    home.packages = [
        pkgs.git-extras
        pkgs.git
    ];

    programs.git.enable = true;
    programs.git.lfs.enable = true;
    programs.git.settings.user.name = "detailyang";
    programs.git.settings.user.email = "detailyang@gmail.com";
    programs.git.settings.extraConfig = {
        core = {
            quotepath = false;
        };
        pull = {
            rebase = true;
        };
    };
    programs.git.ignores = [
        ".DS_Store"
    ];
}
