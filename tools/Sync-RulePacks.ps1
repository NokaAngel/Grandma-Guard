[CmdletBinding()]
param(
  [string]$NodeExecutable = "node"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot "data\rule-packs.json"
$extensionDataPath = Join-Path $projectRoot "extension\data\rule-packs.json"
$dataJsPath = Join-Path $projectRoot "extension\rule-packs-data.js"

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Missing rule pack source at data/rule-packs.json"
}

$privateKeyPath = Join-Path $projectRoot ".rule-pack-private.pem"
$signScript = Join-Path $projectRoot "tools\sign-rule-pack.mjs"
if ((Test-Path -LiteralPath $privateKeyPath) -and (Test-Path -LiteralPath $signScript)) {
  & $NodeExecutable $signScript
  if ($LASTEXITCODE -ne 0) {
    throw "Rule pack signing failed."
  }
}

$syncScript = Join-Path $projectRoot "tools\sync-rule-packs.mjs"
if (-not (Test-Path -LiteralPath $syncScript)) {
  throw "Missing tools/sync-rule-packs.mjs"
}

& $NodeExecutable $syncScript $sourcePath $extensionDataPath $dataJsPath
if ($LASTEXITCODE -ne 0) {
  throw "Rule pack sync script failed."
}

& $NodeExecutable --check $dataJsPath
if ($LASTEXITCODE -ne 0) {
  throw "Generated rule-packs-data.js failed syntax check."
}

Write-Host "Synced rule packs to extension/data/rule-packs.json and extension/rule-packs-data.js"
