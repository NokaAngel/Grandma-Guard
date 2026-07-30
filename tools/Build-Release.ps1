[CmdletBinding()]
param(
  [string]$NodeExecutable = "node"
)

$ErrorActionPreference = "Stop"
$releaseRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $releaseRoot "source"
$firefoxManifestPath = Join-Path $releaseRoot "firefox\manifest.json"
$expectedFirefoxId = "{3ae9a4ff-604c-44be-a41f-139571f7446f}"
$browsers = @("chrome", "firefox", "opera")
$version = "1.0.0"

function Get-RelativePath([string]$BasePath, [string]$FullPath) {
  return $FullPath.Substring($BasePath.Length + 1)
}

function Assert-FirefoxManifest {
  $manifest = Get-Content -Raw -LiteralPath $firefoxManifestPath | ConvertFrom-Json
  if ($manifest.browser_specific_settings.gecko.id -ne $expectedFirefoxId) {
    throw "Firefox stable extension ID changed."
  }
  if (($manifest.browser_specific_settings.gecko.data_collection_permissions.required -join ",") -ne "none") {
    throw "Firefox no-data-collection declaration changed."
  }
}

function Sync-BrowserFolder([string]$Browser) {
  $browserRoot = Join-Path $releaseRoot $Browser
  $preservedManifest = if ($Browser -eq "firefox") {
    [System.IO.File]::ReadAllBytes((Join-Path $browserRoot "manifest.json"))
  } else {
    $null
  }

  Get-ChildItem -LiteralPath $browserRoot -Recurse -File | Remove-Item -Force
  Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | ForEach-Object {
    $relativePath = Get-RelativePath $sourceRoot $_.FullName
    $destination = Join-Path $browserRoot $relativePath
    $destinationDirectory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
  }

  if ($Browser -eq "firefox") {
    [System.IO.File]::WriteAllBytes((Join-Path $browserRoot "manifest.json"), $preservedManifest)
  }
}

function Test-ManifestAssets([string]$Browser) {
  $browserRoot = Join-Path $releaseRoot $Browser
  $manifest = Get-Content -Raw -LiteralPath (Join-Path $browserRoot "manifest.json") | ConvertFrom-Json
  if ($manifest.version -ne $version -or $manifest.manifest_version -ne 3) {
    throw "$Browser manifest version is unexpected."
  }

  $iconPaths = @($manifest.icons.PSObject.Properties.Value)
  $iconPaths += @($manifest.action.default_icon.PSObject.Properties.Value)
  foreach ($iconPath in $iconPaths | Sort-Object -Unique) {
    if (-not (Test-Path -LiteralPath (Join-Path $browserRoot $iconPath))) {
      throw "$Browser manifest references missing asset $iconPath."
    }
  }
}

function Test-Package([string]$Browser, [string]$ArchivePath) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    $entries = @($archive.Entries | Where-Object { -not $_.FullName.EndsWith("/") })
    if ($entries.FullName -match "\\") {
      throw "$Browser package contains a Windows path separator."
    }
    if ($entries.FullName -match "(?i)(^|/)(tests?|fixtures?|dev|tools?)(/|$)") {
      throw "$Browser package contains development or test content."
    }
    if ($entries.FullName -match "^icons/icon(?:16|32|48|128)\.png$") {
      throw "$Browser package contains stale icon files."
    }

    $browserRoot = Join-Path $releaseRoot $Browser
    $diskFiles = @(Get-ChildItem -LiteralPath $browserRoot -Recurse -File)
    if ($entries.Count -ne $diskFiles.Count) {
      throw "$Browser package file count does not match its browser folder."
    }

    $expectedNames = @($diskFiles | ForEach-Object {
      (Get-RelativePath $browserRoot $_.FullName).Replace("\", "/")
    })
    $nameDifferences = @(Compare-Object -ReferenceObject $expectedNames -DifferenceObject $entries.FullName)
    if ($nameDifferences.Count -ne 0) {
      throw "$Browser package paths do not match its browser folder."
    }
  } finally {
    $archive.Dispose()
  }
}

function New-ReleaseArchive([string]$Browser, [string]$ArchivePath) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $browserRoot = Join-Path $releaseRoot $Browser
  $archive = [System.IO.Compression.ZipFile]::Open(
    $ArchivePath,
    [System.IO.Compression.ZipArchiveMode]::Create
  )
  try {
    Get-ChildItem -LiteralPath $browserRoot -Recurse -File |
      Sort-Object FullName |
      ForEach-Object {
        $entryName = (Get-RelativePath $browserRoot $_.FullName).Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
          $archive,
          $_.FullName,
          $entryName,
          [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
      }
  } finally {
    $archive.Dispose()
  }
}

Assert-FirefoxManifest

foreach ($browser in $browsers) {
  Sync-BrowserFolder $browser
}

Assert-FirefoxManifest

$javascriptFiles = Get-ChildItem -LiteralPath $sourceRoot -Filter *.js -File
foreach ($javascriptFile in $javascriptFiles) {
  & $NodeExecutable --check $javascriptFile.FullName
  if ($LASTEXITCODE -ne 0) {
    throw "JavaScript syntax check failed for $($javascriptFile.Name)."
  }
}

& $NodeExecutable (Join-Path $releaseRoot "tests\detection-engine.test.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "Detection regression tests failed."
}

$textExtensions = @(".js", ".html", ".css", ".json", ".md", ".ps1", ".mjs")
Get-ChildItem -LiteralPath $releaseRoot -Recurse -File |
  Where-Object { $_.Extension -in $textExtensions } |
  ForEach-Object {
    if ((Get-Content -Raw -LiteralPath $_.FullName).Contains([char]0x2014)) {
      throw "Em dash found in $(Get-RelativePath $releaseRoot $_.FullName)."
    }
  }

foreach ($browser in $browsers) {
  Test-ManifestAssets $browser
  $titleBrowser = (Get-Culture).TextInfo.ToTitleCase($browser)
  $archivePath = Join-Path $releaseRoot "Grandma-Guard-$titleBrowser-$version.zip"
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
  New-ReleaseArchive $browser $archivePath
  Test-Package $browser $archivePath
  Write-Host "Built and validated $(Split-Path -Leaf $archivePath)"
}
