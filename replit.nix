{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.npm-9_x
    pkgs.libuuid
    pkgs.python3
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
  ];
}