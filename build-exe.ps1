[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$launcherDirectory = Join-Path $projectRoot "launcher"
$generatedDirectory = Join-Path $launcherDirectory "generated"
$projectFile = Join-Path $launcherDirectory "CyberDiceLauncher.vcxproj"
$distributionDirectory = Join-Path $projectRoot "dist"
$artifactName = "Cyber-Dice-win-x64.exe"
$artifactPath = Join-Path $distributionDirectory $artifactName

function New-ApplicationIcon {
  param([string]$OutputPath)

  Add-Type -AssemblyName System.Drawing
  Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeIconMethods {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

  $bitmap = [System.Drawing.Bitmap]::new(256, 256)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(2, 9, 8))

  $backgroundBrush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.Color]::FromArgb(5, 30, 24)
  )
  $linePen = [System.Drawing.Pen]::new(
    [System.Drawing.Color]::FromArgb(103, 255, 210), 8
  )
  $goldBrush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.Color]::FromArgb(244, 201, 107)
  )
  $font = [System.Drawing.Font]::new(
    "Consolas", 66, [System.Drawing.FontStyle]::Bold,
    [System.Drawing.GraphicsUnit]::Pixel
  )

  try {
    $outer = [System.Drawing.Point[]]@(
      [System.Drawing.Point]::new(128, 21),
      [System.Drawing.Point]::new(222, 75),
      [System.Drawing.Point]::new(222, 181),
      [System.Drawing.Point]::new(128, 235),
      [System.Drawing.Point]::new(34, 181),
      [System.Drawing.Point]::new(34, 75)
    )
    $inner = [System.Drawing.Point[]]@(
      [System.Drawing.Point]::new(128, 62),
      [System.Drawing.Point]::new(184, 95),
      [System.Drawing.Point]::new(184, 161),
      [System.Drawing.Point]::new(128, 194),
      [System.Drawing.Point]::new(72, 161),
      [System.Drawing.Point]::new(72, 95)
    )

    $graphics.FillPolygon($backgroundBrush, $outer)
    $graphics.DrawPolygon($linePen, $outer)
    $graphics.DrawPolygon($linePen, $inner)
    $graphics.DrawString(
      ([char]0x2205).ToString(), $font, $goldBrush,
      [System.Drawing.PointF]::new(91, 91)
    )

    $iconHandle = $bitmap.GetHicon()
    try {
      $icon = [System.Drawing.Icon]::FromHandle($iconHandle).Clone()
      $stream = [System.IO.File]::Create($OutputPath)
      try {
        $icon.Save($stream)
      } finally {
        $stream.Dispose()
        $icon.Dispose()
      }
    } finally {
      [NativeIconMethods]::DestroyIcon($iconHandle) | Out-Null
    }
  } finally {
    $font.Dispose()
    $goldBrush.Dispose()
    $linePen.Dispose()
    $backgroundBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$vswherePath = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path -LiteralPath $vswherePath)) {
  throw "vswhere.exe was not found. Install Visual Studio with C++ desktop tools."
}

$visualStudioRoot = & $vswherePath `
  -latest `
  -products * `
  -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  -property installationPath
if (-not $visualStudioRoot) {
  throw "Visual Studio C++ desktop tools were not found."
}

$msbuildPath = Join-Path $visualStudioRoot "MSBuild\Current\Bin\MSBuild.exe"
$vcvarsPath = Join-Path $visualStudioRoot "VC\Auxiliary\Build\vcvars64.bat"
$msvcDirectory = Get-ChildItem -LiteralPath (Join-Path $visualStudioRoot "VC\Tools\MSVC") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $msvcDirectory) {
  throw "The MSVC toolset was not found."
}

$dumpbinPath = Join-Path $msvcDirectory.FullName "bin\Hostx64\x64\dumpbin.exe"

if (-not (Test-Path -LiteralPath $msbuildPath)) {
  throw "MSBuild was not found: $msbuildPath"
}

New-Item -ItemType Directory -Force -Path $generatedDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $distributionDirectory | Out-Null
New-ApplicationIcon -OutputPath (Join-Path $generatedDirectory "app.ico")

& $msbuildPath $projectFile `
  /restore `
  /t:Rebuild `
  /p:Configuration=Release `
  /p:Platform=x64 `
  /m

if ($LASTEXITCODE -ne 0) {
  throw "MSBuild failed with exit code $LASTEXITCODE"
}

$builtExecutable = Join-Path $launcherDirectory "out\x64\Release\CyberDiceLauncher.exe"
if (-not (Test-Path -LiteralPath $builtExecutable)) {
  throw "Build output was not found: $builtExecutable"
}

Copy-Item -LiteralPath $builtExecutable -Destination $artifactPath -Force

$dependencyText = & cmd.exe /d /c "call `"$vcvarsPath`" >nul && `"$dumpbinPath`" /dependents `"$artifactPath`""
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read the executable dependency list."
}

if ($dependencyText -match "(?i)WebView2Loader\.dll|VCRUNTIME[0-9]*\.dll|MSVCP[0-9]*\.dll") {
  throw "The executable still depends on external runtime DLLs."
}

$artifact = Get-Item -LiteralPath $artifactPath
$hash = Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256
$hashLine = "$($hash.Hash.ToLowerInvariant())  $artifactName"
$hashPath = "$artifactPath.sha256"
[System.IO.File]::WriteAllText(
  $hashPath,
  "$hashLine`n",
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Build complete." -ForegroundColor Green
Write-Host "File: $artifactPath"
Write-Host "Size: $($artifact.Length) bytes"
Write-Host "SHA-256: $($hash.Hash.ToLowerInvariant())"
Write-Host "Dependency check: no WebView2Loader.dll or Visual C++ runtime DLL"
