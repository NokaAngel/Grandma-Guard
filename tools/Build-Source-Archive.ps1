[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = "1.0.0"
$archivePath = Join-Path $projectRoot "Grandma-Guard-GitHub-Source-$version.zip"

$includedFiles = @(
  ".gitignore",
  "BUILDING.md",
  "CHROME_PRIVACY_POLICY.md",
  "LICENSE",
  "OPERA_PRIVACY_POLICY.md",
  "PRIVACY_POLICY.md",
  "README.md",
  "STORE_LISTING.md",
  "STORE_SUBMISSION_GUIDE.md"
)

$includedDirectories = @(
  "branding",
  "chrome",
  "firefox",
  "opera",
  "source",
  "store-assets",
  "tests",
  "tools"
)

function Get-RelativePath([string]$BasePath, [string]$FullPath) {
  return $FullPath.Substring($BasePath.Length + 1)
}

function Add-ArchiveFile(
  [System.IO.Compression.ZipArchive]$Archive,
  [string]$FullPath,
  [string]$EntryName
) {
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
    $Archive,
    $FullPath,
    $EntryName.Replace("\", "/"),
    [System.IO.Compression.CompressionLevel]::Optimal
  ) | Out-Null
}

$allFiles = @()
foreach ($relativeFile in $includedFiles) {
  $fullPath = Join-Path $projectRoot $relativeFile
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    throw "Required source file is missing: $relativeFile"
  }
  $allFiles += Get-Item -LiteralPath $fullPath
}

foreach ($relativeDirectory in $includedDirectories) {
  $fullPath = Join-Path $projectRoot $relativeDirectory
  if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
    throw "Required source directory is missing: $relativeDirectory"
  }
  $allFiles += Get-ChildItem -LiteralPath $fullPath -Recurse -File
}

$allFiles = @($allFiles | Sort-Object FullName -Unique)
$textExtensions = @(".css", ".html", ".js", ".json", ".md", ".mjs", ".ps1")
foreach ($file in $allFiles | Where-Object { $_.Extension -in $textExtensions }) {
  if ((Get-Content -Raw -LiteralPath $file.FullName).Contains([char]0x2014)) {
    throw "Em dash found in $(Get-RelativePath $projectRoot $file.FullName)."
  }
}

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open(
  $archivePath,
  [System.IO.Compression.ZipArchiveMode]::Create
)
try {
  foreach ($file in $allFiles) {
    $entryName = Get-RelativePath $projectRoot $file.FullName
    Add-ArchiveFile $archive $file.FullName $entryName
  }
} finally {
  $archive.Dispose()
}

$inspection = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $entryNames = @(
    $inspection.Entries |
      Where-Object { -not $_.FullName.EndsWith("/") } |
      ForEach-Object FullName
  )

  if ($entryNames -match "\\") {
    throw "The source archive contains a Windows path separator."
  }
  if ($entryNames -match "(?i)(^|/)(\.git|node_modules)(/|$)") {
    throw "The source archive contains excluded repository or dependency data."
  }
  if ($entryNames -match "(?i)\.zip$") {
    throw "The source archive contains a nested ZIP file."
  }
  foreach ($requiredEntry in @(
    "LICENSE",
    "BUILDING.md",
    "source/detection-engine.js",
    "chrome/manifest.json",
    "firefox/manifest.json",
    "opera/manifest.json",
    "tests/detection-engine.test.mjs",
    "tools/Build-Release.ps1"
  )) {
    if ($requiredEntry -notin $entryNames) {
      throw "The source archive is missing $requiredEntry."
    }
  }
} finally {
  $inspection.Dispose()
}

Write-Host "Built and validated $(Split-Path -Leaf $archivePath)"

