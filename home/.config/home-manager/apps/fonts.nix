
{ pkgs, ...}:

{
    home.packages = [
        pkgs.maple-mono.truetype
        # Maple Mono NF (Ligature unhinted)
        pkgs.maple-mono.NF-unhinted
        # Maple Mono NF CN (Ligature unhinted)
        pkgs.maple-mono.NF-CN-unhinted
    ];
}