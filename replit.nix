{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.libuuid
    pkgs.python3
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
  ];
}