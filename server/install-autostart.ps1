# Registers a per-user Scheduled Task that auto-starts the PnL Calendar server
# at logon (survives reboots). No administrator rights required.
#
#   Run:  powershell -ExecutionPolicy Bypass -File install-autostart.ps1
#   Undo: powershell -ExecutionPolicy Bypass -File install-autostart.ps1 -Uninstall

param(
  [switch]$Uninstall,
  [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
$TaskName = 'PnLCalendarWeb'
$serverDir = $PSScriptRoot
$vbs = Join-Path $serverDir 'run-hidden.vbs'

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'." -ForegroundColor Yellow
  } else {
    Write-Host "Scheduled task '$TaskName' not found." -ForegroundColor Yellow
  }
  return
}

$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
$action  = New-ScheduledTaskAction -Execute $wscript -Argument "`"$vbs`"" -WorkingDirectory $serverDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Installed scheduled task '$TaskName' (auto-starts at logon)." -ForegroundColor Green
Write-Host "App will be served at http://localhost:$Port" -ForegroundColor Green
