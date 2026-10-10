# Cloudflare Quick Tunnel -> local Vite portal (default 5173)
# Usage: npm run dev, then npm run tunnel

param(
  [string]$Url = "http://127.0.0.1:5173"
)

$ErrorActionPreference = "Stop"

$bin = $null
$cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cmd) {
  $bin = $cmd.Source
}
if (-not $bin) {
  $p = Join-Path $env:LOCALAPPDATA "cloudflared\cloudflared.exe"
  if (Test-Path $p) { $bin = $p }
}
if (-not $bin) {
  $p = Join-Path $env:ProgramFiles "cloudflared\cloudflared.exe"
  if (Test-Path $p) { $bin = $p }
}

if (-not $bin) {
  Write-Host "cloudflared not found. Install with:"
  Write-Host "  winget install --id Cloudflare.cloudflared"
  exit 1
}

Write-Host "cloudflared: $bin"
Write-Host "tunnel -> $Url"
Write-Host "Public URL prints below (*.trycloudflare.com). Ctrl+C to stop."
Write-Host ""

& $bin tunnel --url $Url
