
if (!(Test-Path $env:USERPROFILE\.config)) {
    New-Item -ItemType Directory -Path $env:USERPROFILE\.config | Out-Null
}

if (Test-Path .\.config\wezterm) {
    Copy-Item -Path .\.config\wezterm -Destination $env:USERPROFILE\wezterm -Recurse -Force
}

function Install-App {
    param(
        [Parameter(Mandatory=$true)]
        [string]$AppId
    )
    # 检查是否已经安装这个软件
    $installed = winget list --id $AppId -e 
    
    # 如果没有安装，那么安装它
    if (-not $installed) {
        Write-Host "winget installing $AppId"
        winget install --id $AppId
    }
}

# install app via winget

Install-App -AppId "WingetPathUpdater"
Install-App -AppId "wez.wezterm"
Install-App -AppId "Microsoft.PowerToys"
Install-App -AppId "vim.vim"
Install-App -AppId "Git.Git"
Install-App -AppId "GeekUninstaller.GeekUninstaller"
Install-App -AppId "DEVCOM.JetBrainsMonoNerdFont"
Install-App -AppId "Microsoft.VisualStudioCode.Insiders"
Install-App -AppId "Microsoft.WindowsTerminal"
Install-App -AppId "oldj.switchhosts"
