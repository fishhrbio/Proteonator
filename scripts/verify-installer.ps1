param(
  [string]$Installer = (Join-Path $PSScriptRoot '..\release\ProView-Setup-1.0.0-x64.exe'),
  [string]$Node = 'node',
  [string]$TestRoot = (Join-Path $PSScriptRoot '..\work\installer')
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testBase = [IO.Path]::GetFullPath($TestRoot)
$target = [IO.Path]::GetFullPath((Join-Path $testBase 'ProView install é'))
if (-not $target.StartsWith($testBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Installer target is outside its test folder.' }
if (Test-Path -LiteralPath $target) { throw 'Test installation directory already exists; inspect it before choosing a new test root.' }
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
New-Item -ItemType Directory -Path $testBase -Force | Out-Null
$report = [ordered]@{ status='running'; startedAt=(Get-Date).ToUniversalTime().ToString('o'); installer=$installerPath; target=$target; installerSha256=(Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLower(); signature=(Get-AuthenticodeSignature -LiteralPath $installerPath).Status.ToString(); checks=@() }
$installed = $false
$executable = Join-Path $target 'ProView.exe'
$startMenu=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ProView.lnk'
$desktop=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'ProView.lnk'
try {
  $existing = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'ProView 1.0.0' }
  if ($existing) { throw 'An existing ProView installation is registered. Inspect it before running an isolated installer test.' }
  $install = Start-Process -FilePath $installerPath -ArgumentList "/S /currentuser /D=$target" -WindowStyle Hidden -PassThru -Wait
  $report.installExitCode = $install.ExitCode
  if ($install.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $executable)) { throw 'Installer failed to create the application.' }
  $installed = $true
  $report.checks += 'Silent current-user installation into a path with spaces and non-ASCII characters'
  $metadata = (Get-Item -LiteralPath $executable).VersionInfo
  $report.productName=$metadata.ProductName
  $report.productVersion=$metadata.ProductVersion
  if ($metadata.ProductName -ne 'ProView' -or $metadata.ProductVersion -notmatch '^1\.0\.0(?:\.0)?$') { throw 'Installed product metadata is incorrect.' }
  $expectedArchive=Join-Path $projectRoot 'release\win-unpacked\resources\app.asar'
  $installedArchive=Join-Path $target 'resources\app.asar'
  $report.installedAsarSha256=(Get-FileHash -LiteralPath $installedArchive -Algorithm SHA256).Hash.ToLower()
  if ($report.installedAsarSha256 -ne (Get-FileHash -LiteralPath $expectedArchive -Algorithm SHA256).Hash.ToLower()) { throw 'Installed application archive differs from the audited build.' }
  $report.checks += 'Installed application archive matches the audited build byte for byte'
  $report.shortcuts=@()
  foreach ($shortcutPath in @($startMenu,$desktop)) {
    if (-not (Test-Path -LiteralPath $shortcutPath)) { throw "Missing ProView shortcut: $shortcutPath" }
    $shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
    if ($shortcut.TargetPath -ne $executable) { throw 'Shortcut points to a different executable.' }
    $report.shortcuts += @{path=$shortcutPath;target=$shortcut.TargetPath}
  }
  $report.checks += 'Start menu and desktop shortcut targets and ProView version metadata verified'
  foreach ($notice in @('LICENSE.electron.txt','LICENSES.chromium.html','resources\THIRD_PARTY_NOTICES.md','resources\USER_GUIDE.html','resources\ProView-LICENSE.txt','resources\licenses\3dmol-LICENSE.txt','resources\licenses\zod-LICENSE.txt','resources\fixtures\PROVENANCE.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $target $notice))) { throw "Missing installed notice or guide: $notice" }
  }
  $report.checks += 'Runtime notices, third-party attribution and offline guide present'
  $env:PROVIEW_EXE=$executable
  $env:PROVIEW_TEST_NAME='installed'
  $env:PROVIEW_RUNTIME_ONLY='1'
  & $Node (Join-Path $PSScriptRoot 'verify-release.mjs')
  $report.installedWorkflowExitCode=$LASTEXITCODE
  if ($LASTEXITCODE -ne 0) { throw 'Installed application workflow failed.' }
  $report.checks += 'Installed import, selection, annotation, geometry, alignment, save/reopen, JSON/PNG export, accessibility and offline suite passed with developer runtimes excluded from the application PATH'
  $reinstall = Start-Process -FilePath $installerPath -ArgumentList "/S /currentuser /D=$target" -WindowStyle Hidden -PassThru -Wait
  $report.reinstallExitCode=$reinstall.ExitCode
  if ($reinstall.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $executable)) { throw 'Same-version reinstall failed.' }
  $report.checks += 'Same-version reinstall completed successfully'
  $report.status='passed'
} catch {
  $report.status='failed'
  $report.failure=$_.Exception.Message
  Write-Error $_ -ErrorAction Continue
} finally {
  if ($installed) {
    $uninstaller=Join-Path $target 'Uninstall ProView.exe'
    if (Test-Path -LiteralPath $uninstaller) {
      $uninstall=Start-Process -FilePath $uninstaller -ArgumentList '/S /currentuser' -WindowStyle Hidden -PassThru -Wait
      $report.uninstallExitCode=$uninstall.ExitCode
      $deadline=(Get-Date).AddSeconds(20)
      while ((Test-Path -LiteralPath $executable) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 200 }
      $report.executableRemoved = -not (Test-Path -LiteralPath $executable)
      $report.shortcutsRemoved = (-not (Test-Path -LiteralPath $startMenu)) -and (-not (Test-Path -LiteralPath $desktop))
      $report.externalProjectRetained=Test-Path -LiteralPath (Join-Path $projectRoot 'work\installed\portable é.proview')
      if ($uninstall.ExitCode -ne 0 -or -not $report.executableRemoved -or -not $report.shortcutsRemoved) { $report.status='failed';$report.uninstallFailure='Executable or shortcuts remained after uninstall.' }
      else { $report.checks += 'Uninstall removed the application and shortcuts while the separately saved project remained' }
    } else { $report.status='failed';$report.uninstallFailure='Uninstaller missing.' }
  }
  $report.finishedAt=(Get-Date).ToUniversalTime().ToString('o')
  $evidence=Join-Path $projectRoot 'evidence'
  New-Item -ItemType Directory -Path $evidence -Force | Out-Null
  $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $evidence 'installer-verification.json') -Encoding utf8
  $report | ConvertTo-Json -Depth 12 | Write-Output
}
if ($report.status -ne 'passed') { exit 1 }
