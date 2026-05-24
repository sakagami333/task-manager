# Task Manager - startup script
$ErrorActionPreference = "SilentlyContinue"
$pidFile = Join-Path $PSScriptRoot ".server-pids"

# Stop previously launched windows
if (Test-Path $pidFile) {
    $savedPids = Get-Content $pidFile
    foreach ($p in $savedPids) {
        $proc = Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue
        if ($proc) { Stop-Process -Id ([int]$p) -Force }
    }
    Remove-Item $pidFile -Force
}

# Stop any remaining node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Start backend
$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"

$backend = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; npm run dev" `
    -PassThru

Start-Sleep -Seconds 2

# Start frontend
$frontend = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" `
    -PassThru

# Save PIDs for next restart
if ($backend -and $frontend) {
    $backend.Id | Out-File -FilePath $pidFile -Encoding UTF8
    $frontend.Id | Out-File -FilePath $pidFile -Encoding UTF8 -Append
    Write-Host "Started. Open http://taskboard:8080"
    Start-Sleep -Seconds 3
    Start-Process "http://taskboard:8080"
}
