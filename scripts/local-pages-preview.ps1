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

function Get-NodeCommand {
  $bundledNode = 'C:\Users\makor\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path $bundledNode) {
    return $bundledNode
  }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    return $node.Source
  }

  throw 'node was not found. Install Node.js or use the bundled Codex runtime.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pnpm = Get-PnpmCommand
$node = Get-NodeCommand

if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
  & $pnpm install
}

& $pnpm build
& $node (Join-Path $repoRoot 'node_modules\vite\bin\vite.js') preview --host 127.0.0.1 --port 4173
