[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $assets | Out-Null

function New-OracleIcon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(2, 9, 8))

  $scale = $Size / 64.0
  $mint = [System.Drawing.Color]::FromArgb(103, 255, 210)
  $gold = [System.Drawing.Color]::FromArgb(244, 201, 107)
  $linePen = [System.Drawing.Pen]::new($mint, [single](2.6 * $scale))
  $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $glowPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(60, 103, 255, 210), [single](5.2 * $scale))
  $goldBrush = [System.Drawing.SolidBrush]::new($gold)
  $mintBrush = [System.Drawing.SolidBrush]::new($mint)

  try {
    $outer = [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new(32 * $scale, 8 * $scale),
      [System.Drawing.PointF]::new(52 * $scale, 22 * $scale),
      [System.Drawing.PointF]::new(45 * $scale, 48 * $scale),
      [System.Drawing.PointF]::new(19 * $scale, 48 * $scale),
      [System.Drawing.PointF]::new(12 * $scale, 22 * $scale)
    )
    $inner = [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new(32 * $scale, 20 * $scale),
      [System.Drawing.PointF]::new(42 * $scale, 28 * $scale),
      [System.Drawing.PointF]::new(37 * $scale, 40 * $scale),
      [System.Drawing.PointF]::new(27 * $scale, 40 * $scale),
      [System.Drawing.PointF]::new(22 * $scale, 28 * $scale)
    )

    $graphics.DrawPolygon($glowPen, $outer)
    $graphics.DrawPolygon($linePen, $outer)
    $graphics.DrawPolygon($linePen, $inner)
    $graphics.FillEllipse(
      $mintBrush,
      [single](28.5 * $scale),
      [single](27.5 * $scale),
      [single](7 * $scale),
      [single](7 * $scale)
    )
    $graphics.FillEllipse(
      $goldBrush,
      [single](30.5 * $scale),
      [single](29.5 * $scale),
      [single](3 * $scale),
      [single](3 * $scale)
    )

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $mintBrush.Dispose()
    $goldBrush.Dispose()
    $glowPen.Dispose()
    $linePen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-OracleIcon -Size 192 -OutputPath (Join-Path $assets "icon-192.png")
New-OracleIcon -Size 512 -OutputPath (Join-Path $assets "icon-512.png")
New-OracleIcon -Size 180 -OutputPath (Join-Path $assets "apple-touch-icon.png")

Write-Host "PWA icons generated in $assets"
