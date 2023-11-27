
if (!(Test-Path $env:USERPROFILE\.config)) {
    New-Item -ItemType Directory -Path $env:USERPROFILE\.config | Out-Null
}
if (Test-Path .\config\wezterm) {
    Copy-Item -Path .\config\wezterm -Destination $env:USERPROFILE\wezterm -Recurse -Force
}

# install app via winget