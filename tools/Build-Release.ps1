[CmdletBinding()]
param(
  [string]$NodeExecutable = "node",

  [ValidateSet("All", "Chrome", "Firefox", "Opera")]
  [string]$Browser = "All"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $projectRoot "extension"
$chromiumManifestPath = Join-Path $extensionRoot "manifest.chromium.json"
$firefoxManifestPath = Join-Path $extensionRoot "manifest.firefox.json"
$outputRoot = Join-Path $projectRoot "dist"
$stagingRoot = Join-Path $projectRoot ".build"
$expectedFirefoxId = "{3ae9a4ff-604c-44be-a41f-139571f7446f}"
$version = (
  Get-Content -Raw -LiteralPath $chromiumManifestPath |
    ConvertFrom-Json
).version

$browserDefinitions = @(
  @{
    Name = "chrome"
    Title = "Chrome"
    ManifestPath = $chromiumManifestPath
  },
  @{
    Name = "firefox"
    Title = "Firefox"
    ManifestPath = $firefoxManifestPath
  },
  @{
    Name = "opera"
    Title = "Opera"
    ManifestPath = $chromiumManifestPath
  }
)

function Get-RelativePath([string]$BasePath, [string]$FullPath) {
  return $FullPath.Substring($BasePath.Length + 1)
}

function Assert-BrowserManifest(
  [string]$BrowserName,
  [string]$ManifestPath
) {
  $manifest = Get-Content -Raw -LiteralPath $ManifestPath |
    ConvertFrom-Json

  if ($manifest.version -ne $version -or $manifest.manifest_version -ne 3) {
    throw "$BrowserName source manifest has an unexpected version."
  }

  if ($BrowserName -ne "Firefox") {
    if ($manifest.background.service_worker -ne "background.js") {
      throw "The Chromium service worker configuration changed."
    }
    return
  }

  if ($manifest.browser_specific_settings.gecko.id -ne $expectedFirefoxId) {
    throw "The Firefox stable extension ID changed."
  }
  if (
    (
      $manifest.browser_specific_settings.gecko.
        data_collection_permissions.required -join ","
    ) -ne "none"
  ) {
    throw "The Firefox no-data-collection declaration changed."
  }
}

function New-BrowserStage(
  [string]$Browser,
  [string]$ManifestPath
) {
  $browserRoot = Join-Path $stagingRoot $Browser
  New-Item -ItemType Directory -Path $browserRoot -Force | Out-Null

  Get-ChildItem -LiteralPath $extensionRoot -Recurse -File |
    Where-Object {
      $_.Name -notin @("manifest.chromium.json", "manifest.firefox.json")
    } |
    ForEach-Object {
      $relativePath = Get-RelativePath $extensionRoot $_.FullName
      $destination = Join-Path $browserRoot $relativePath
      $destinationDirectory = Split-Path -Parent $destination
      New-Item -ItemType Directory -Path $destinationDirectory -Force |
        Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    }

  Copy-Item -LiteralPath $ManifestPath `
    -Destination (Join-Path $browserRoot "manifest.json") -Force
  return $browserRoot
}

function Test-ManifestAssets(
  [string]$Browser,
  [string]$BrowserRoot
) {
  $manifest = Get-Content -Raw `
    -LiteralPath (Join-Path $BrowserRoot "manifest.json") |
    ConvertFrom-Json

  if ($manifest.version -ne $version -or $manifest.manifest_version -ne 3) {
    throw "$Browser manifest version is unexpected."
  }

  $iconPaths = @($manifest.icons.PSObject.Properties.Value)
  $iconPaths += @($manifest.action.default_icon.PSObject.Properties.Value)
  foreach ($iconPath in $iconPaths | Sort-Object -Unique) {
    if (-not (Test-Path -LiteralPath (Join-Path $BrowserRoot $iconPath))) {
      throw "$Browser manifest references missing asset $iconPath."
    }
  }
}

function Test-Package(
  [string]$Browser,
  [string]$BrowserRoot,
  [string]$ArchivePath
) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    $entries = @(
      $archive.Entries |
        Where-Object { -not $_.FullName.EndsWith("/") }
    )
    if ($entries.FullName -match "\\") {
      throw "$Browser package contains a Windows path separator."
    }
    if ($entries.FullName -match "(?i)(^|/)(tests?|fixtures?|dev|tools?)(/|$)") {
      throw "$Browser package contains development or test content."
    }
    if ($entries.FullName -match "^icons/icon(?:16|32|48|128)\.png$") {
      throw "$Browser package contains stale icon files."
    }

    $diskFiles = @(Get-ChildItem -LiteralPath $BrowserRoot -Recurse -File)
    if ($entries.Count -ne $diskFiles.Count) {
      throw "$Browser package file count does not match its build stage."
    }

    $expectedNames = @(
      $diskFiles |
        ForEach-Object {
          (Get-RelativePath $BrowserRoot $_.FullName).Replace("\", "/")
        }
    )
    $nameDifferences = @(
      Compare-Object `
        -ReferenceObject $expectedNames `
        -DifferenceObject $entries.FullName
    )
    if ($nameDifferences.Count -ne 0) {
      throw "$Browser package paths do not match its build stage."
    }
  } finally {
    $archive.Dispose()
  }
}

