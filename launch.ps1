$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeTool = "C:\Users\ASUS\Documents\Codex\2026-05-09\https-github-com-parth-18-06\InGuard\.tools\node-v24.15.0-win-x64"
$node = Join-Path $nodeTool "node.exe"
$backendDir = Join-Path $root "server"
$frontendDir = Join-Path $root "frontend"

function Stop-PortProcess {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    if ($processId) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Wait-Http {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Milliseconds 750
    }
  } while ((Get-Date) -lt $deadline)

  return $false
}

if (-not (Test-Path $node)) {
  throw "Node executable not found at $node"
}

Write-Host "Starting Creatorflow..." -ForegroundColor Cyan

Stop-PortProcess -Port 5000
Stop-PortProcess -Port 5173
Start-Sleep -Seconds 1

Start-Process -FilePath $node `
  -ArgumentList "server.js" `
  -WorkingDirectory $backendDir `
  -RedirectStandardOutput (Join-Path $backendDir "creatorflow-server.out.log") `
  -RedirectStandardError (Join-Path $backendDir "creatorflow-server.err.log") `
  -WindowStyle Hidden

Start-Process -FilePath $node `
  -ArgumentList "node_modules/vite/bin/vite.js", "--host", "127.0.0.1" `
  -WorkingDirectory $frontendDir `
  -RedirectStandardOutput (Join-Path $frontendDir "creatorflow-frontend.out.log") `
  -RedirectStandardError (Join-Path $frontendDir "creatorflow-frontend.err.log") `
  -WindowStyle Hidden

$backendReady = Wait-Http -Url "http://127.0.0.1:5000/health"
$frontendReady = Wait-Http -Url "http://127.0.0.1:5173"

if (-not $backendReady) {
  Write-Host "Backend did not become ready. Check server/creatorflow-server.err.log" -ForegroundColor Red
  exit 1
}

if (-not $frontendReady) {
  Write-Host "Frontend did not become ready. Check frontend/creatorflow-frontend.err.log" -ForegroundColor Red
  exit 1
}

Write-Host "Creatorflow is running." -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:5173/login"
Write-Host "Backend:  http://127.0.0.1:5000/health"
