; ChayaOne OS — Windows Main PC Production Inno Setup Script
; Compiles ChayaOneOS-Setup-v1.0.exe installer for Windows 10/11 Main PC

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
Name: "serviceentry"; Description: "Register ChayaOne OS background services (PostgreSQL & Web/Realtime)"; GroupDescription: "System Integration:"

[Files]
; Copy platform build & runtime files
Source: "..\platform\*"; DestDir: "{app}\platform"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\.cache,*.log,.localdb\*"

; Idempotent Database Directory (never overwrite existing database on reinstall/upgrade)
Source: "..\platform\packages\db\.localdb\*"; DestDir: "{app}\platform\packages\db\.localdb"; Flags: onlyifdestfilemissing recursesubdirs createallsubdirs uninsneveruninstall

; Copy WinSW Service XML configuration files
Source: "ChayaOne-PostgreSQL.xml"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "ChayaOne-WebServer.xml"; DestDir: "{app}\installer"; Flags: ignoreversion

[Icons]
Name: "{group}\ChayaOne OS POS Till"; Filename: "http://localhost:3000/pos"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"
Name: "{group}\ChayaOne OS Setup Wizard"; Filename: "http://localhost:3000/setup"
Name: "{autodesktop}\ChayaOne OS POS Till"; Filename: "http://localhost:3000/pos"; Tasks: desktopicon

[Run]
; Open Windows Defender Firewall rule for HTTP Server (Port 3000)
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""ChayaOne OS Web Server"" dir=in action=allow protocol=TCP localport=3000 profile=private"; Flags: runhidden

; Open Windows Defender Firewall rule for WebSocket Server (Port 3001)
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""ChayaOne OS Realtime WS"" dir=in action=allow protocol=TCP localport=3001 profile=private"; Flags: runhidden

; Launch local server launcher after installation completes
Filename: "node"; Parameters: "scripts/launch-local-server.mjs"; WorkingDir: "{app}\platform"; Flags: postinstall nowait skipifsilent description: "Launch ChayaOne OS POS Till immediately"

[UninstallRun]
; Remove Windows Defender Firewall rules upon uninstallation
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""ChayaOne OS Web Server"""; Flags: runhidden
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""ChayaOne OS Realtime WS"""; Flags: runhidden
