# ChayaOne OS — Desktop Shortcuts Creator
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$iconPath = Join-Path $root.Path "local-first\platform\apps\web\public\favicon.ico"

$shortcuts = @(
  @{ Name = "ChayaOne POS (Main PC Desktop)"; Target = "START-MAIN-PC.bat"; Desc = "Launch ChayaOne Cashier POS Desktop Application" },
  @{ Name = "ChayaOne Kitchen Display (KDS)"; Target = "START-KDS-APP.bat"; Desc = "Launch Kitchen Display Station in Desktop Window" },
  @{ Name = "ChayaOne POS (Electron Native)"; Target = "START-DESKTOP-APP.bat"; Desc = "Launch Electron Native POS Desktop App" },
  @{ Name = "ChayaOne Owner & Manager Portal"; Target = "START-OWNER-APP.bat"; Desc = "Launch Owner Management Dashboard" },
  @{ Name = "ChayaOne Waiter Android APK Folder"; Target = "android\release-apks"; Desc = "Open Android APK folder for tablets & mobile phones" },
  @{ Name = "ChayaOne Install APK to Device"; Target = "INSTALL-APK-TO-DEVICE.bat"; Desc = "1-Click USB ADB Installer for tablets & phones" },
  @{ Name = "ChayaOne Rebuild Waiter APK"; Target = "BUILD-APKS.bat"; Desc = "Rebuild ChayaOne Waiter Android APK" }
)

Write-Host "Creating ChayaOne shortcuts on your Windows Desktop..." -ForegroundColor Cyan

foreach ($s in $shortcuts) {
  $targetFile = Join-Path $root.Path $s.Target
  $shortcutPath = Join-Path $desktop ($s.Name + ".lnk")
  $link = $ws.CreateShortcut($shortcutPath)
  $link.TargetPath = $targetFile
  $link.WorkingDirectory = $root.Path
  $link.Description = $s.Desc
  if (Test-Path $iconPath) {
    $link.IconLocation = "$iconPath,0"
  }
  $link.Save()
  Write-Host "  [OK] Created: $($s.Name)" -ForegroundColor Green
}

Write-Host "`nAll desktop shortcuts have been successfully generated on your Windows Desktop!" -ForegroundColor Green
