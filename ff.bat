@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Setting up FFmpeg sidecar for Tauri...
echo ============================================

cd /d "%~dp0"

if not exist "src-tauri" (
    echo Error: src-tauri folder not found. Run this from your video-editor root.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'Stop';" ^
    "$binDir = Join-Path (Get-Location) 'src-tauri\binaries';" ^
    "if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null };" ^
    "Set-Location $binDir;" ^
    "Write-Host '--> Downloading FFmpeg essentials archive...';" ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg.zip';" ^
    "Write-Host '--> Extracting archive...';" ^
    "Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'temp_ffmpeg' -Force;" ^
    "$binPath = (Get-ChildItem -Path 'temp_ffmpeg' -Recurse -Filter 'ffmpeg.exe').DirectoryName;" ^
    "Write-Host '--> Copying sidecar binaries...';" ^
    "Copy-Item (Join-Path $binPath 'ffmpeg.exe') -Destination 'ffmpeg-x86_64-pc-windows-msvc.exe' -Force;" ^
    "Copy-Item (Join-Path $binPath 'ffprobe.exe') -Destination 'ffprobe-x86_64-pc-windows-msvc.exe' -Force;" ^
    "Write-Host '--> Cleaning up temp files...';" ^
    "Remove-Item -Recurse -Force 'temp_ffmpeg', 'ffmpeg.zip';" ^
    "Write-Host '--> FFmpeg sidecar setup successfully completed!';"

echo.
echo ============================================
echo   Done! Binaries are ready in src-tauri/binaries/
echo ============================================
pause