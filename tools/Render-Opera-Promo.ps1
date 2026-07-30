[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$releaseRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $releaseRoot "assets\branding\grandma-guard-logo.png"
$outputPath = Join-Path $releaseRoot "assets\store\opera-promo-300x188.png"

function New-RoundedRectanglePath(
  [System.Drawing.RectangleF]$Rectangle,
  [float]$Radius
) {
  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $arc = New-Object System.Drawing.RectangleF(
    $Rectangle.X,
    $Rectangle.Y,
    $diameter,
    $diameter
  )

  $path.AddArc($arc, 180, 90)
  $arc.X = $Rectangle.Right - $diameter
  $path.AddArc($arc, 270, 90)
  $arc.Y = $Rectangle.Bottom - $diameter
  $path.AddArc($arc, 0, 90)
  $arc.X = $Rectangle.Left
  $path.AddArc($arc, 90, 90)
  $path.CloseFigure()
  return $path
}

$canvas = New-Object System.Drawing.Bitmap 300, 188
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$logo = [System.Drawing.Image]::FromFile($logoPath)

try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $cream = [System.Drawing.ColorTranslator]::FromHtml("#FFF8EB")
  $panel = [System.Drawing.ColorTranslator]::FromHtml("#F5EAD6")
  $ink = [System.Drawing.ColorTranslator]::FromHtml("#173632")
  $teal = [System.Drawing.ColorTranslator]::FromHtml("#0F5B57")
  $muted = [System.Drawing.ColorTranslator]::FromHtml("#526A66")
  $coral = [System.Drawing.ColorTranslator]::FromHtml("#F06D53")

  $graphics.Clear($cream)

  $panelBrush = New-Object System.Drawing.SolidBrush $panel
  $panelPath = New-RoundedRectanglePath `
    (New-Object System.Drawing.RectangleF 10, 10, 280, 168) `
    20
  try {
    $graphics.FillPath($panelBrush, $panelPath)
  } finally {
    $panelPath.Dispose()
    $panelBrush.Dispose()
  }

  $graphics.DrawImage(
    $logo,
    (New-Object System.Drawing.Rectangle 21, 48, 86, 86)
  )

  $titleFont = New-Object System.Drawing.Font(
    "Segoe UI",
    22,
    [System.Drawing.FontStyle]::Bold,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $bodyFont = New-Object System.Drawing.Font(
    "Segoe UI",
    12,
    [System.Drawing.FontStyle]::Regular,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $inkBrush = New-Object System.Drawing.SolidBrush $ink
  $tealBrush = New-Object System.Drawing.SolidBrush $teal
  $mutedBrush = New-Object System.Drawing.SolidBrush $muted
  $coralBrush = New-Object System.Drawing.SolidBrush $coral

  try {
    $graphics.FillEllipse($coralBrush, 126, 37, 7, 7)
    $graphics.DrawString("Grandma", $titleFont, $inkBrush, 124, 47)
    $graphics.DrawString("Guard", $titleFont, $tealBrush, 124, 72)
    $graphics.DrawString("Calm protection from", $bodyFont, $mutedBrush, 125, 108)
    $graphics.DrawString("scary web tricks.", $bodyFont, $mutedBrush, 125, 127)
  } finally {
    $titleFont.Dispose()
    $bodyFont.Dispose()
    $inkBrush.Dispose()
    $tealBrush.Dispose()
    $mutedBrush.Dispose()
    $coralBrush.Dispose()
  }

  $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $logo.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}

Write-Host "Created $outputPath"