function New-ReleaseArchive(
  [string]$BrowserRoot,
  [string]$ArchivePath
) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::Open(
    $ArchivePath,
    [System.IO.Compression.ZipArchiveMode]::Create
  )
  try {
    Get-ChildItem -LiteralPath $BrowserRoot -Recurse -File |
      Sort-Object FullName |
      ForEach-Object {
        $entryName = (
          Get-RelativePath $BrowserRoot $_.FullName
        ).Replace("\", "/")
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

$selectedBrowserDefinitions = if ($Browser -eq "All") {
  @($browserDefinitions)
} else {
  @(
    $browserDefinitions |
      Where-Object { $_.Title -eq $Browser }
  )
}

if ($selectedBrowserDefinitions.Count -eq 0) {
  throw "No browser definition matched $Browser."
}

foreach ($definition in $selectedBrowserDefinitions) {
  Assert-BrowserManifest $definition.Title $definition.ManifestPath
}

$javascriptFiles = Get-ChildItem `
  -LiteralPath $extensionRoot `
  -Filter *.js `
  -File
foreach ($javascriptFile in $javascriptFiles) {
  & $NodeExecutable --check $javascriptFile.FullName
  if ($LASTEXITCODE -ne 0) {
    throw "JavaScript syntax check failed for $($javascriptFile.Name)."
  }
}

& $NodeExecutable (Join-Path $projectRoot "tests\detection-engine.test.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "Detection regression tests failed."
}

$textExtensions = @(".js", ".html", ".css", ".json", ".md", ".ps1", ".mjs")
Get-ChildItem -LiteralPath $projectRoot -Recurse -File |
  Where-Object {
    $_.Extension -in $textExtensions -and
    -not $_.FullName.StartsWith($stagingRoot)
  } |
  ForEach-Object {
    if ((Get-Content -Raw -LiteralPath $_.FullName).Contains([char]0x2014)) {
      throw "Em dash found in $(Get-RelativePath $projectRoot $_.FullName)."
    }
  }

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$resolvedProjectRoot = [System.IO.Path]::GetFullPath($projectRoot)
$resolvedStagingRoot = [System.IO.Path]::GetFullPath($stagingRoot)
if (
  (Split-Path -Parent $resolvedStagingRoot) -ne $resolvedProjectRoot -or
  (Split-Path -Leaf $resolvedStagingRoot) -ne ".build"
) {
  throw "Refusing to use an unexpected build staging path."
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingRoot | Out-Null

try {
  foreach ($definition in $selectedBrowserDefinitions) {
    $browserRoot = New-BrowserStage `
      $definition.Name `
      $definition.ManifestPath
    Test-ManifestAssets $definition.Title $browserRoot

    $archivePath = Join-Path $outputRoot (
      "Grandma-Guard-$($definition.Title)-$version.zip"
    )
    if (Test-Path -LiteralPath $archivePath) {
      Remove-Item -LiteralPath $archivePath -Force
    }
    New-ReleaseArchive $browserRoot $archivePath
    Test-Package $definition.Title $browserRoot $archivePath
    Write-Host "Built and validated $(Split-Path -Leaf $archivePath)"
  }
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}

Write-Host "Completed build target: $Browser"
