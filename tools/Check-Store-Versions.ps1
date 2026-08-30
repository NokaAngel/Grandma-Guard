#Requires -Version 5.1
<#
.SYNOPSIS
  Local Windows helper for store version checks.

.DESCRIPTION
  Prefer the Linux-friendly PHP tool on the host:
    php app/tools/check-store-versions.php
    php app/tools/check-store-versions.php --mark-chrome=1.3.0

  This script mirrors that behavior for local Windows machines:
  - Reads Firefox version from the public AMO API.
  - Keeps Chrome published_version as a manual field (no stable public version API).
  - Writes app/config/store-status.cache.json for the PHP site.
  - Optionally marks Chrome as live for a target version.

.EXAMPLE
  .\tools\Check-Store-Versions.ps1
  .\tools\Check-Store-Versions.ps1 -MarkChromePublished 1.3.0
  .\tools\Check-Store-Versions.ps1 -Expect 1.3.0
#>
[CmdletBinding()]
param(
  [string]$Expect = "",
  [string]$MarkChromePublished = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$websiteRoot = Join-Path $projectRoot "GrandmaGuard Website"
$configPath = Join-Path $websiteRoot "app\config\product.json"
$cachePath = Join-Path $websiteRoot "app\config\store-status.cache.json"

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Missing product config: $configPath"
}

$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$shipping = [string]$config.shipping_version
$slug = [string]$config.browsers.firefox.slug
if ([string]::IsNullOrWhiteSpace($slug)) {
  $slug = "grandma-guard"
}

$amoUrl = "https://addons.mozilla.org/api/v5/addons/addon/$slug/"
Write-Host "Checking AMO: $amoUrl"
$amo = Invoke-RestMethod -Uri $amoUrl -TimeoutSec 30
$firefoxVersion = [string]$amo.current_version.version
$config.browsers.firefox.published_version = $firefoxVersion

if (-not [string]::IsNullOrWhiteSpace($MarkChromePublished)) {
  $config.browsers.chrome.published_version = $MarkChromePublished
  Write-Host "Marked Chrome published_version=$MarkChromePublished"
}

$chromeVersion = [string]$config.browsers.chrome.published_version
$checkedAt = [DateTime]::UtcNow.ToString("o")

$cache = [ordered]@{
  checked_at = $checkedAt
  firefox = $firefoxVersion
  chrome = $chromeVersion
  shipping_version = $shipping
  source = "check-store-versions"
}
$config | ConvertTo-Json -Depth 8 | ForEach-Object {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($configPath, $_ + "`n", $utf8)
}

$cacheJson = ($cache | ConvertTo-Json)
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($cachePath, $cacheJson + "`n", $utf8)

$bothLive = (
  ([version]$firefoxVersion -ge [version]$shipping) -and
  ([version]$chromeVersion -ge [version]$shipping)
)

Write-Host ""
Write-Host "Shipping version: $shipping"
Write-Host "Firefox (AMO):    $firefoxVersion"
Write-Host "Chrome (config):  $chromeVersion"
Write-Host "Both stores live: $bothLive"
Write-Host "Cache written:    $cachePath"
Write-Host ""
Write-Host "Public site will show:"
if ($bothLive) {
  Write-Host "  $shipping (live-shipping)"
} else {
  $public = if ([version]$chromeVersion -le [version]$firefoxVersion) { $chromeVersion } else { $firefoxVersion }
  Write-Host "  $public (store-published)"
  Write-Host "Preview 1.3.0 pages with: ?preview=1"
}

if (-not [string]::IsNullOrWhiteSpace($Expect)) {
  if ($firefoxVersion -ne $Expect -or $chromeVersion -ne $Expect) {
    throw "Expected both stores at $Expect (firefox=$firefoxVersion chrome=$chromeVersion)."
  }
  Write-Host "Expectation met: both stores report $Expect"
}
