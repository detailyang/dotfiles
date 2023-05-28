{ pkgs, ...}:

{
    home.packages = [
        pkgs.git-extras
        pkgs.git
    ];

    programs.git.enable = true;
    programs.git.lfs.enable = true;
    programs.git.userName = "detailyang";
    programs.git.userEmail = "detailyang@gmail.com";
    programs.git.extraConfig = {
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