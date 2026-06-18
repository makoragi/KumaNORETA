Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-PnpmCommand {
  $bundledPnpm = 'C:\Users\makor\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd'
  $bundledNode = 'C:\Users\makor\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'

  if (Test-Path $bundledPnpm) {
    if (Test-Path $bundledNode) {
      $env:Path = "$bundledNode;$env:Path"
    }

    return $bundledPnpm
  }

  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) {
    return $pnpm.Source
  }

  throw 'pnpm was not found. Install pnpm or use the bundled Codex runtime.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pnpm = Get-PnpmCommand

if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
  & $pnpm install --frozen-lockfile
}

& $pnpm build
