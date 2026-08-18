; ChayaOne OS — Windows Main PC Inno Setup Script
; Builds ChayaOneOS-Setup-v1.0.exe installer for Windows 10/11 Main PC

[Setup]
AppName=ChayaOne OS
AppVersion=1.0.0
AppPublisher=Nuro7 / ChayaOne
AppPublisherURL=https://chayaone.com
AppSupportURL=https://chayaone.com/support
AppUpdatesURL=https://chayaone.com/updates
DefaultDirName={autopf}\ChayaOne OS
DefaultGroupName=ChayaOne OS
AllowNoIcons=yes
OutputDir=.\dist
OutputBaseFilename=ChayaOneOS-Setup-v1.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupentry"; Description: "Run ChayaOne OS automatically on Windows Startup"; GroupDescription: "Auto-Startup:"

[Files]
; Copy platform files into application folder
Source: "..\platform\*"; DestDir: "{app}\platform"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\ChayaOne OS POS"; Filename: "http://localhost:3000/pos"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"
Name: "{group}\ChayaOne OS Setup Wizard"; Filename: "http://localhost:3000/setup"
Name: "{autodesktop}\ChayaOne OS POS"; Filename: "http://localhost:3000/pos"; Tasks: desktopicon

[Registry]
; Windows startup auto-launch
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ChayaOneOSServer"; ValueData: """{app}\platform\scripts\launch-local-server.mjs"""; Tasks: startupentry

[Run]
; Open Windows Defender Firewall port 3000 for LAN devices
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""ChayaOne OS Web Server"" dir=in action=allow protocol=TCP localport=3000 profile=private"; Flags: runhidden

; Launch local server automatically after installation completes
Filename: "node"; Parameters: "scripts/launch-local-server.mjs"; WorkingDir: "{app}\platform"; Flags: postinstall nowait skipifsilent description: "Launch ChayaOne OS POS immediately"
