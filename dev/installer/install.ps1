# Installs Patter Studio for this Windows user: copies the app into AppData and adds Desktop and Start menu shortcuts.
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dir = Join-Path $env:LOCALAPPDATA 'PatterStudio'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Copy-Item (Join-Path $src 'Patter-Studio.html') $dir -Force
Copy-Item (Join-Path $src 'patter.ico') $dir -Force

$edge = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $edge) { Write-Host 'Microsoft Edge was not found on this computer.'; exit 1 }

$url = ([System.Uri](Join-Path $dir 'Patter-Studio.html')).AbsoluteUri
$shell = New-Object -ComObject WScript.Shell
$places = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Patter Studio.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Patter Studio.lnk')
)
foreach ($p in $places) {
  $lnk = $shell.CreateShortcut($p)
  $lnk.TargetPath = $edge
  $lnk.Arguments = "--app=`"$url`" --start-maximized"
  $lnk.IconLocation = (Join-Path $dir 'patter.ico')
  $lnk.WorkingDirectory = $dir
  $lnk.Description = 'Patter Studio'
  $lnk.Save()
}
Write-Host ''
Write-Host 'Patter Studio is installed. Double click the Patter Studio icon on your desktop to open it.'
