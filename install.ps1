#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Install personal dotfiles and applications on Windows
.DESCRIPTION
    This script installs dotfiles configuration and sets up development tools using winget
.PARAMETER NoPull
    Skip git pull to use local version
.PARAMETER Verbose
    Show detailed installation progress
.EXAMPLE
    .\install.ps1
    Standard installation with git pull
.EXAMPLE
    .\install.ps1 -NoPull -Verbose
    Installation without git pull and detailed output
#>

param(
    [switch]$NoPull,
    [switch]$Verbose
)

# Error handling
$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message)
    Write-Host "🔄 $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Initialize-Directories {
    Write-Status "Initializing directories"
    
    $configDir = "$env:USERPROFILE\.config"
    if (!(Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        Write-Success "Created .config directory"
    }
    
    # Create art directories like in install.sh
    $artDirs = "$env:USERPROFILE\art\github", "$env:USERPROFILE\art\opensource", "$env:USERPROFILE\art\personal"
    foreach ($dir in $artDirs) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    Write-Success "Created art directories"
}

function Deploy-Configs {
    Write-Status "Deploying configuration files"
    
    # Deploy wezterm config if exists
    if (Test-Path ".\.config\wezterm") {
        $destDir = "$env:USERPROFILE\.config\wezterm"
        Copy-Item -Path ".\.config\wezterm" -Destination $destDir -Recurse -Force
        Write-Success "Deployed wezterm configuration"
    }
    
    # You can add more config deployments here following the same pattern
}

function Update-Repository {
    if ($NoPull) {
        Write-Warning "Skipping git pull (--no-pull specified)"
        return
    }
    
    Write-Status "Pulling latest changes"
    try {
        git pull --ff origin master
        Write-Success "Repository updated"
    }
    catch {
        Write-Warning "Failed to pull latest changes: $($_.Exception.Message)"
    }
}

function Install-Apps {
    Write-Status "Installing applications via winget"
    
    $apps = @(
        "WingetPathUpdater",
        "wez.wezterm",
        "Microsoft.PowerToys",
        "vim.vim",
        "Git.Git",
        "GeekUninstaller.GeekUninstaller",
        "DEVCOM.JetBrainsMonoNerdFont",
        "Microsoft.VisualStudioCode.Insiders",
        "Microsoft.WindowsTerminal",
        "oldj.switchhosts",
        "Obsidian.Obsidian",
        "Sinew.Enpass",
        "Microsoft.Sysinternals.ProcessExplorer",
        "Telegram.TelegramDesktop",
        "Tencent.WeChat",
        "Discord.Discord",
        "Microsoft.Sysinternals.TCPView",
        "flux.flux",
        "LocalSend.LocalSend",
        "zhongyang219.TrafficMonitor.Full"
    )
    
    if (!(Test-Command "winget")) {
        throw "winget is not installed or not in PATH"
    }
    
    $installedCount = 0
    $totalCount = $apps.Count
    
    foreach ($appId in $apps) {
        if ($Verbose) {
            Write-Host "  Checking $appId..." -ForegroundColor Gray
        }
        
        try {
            # Check if app is already installed
            $installed = winget list --id $appId -e --exact 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                if ($Verbose) {
                    Write-Host "  ✓ Already installed: $appId" -ForegroundColor Green
                }
            }
            else {
                Write-Host "  📦 Installing: $appId" -ForegroundColor Yellow
                $result = winget install --id $appId --exact --accept-package-agreements --accept-source-agreements
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "  ✓ Installed: $appId"
                    $installedCount++
                }
                else {
                    Write-Warning "  ✗ Failed to install: $appId"
                }
            }
        }
        catch {
            Write-Warning "  ✗ Error installing $appId`: $($_.Exception.Message)"
        }
    }
    
    Write-Success "Installation complete: $installedCount new apps installed out of $totalCount total"
}

function Main {
    try {
        Write-Host "🚀 Starting dotfiles installation on Windows" -ForegroundColor Magenta
        Write-Host "=======================================" -ForegroundColor Magenta
        
        # Change to script directory
        Set-Location $PSScriptRoot
        
        # Run installation steps
        Update-Repository
        Initialize-Directories
        Deploy-Configs
        Install-Apps
        
        Write-Success "🎉 Installation completed successfully!"
        Write-Host "`nYou may need to restart your terminal or system for some changes to take effect." -ForegroundColor Cyan
    }
    catch {
        Write-Host "❌ Installation failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Run the main function
Main