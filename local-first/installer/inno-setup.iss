; =========================================================================
; ChayaOne OS — Production Windows Main Cafe PC Installer Script
; Compiles ChayaOne-Setup-v1.0.exe for Windows 10/11 Main Cafe PC
; =========================================================================

#define AppName "ChayaOne OS"
#define AppVersion "1.0.0"
#define AppPublisher "Nuro7 / ChayaOne"
#define AppURL "https://chayaone.com"
#define AppExeName "START_CHAYAONE.bat"

[Setup]
AppId={{D819C0E2-51E9-4B52-9A0E-85C92B45F311}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/support
AppUpdatesURL={#AppURL}/updates
DefaultDirName={autopf}\ChayaOne OS
DefaultGroupName=ChayaOne OS
AllowNoIcons=yes
OutputDir=.\dist
OutputBaseFilename=ChayaOne-Setup-v1.0
SetupIconFile=..\platform\apps\web\public\favicon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostartservice"; Description: "Configure ChayaOne OS background services for automatic startup"; GroupDescription: "System Services:"

[Dirs]
; Read-only binaries in Program Files
Name: "{app}\Desktop"
Name: "{app}\Server"
Name: "{app}\PrintManager"
Name: "{app}\Updater"
Name: "{app}\Runtime"

; Persistent writable customer data in ProgramData
Name: "{commonappdata}\ChayaOne\data"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\backups"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\logs"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\config"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\updates\staging"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\updates\downloaded"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\updates\backup"; Permissions: users-full

[Files]
; Copy platform build, web, desktop, and runtime files
Source: "..\platform\*"; DestDir: "{app}\platform"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\.cache,*.log,.localdb\*"

; Idempotent Database Directory (never overwrite existing customer database on upgrade)
Source: "..\platform\packages\db\.localdb\*"; DestDir: "{commonappdata}\ChayaOne\data"; Flags: onlyifdestfilemissing recursesubdirs createallsubdirs uninsneveruninstall

; Copy WinSW Service XML configuration files
Source: "ChayaOne-PostgreSQL.xml"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "ChayaOne-WebServer.xml"; DestDir: "{app}\installer"; Flags: ignoreversion

[Icons]
Name: "{group}\ChayaOne OS POS"; Filename: "http://localhost:3000/pos"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"
Name: "{group}\ChayaOne System Settings"; Filename: "http://localhost:3000/dashboard"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"
Name: "{autodesktop}\ChayaOne POS"; Filename: "http://localhost:3000/pos"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"; Tasks: desktopicon

[Run]
; Open Windows Defender Firewall rule for HTTP Server (Port 3000 - Private LAN only)
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""ChayaOne OS Web Server"" dir=in action=allow protocol=TCP localport=3000 profile=private"; Flags: runhidden

; Open Windows Defender Firewall rule for WebSocket Server (Port 3001 - Private LAN only)
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""ChayaOne OS Realtime WS"" dir=in action=allow protocol=TCP localport=3001 profile=private"; Flags: runhidden

; Initialize Database & Run Prisma migrations on install
Filename: "node"; Parameters: "scripts/ensure-db.mjs"; WorkingDir: "{app}\platform\packages\db"; Flags: runhidden

; Launch local server and POS interface after installation completes
Filename: "node"; Parameters: "scripts/launch-local-server.mjs"; WorkingDir: "{app}\platform"; Flags: postinstall nowait skipifsilent description: "Launch ChayaOne OS POS Till immediately"

[UninstallRun]
; Cleanly remove Windows Defender Firewall rules upon uninstallation
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""ChayaOne OS Web Server"""; Flags: runhidden
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""ChayaOne OS Realtime WS"""; Flags: runhidden

[Code]
var
  CafeConfigPage: TInputQueryWizardPage;
  PortConfigPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  { Page 1: Cafe Profile Setup }
  CafeConfigPage := CreateInputQueryPage(wpSelectDir,
    'Cafe Setup', 'Configure your local restaurant profile',
    'Please enter the details for this Main PC installation. Safe defaults are provided.');
  CafeConfigPage.Add('Cafe / Restaurant Name:', False);
  CafeConfigPage.Add('Cafe ID / Subdomain:', False);
  CafeConfigPage.Values[0] := 'Kahwa House';
  CafeConfigPage.Values[1] := 'kahwa';

  { Page 2: Local Server Ports }
  PortConfigPage := CreateInputQueryPage(CafeConfigPage.ID,
    'Local Server Configuration', 'Network Port Settings',
    'ChayaOne runs locally on the Main PC. Standard defaults ensure local LAN client compatibility.');
  PortConfigPage.Add('Web / API Port:', False);
  PortConfigPage.Add('WebSocket Port:', False);
  PortConfigPage.Add('PostgreSQL Port:', False);
  PortConfigPage.Values[0] := '3000';
  PortConfigPage.Values[1] := '3001';
  PortConfigPage.Values[2] := '5433';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvContent: string;
  EnvFilePath: string;
begin
  if CurStep = ssPostInstall then
  begin
    { Generate local production .env file with configured values }
    EnvFilePath := ExpandConstant('{app}\platform\.env');
    EnvContent :=
      'DATABASE_URL="postgresql://cafeos:cafeos@localhost:' + PortConfigPage.Values[2] + '/cafeos"' + #13#10 +
      'DIRECT_URL="postgresql://cafeos:cafeos@localhost:' + PortConfigPage.Values[2] + '/cafeos"' + #13#10 +
      'CHAYAONE_RUNTIME_MODE="local"' + #13#10 +
      'CHAYAONE_CLOUD_ENABLED="false"' + #13#10 +
      'DEV_TENANT_SUBDOMAIN="' + CafeConfigPage.Values[1] + '"' + #13#10 +
      'PORT="' + PortConfigPage.Values[0] + '"' + #13#10 +
      'WS_PORT="' + PortConfigPage.Values[1] + '"' + #13#10 +
      'JWT_SECRET="chayaone-local-jwt-secret-key-32-chars-long"' + #13#10 +
      'PLATFORM_JWT_SECRET="chayaone-local-platform-jwt-secret-key-admin"' + #13#10 +
      'OTP_DEV_ECHO="1"' + #13#10;
    
    SaveStringToFile(EnvFilePath, EnvContent, False);
  end;
end;
